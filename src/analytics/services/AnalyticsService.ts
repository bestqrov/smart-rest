import type {
  Period,
  PeriodType,
  CollectedData,
  AggregationResult,
  ReportResult,
  DashboardSummary,
  DashboardMetric,
  CollectOptions,
  GetMetricOptions,
} from '../types'
import { resolvePeriod, previousPeriod } from '../aggregators/periods'
import { buildResult } from '../aggregators/AggregationEngine'
import { getCollector, getAllCollectors, getCollectorForMetric } from '../collectors/CollectorRegistry'
import { getMetric, getAllMetrics, getMetricsByModule } from '../metrics/MetricRegistry'
import { getReport } from '../reports/ReportRegistry'
import { saveSnapshot, getLatestSnapshot } from '../storage/SnapshotStore'

// ─── Period normalization ─────────────────────────────────────────────────────

function normalizePeriod(p: PeriodType | Period): Period {
  return typeof p === 'string' ? resolvePeriod(p) : p
}

// ─── collect() — run one module's collector ───────────────────────────────────

export async function collectModule(
  module:   string,
  periodIn: PeriodType | Period,
  options?: { persist?: boolean; tenantId?: string },
): Promise<CollectedData> {
  const period   = normalizePeriod(periodIn)
  const collector = getCollector(module)
  const data      = await collector.collect(period, options?.tenantId)

  if (options?.persist !== false) {
    // persist a snapshot for each metric with a concrete value
    const saves: Promise<unknown>[] = []
    for (const [metricId, value] of Object.entries(data.data)) {
      if (value === null) continue
      saves.push(
        saveSnapshot({
          metricId,
          period:      period.type,
          periodStart: period.start,
          periodEnd:   period.end,
          value,
          tenantId:    options?.tenantId,
        }).catch(() => undefined),   // never throw on persistence failure
      )
    }
    await Promise.all(saves)
  }

  return data
}

// ─── collectAll() — run every registered collector ───────────────────────────

export async function collectAll(
  periodIn: PeriodType | Period,
  options?: { persist?: boolean; tenantId?: string },
): Promise<CollectedData[]> {
  const collectors = getAllCollectors()
  return Promise.all(
    collectors.map(c => collectModule(c.module, periodIn, options))
  )
}

// ─── collect() — alias, collects a specific metric ────────────────────────────

export async function collect(
  metricId: string,
  opts: CollectOptions,
): Promise<AggregationResult> {
  const metric    = getMetric(metricId)
  const period    = normalizePeriod(opts.period)
  const collector = getCollectorForMetric(metricId)

  if (!collector) {
    return buildResult(metricId, period, null)
  }

  const data = await collectModule(collector.module, period, {
    persist:  opts.persist !== false,
    tenantId: opts.tenantId,
  })

  const raw = data.data[metricId] ?? null

  // Calculate trend for TREND metrics or when requested
  let prevValue: number | null | undefined
  if (metric.aggregationType === 'TREND') {
    const prev = previousPeriod(period)
    const prevData = await collectModule(collector.module, prev, { persist: false })
    prevValue = prevData.data[metricId] ?? null
  }

  return buildResult(metricId, period, raw, prevValue)
}

// ─── getMetric() — resolve from snapshot or collect live ──────────────────────

export async function getMetric_value(
  metricId: string,
  opts:     GetMetricOptions,
): Promise<AggregationResult> {
  const period = normalizePeriod(opts.period)

  // Try cached snapshot first (from today if period is 'today' or '30d')
  if (!opts.withTrend) {
    const snapshot = await getLatestSnapshot(metricId, opts.period, opts.tenantId)
    if (snapshot) {
      return {
        metricId,
        period,
        value:       snapshot.value,
        trend:       snapshot.trend ?? undefined,
        collectedAt: snapshot.createdAt,
      }
    }
  }

  // Fall back to live collection
  return collect(metricId, { period: opts.period, tenantId: opts.tenantId })
}

// ─── getMetrics() — batch resolve ────────────────────────────────────────────

export async function getMetrics(
  metricIds: string[],
  opts:      GetMetricOptions,
): Promise<AggregationResult[]> {
  return Promise.all(metricIds.map(id => getMetric_value(id, opts)))
}

// ─── getModuleSummary() ───────────────────────────────────────────────────────

export async function getModuleSummary(
  module:   string,
  periodIn: PeriodType,
  tenantId?: string,
): Promise<{ module: string; period: Period; metrics: AggregationResult[] }> {
  const period  = resolvePeriod(periodIn)
  const defs    = getMetricsByModule(module, true)
  const results = await getMetrics(
    defs.map(m => m.id),
    { period: periodIn, tenantId },
  )

  return { module, period, metrics: results }
}

// ─── getPlatformSummary() ─────────────────────────────────────────────────────

export async function getPlatformSummary(
  periodIn: PeriodType = '30d',
  tenantId?: string,
): Promise<DashboardSummary> {
  const period   = resolvePeriod(periodIn)
  const allDefs  = getAllMetrics(true)
  const results  = await getMetrics(
    allDefs.map(m => m.id),
    { period: periodIn, tenantId },
  )

  const metrics: DashboardMetric[] = results.map((r, i) => ({
    definition: allDefs[i],
    result:     r,
  }))

  const byModule: Record<string, DashboardMetric[]> = {}
  for (const m of metrics) {
    const mod = m.definition.module
    if (!byModule[mod]) byModule[mod] = []
    byModule[mod].push(m)
  }

  return { period, generatedAt: new Date(), metrics, byModule }
}

// ─── getDashboardMetrics() ────────────────────────────────────────────────────

export async function getDashboardMetrics(
  metricIds: string[],
  periodIn:  PeriodType = '30d',
  tenantId?: string,
): Promise<DashboardSummary> {
  const period   = resolvePeriod(periodIn)
  const results  = await getMetrics(metricIds, { period: periodIn, tenantId })
  const metrics: DashboardMetric[] = results.map(r => ({
    definition: getMetric(r.metricId),
    result:     r,
  }))

  const byModule: Record<string, DashboardMetric[]> = {}
  for (const m of metrics) {
    const mod = m.definition.module
    if (!byModule[mod]) byModule[mod] = []
    byModule[mod].push(m)
  }

  return { period, generatedAt: new Date(), metrics, byModule }
}

// ─── generateReport() ────────────────────────────────────────────────────────

export async function generateReport(
  reportId:  string,
  periodIn?: PeriodType,
  tenantId?: string,
): Promise<ReportResult> {
  const report  = getReport(reportId)
  const period  = resolvePeriod(periodIn ?? report.defaultPeriod)
  const metrics = await getMetrics(
    report.metrics,
    { period: periodIn ?? report.defaultPeriod, tenantId },
  )

  const summary: Record<string, number | null> = {}
  for (const r of metrics) {
    summary[r.metricId] = r.value
  }

  return {
    reportId:    report.id,
    reportName:  report.name,
    period,
    generatedAt: new Date(),
    metrics,
    summary,
  }
}

// ─── collectNow() — convenience trigger ──────────────────────────────────────

export async function collectNow(
  periodIn: PeriodType = '30d',
): Promise<{ collected: number; failed: string[] }> {
  const collectors = getAllCollectors()
  const failed: string[] = []
  let collected = 0

  await Promise.all(
    collectors.map(async c => {
      try {
        await collectModule(c.module, periodIn, { persist: true })
        collected++
      } catch {
        failed.push(c.module)
      }
    })
  )

  return { collected, failed }
}
