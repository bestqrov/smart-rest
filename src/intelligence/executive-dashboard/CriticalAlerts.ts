// ─── Smart Intelligence Executive Dashboard — Critical Alerts (K55) ────────
// Combines K51's error aggregation (filtered to this tenant — that
// function is platform-wide by design, filtering here adds no new
// aggregation) with K36's CRITICAL insights — no new alert store.

import { getRecentIntelligenceErrors } from '../observability'
import { listInsights } from '../insights'
import type { ExecutiveCriticalAlert } from './types'

export async function getCriticalAlerts(tenantId: string, limit = 10): Promise<ExecutiveCriticalAlert[]> {
  const [errors, criticalInsights] = await Promise.all([
    getRecentIntelligenceErrors(),
    listInsights(tenantId, 'NEW', 'CRITICAL'),
  ])

  const tenantErrors: ExecutiveCriticalAlert[] = errors
    .filter(e => e.tenantId === tenantId)
    .map(e => ({ eventName: e.eventName, module: e.module, resourceId: e.resourceId, timestamp: e.timestamp, message: e.message }))

  const insightAlerts: ExecutiveCriticalAlert[] = criticalInsights.map(i => ({
    eventName: 'IntelInsightCreated', module: i.category, resourceId: i.id, timestamp: i.createdAt, message: i.title,
  }))

  return [...tenantErrors, ...insightAlerts]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}
