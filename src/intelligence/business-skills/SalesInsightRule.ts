// ─── Business Skills Pack v1 — Sales Insight Rule (K52) ────────────────────
// Rule-based only, no LLM. Registered into K36's Insight Engine — this is
// the "missing" business content that Foundation sprint K36 deliberately
// left unshipped. Triggered on OrderCompleted (existing event, K11).

import prisma from '../../prisma'
import type { InsightRuleDefinition } from '../insights/types'

const DAY_MS = 24 * 60 * 60 * 1000

export const salesInsightRule: InsightRuleDefinition = {
  id:       'sales-insight',
  name:     'Sales Volume Insight',
  category: 'operations',
  events:   ['OrderCompleted'],
  async evaluate(event) {
    const tenantId = event.tenantId
    if (!tenantId) return null

    const now = Date.now()
    const [today, previous] = await Promise.all([
      prisma.order.count({ where: { cafeId: tenantId, status: 'COMPLETED', createdAt: { gte: new Date(now - DAY_MS) } } }),
      prisma.order.count({ where: { cafeId: tenantId, status: 'COMPLETED', createdAt: { gte: new Date(now - 2 * DAY_MS), lt: new Date(now - DAY_MS) } } }),
    ])

    if (previous < 5) return null // not enough baseline to compare

    const changePct = Math.round(((today - previous) / previous) * 100)
    if (changePct > -25) return null // only surface meaningful declines

    return {
      category:    'operations',
      severity:    changePct <= -50 ? 'CRITICAL' : 'WARNING',
      title:       'Sales volume dropped',
      description: `Completed orders fell ${Math.abs(changePct)}% (${today} today vs ${previous} the prior 24h).`,
      metadata:    { today, previous, changePct },
    }
  },
}
