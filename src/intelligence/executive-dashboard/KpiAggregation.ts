// ─── Smart Intelligence Executive Dashboard — KPI Aggregation (K55) ────────
// Reuses the Analytics Engine's own getPlatformSummary — no second metric
// aggregation pipeline.

import { getPlatformSummary } from '../../analytics'
import type { ExecutiveKpi } from './types'

export async function getExecutiveKpis(tenantId: string): Promise<ExecutiveKpi[]> {
  const summary = await getPlatformSummary('30d', tenantId)

  return summary.metrics
    .filter(m => m.result.value !== null)
    .map(m => ({
      metricId: m.definition.id,
      module:   m.definition.module,
      name:     m.definition.name,
      value:    m.result.value,
      unit:     m.definition.unit,
      trend:    m.result.trend,
    }))
}
