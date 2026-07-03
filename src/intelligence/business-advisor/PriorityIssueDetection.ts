// ─── Business Advisor v1 — Priority Issue Detection (K53) ──────────────────
// Reuses K36's Insight Engine directly — no second issue store.

import { listInsights } from '../insights'
import type { PriorityIssue } from './types'

const SEVERITY_WEIGHT: Record<string, number> = { CRITICAL: 2, WARNING: 1, INFO: 0 }

export async function detectPriorityIssues(tenantId: string, limit = 5): Promise<PriorityIssue[]> {
  const openInsights = await listInsights(tenantId, 'NEW')

  return openInsights
    .filter(i => i.severity === 'CRITICAL' || i.severity === 'WARNING')
    .sort((a, b) => {
      const bySeverity = (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0)
      return bySeverity !== 0 ? bySeverity : b.createdAt.getTime() - a.createdAt.getTime()
    })
    .slice(0, limit)
    .map(i => ({ id: i.id, category: i.category, severity: i.severity, title: i.title, description: i.description, createdAt: i.createdAt }))
}
