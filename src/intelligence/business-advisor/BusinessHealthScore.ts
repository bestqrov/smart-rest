// ─── Business Advisor v1 — Daily Business Health Score (K53) ───────────────
// Rule-based scoring over existing Insight rows (K36 listInsights) — no
// new data source, no ML.

import { listInsights } from '../insights'
import type { BusinessHealthScore } from './types'

export async function computeBusinessHealthScore(tenantId: string): Promise<BusinessHealthScore> {
  const openInsights = await listInsights(tenantId, 'NEW')

  const criticalIssues = openInsights.filter(i => i.severity === 'CRITICAL').length
  const warningIssues  = openInsights.filter(i => i.severity === 'WARNING').length
  const infoIssues     = openInsights.filter(i => i.severity === 'INFO').length

  const score = Math.max(0, 100 - criticalIssues * 15 - warningIssues * 7 - infoIssues * 2)

  const label: BusinessHealthScore['label'] =
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Attention'

  return { score, label, breakdown: { criticalIssues, warningIssues, infoIssues } }
}
