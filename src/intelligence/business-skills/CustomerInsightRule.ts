// ─── Business Skills Pack v1 — Customer Insight Rule (K52) ─────────────────
// Rule-based only, no LLM. Triggered on OrderCompleted (K11); reads
// CafeCustomer (K19 CRM Foundation) — visits/opt-in already tracked there,
// no new storage.

import prisma from '../../prisma'
import type { InsightRuleDefinition } from '../insights/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const customerInsightRule: InsightRuleDefinition = {
  id:       'customer-insight',
  name:     'Customer Repeat Rate Insight',
  category: 'growth',
  events:   ['OrderCompleted'],
  async evaluate(event) {
    const tenantId = event.tenantId
    if (!tenantId) return null

    const since = new Date(Date.now() - WEEK_MS)
    const [totalCustomers, repeatCustomers] = await Promise.all([
      prisma.cafeCustomer.count({ where: { cafeId: tenantId, lastVisit: { gte: since } } }),
      prisma.cafeCustomer.count({ where: { cafeId: tenantId, lastVisit: { gte: since }, visits: { gt: 1 } } }),
    ])

    if (totalCustomers < 10) return null // not enough weekly customers to compare meaningfully

    const repeatRatePct = Math.round((repeatCustomers / totalCustomers) * 100)
    if (repeatRatePct >= 20) return null // healthy repeat rate — nothing to surface

    return {
      category:    'growth',
      severity:    repeatRatePct < 10 ? 'WARNING' : 'INFO',
      title:       'Low customer repeat rate',
      description: `Only ${repeatRatePct}% of this week's ${totalCustomers} customers are repeat visitors.`,
      metadata:    { totalCustomers, repeatCustomers, repeatRatePct },
    }
  },
}
