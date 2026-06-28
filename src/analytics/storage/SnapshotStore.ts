import type { CreateSnapshotInput, MetricSnapshot, PeriodType } from '../types'

// ─── Snapshot persistence (uses MetricSnapshot Prisma model) ─────────────────

function toSnapshot(row: any): MetricSnapshot {
  return {
    id:          row.id,
    metricId:    row.metricId,
    period:      row.period as PeriodType,
    periodStart: row.periodStart,
    periodEnd:   row.periodEnd,
    value:       row.value,
    trend:       row.trend ?? null,
    tenantId:    row.tenantId ?? undefined,
    metadata:    row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt:   row.createdAt,
  }
}

export async function saveSnapshot(input: CreateSnapshotInput): Promise<MetricSnapshot> {
  const { default: prisma } = await import('../../prisma')

  const row = await (prisma as any).metricSnapshot.create({
    data: {
      metricId:    input.metricId,
      period:      input.period,
      periodStart: input.periodStart,
      periodEnd:   input.periodEnd,
      value:       input.value,
      trend:       input.trend ?? null,
      tenantId:    input.tenantId ?? null,
      metadata:    input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  return toSnapshot(row)
}

export async function getLatestSnapshot(
  metricId: string,
  period:   PeriodType,
  tenantId?: string,
): Promise<MetricSnapshot | null> {
  const { default: prisma } = await import('../../prisma')

  const row = await (prisma as any).metricSnapshot.findFirst({
    where: {
      metricId,
      period,
      tenantId: tenantId ?? null,
    },
    orderBy: { createdAt: 'desc' },
  })

  return row ? toSnapshot(row) : null
}

export async function getSnapshots(options: {
  metricId:   string
  period?:    PeriodType
  tenantId?:  string
  from?:      Date
  to?:        Date
  limit?:     number
}): Promise<MetricSnapshot[]> {
  const { default: prisma } = await import('../../prisma')

  const rows = await (prisma as any).metricSnapshot.findMany({
    where: {
      metricId:  options.metricId,
      ...(options.period   ? { period: options.period }       : {}),
      ...(options.tenantId ? { tenantId: options.tenantId }   : {}),
      ...(options.from || options.to ? {
        createdAt: {
          ...(options.from ? { gte: options.from } : {}),
          ...(options.to   ? { lte: options.to }   : {}),
        },
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take:    options.limit ?? 100,
  })

  return rows.map(toSnapshot)
}

export async function getSnapshotsForPeriod(
  metricIds: string[],
  period:    PeriodType,
  tenantId?: string,
): Promise<MetricSnapshot[]> {
  const { default: prisma } = await import('../../prisma')

  const rows = await (prisma as any).metricSnapshot.findMany({
    where: {
      metricId: { in: metricIds },
      period,
      tenantId: tenantId ?? null,
    },
    orderBy: { createdAt: 'desc' },
  })

  // deduplicate: keep only most recent per metricId
  const seen = new Set<string>()
  return rows.filter((r: any) => {
    if (seen.has(r.metricId)) return false
    seen.add(r.metricId)
    return true
  }).map(toSnapshot)
}

export async function deleteOldSnapshots(olderThanDays: number): Promise<number> {
  const { default: prisma } = await import('../../prisma')
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000)

  const result = await (prisma as any).metricSnapshot.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  return result.count
}
