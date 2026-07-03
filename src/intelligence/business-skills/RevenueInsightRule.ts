// ─── Business Skills Pack v1 — Revenue Insight Rule (K52) ──────────────────
// Rule-based only, no LLM. Triggered on OrderCompleted (K11).

import prisma from '../../prisma'
import type { InsightRuleDefinition } from '../insights/types'

const DAY_MS = 24 * 60 * 60 * 1000

async function revenueSince(cafeId: string, from: Date, to?: Date): Promise<number> {
  const agg = await (prisma.order as any).aggregate({
    where: { cafeId, isPaid: true, createdAt: { gte: from, ...(to ? { lt: to } : {}) } },
    _sum: { totalPrice: true },
  })
  return agg._sum?.totalPrice ?? 0
}

export const revenueInsightRule: InsightRuleDefinition = {
  id:       'revenue-insight',
  name:     'Revenue Trend Insight',
  category: 'growth',
  events:   ['OrderCompleted'],
  async evaluate(event) {
    const tenantId = event.tenantId
    if (!tenantId) return null

    const now = Date.now()
    const [today, previous] = await Promise.all([
      revenueSince(tenantId, new Date(now - DAY_MS)),
      revenueSince(tenantId, new Date(now - 2 * DAY_MS), new Date(now - DAY_MS)),
    ])

    if (previous < 100) return null // not enough baseline revenue to compare meaningfully

    const changePct = Math.round(((today - previous) / previous) * 100)
    if (changePct > -20) return null

    return {
      category:    'growth',
      severity:    changePct <= -40 ? 'CRITICAL' : 'WARNING',
      title:       'Revenue trending down',
      description: `Revenue fell ${Math.abs(changePct)}% (${Math.round(today)} today vs ${Math.round(previous)} the prior 24h).`,
      metadata:    { today, previous, changePct },
    }
  },
}
