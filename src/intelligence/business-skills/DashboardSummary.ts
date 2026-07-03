// ─── Business Skills Pack v1 — Dashboard Summary (K52) ─────────────────────
// Aggregates existing Insight rows (K36 listInsights) — no new storage, no
// recomputation of what the rules above already wrote.

import { listInsights } from '../insights'
import type { InsightCategory } from '../insights/types'

export interface BusinessInsightsSummary {
  tenantId:      string
  totalOpen:     number
  bySeverity:    { CRITICAL: number; WARNING: number; INFO: number }
  byCategory:    Partial<Record<InsightCategory, number>>
  recent:        { id: string; category: string; severity: string; title: string; createdAt: Date }[]
  generatedAt:   Date
}

export async function getBusinessInsightsSummary(tenantId: string): Promise<BusinessInsightsSummary> {
  const open = await listInsights(tenantId, 'NEW')

  const bySeverity = { CRITICAL: 0, WARNING: 0, INFO: 0 }
  const byCategory: Partial<Record<InsightCategory, number>> = {}

  for (const insight of open) {
    const severity = insight.severity as keyof typeof bySeverity
    if (severity in bySeverity) bySeverity[severity] += 1

    const category = insight.category as InsightCategory
    byCategory[category] = (byCategory[category] ?? 0) + 1
  }

  return {
    tenantId,
    totalOpen: open.length,
    bySeverity,
    byCategory,
    recent: open.slice(0, 10).map(i => ({ id: i.id, category: i.category, severity: i.severity, title: i.title, createdAt: i.createdAt })),
    generatedAt: new Date(),
  }
}
