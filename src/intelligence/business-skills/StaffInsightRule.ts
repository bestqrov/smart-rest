// ─── Business Skills Pack v1 — Staff Insight Rule (K52) ────────────────────
// Rule-based only, no LLM. Triggered on PosOrderClosed (K11 POS Core,
// existing event) — reads Staff/Order, no new storage.

import prisma from '../../prisma'
import type { InsightRuleDefinition } from '../insights/types'

const HOUR_MS = 60 * 60 * 1000

export const staffInsightRule: InsightRuleDefinition = {
  id:       'staff-insight',
  name:     'Staff Workload Insight',
  category: 'operations',
  events:   ['PosOrderClosed'],
  async evaluate(event) {
    const tenantId = event.tenantId
    if (!tenantId) return null

    const [onDutyCount, recentOrders] = await Promise.all([
      prisma.staff.count({ where: { cafeId: tenantId, isActive: true, shiftStatus: 'ACTIVE' } }),
      prisma.order.count({ where: { cafeId: tenantId, createdAt: { gte: new Date(Date.now() - HOUR_MS) } } }),
    ])

    if (recentOrders < 5) return null // not enough hourly volume to assess load

    if (onDutyCount === 0) {
      return {
        category:    'operations',
        severity:    'CRITICAL',
        title:       'Orders coming in with no staff clocked in',
        description: `${recentOrders} order(s) in the last hour but 0 staff currently on duty.`,
        metadata:    { onDutyCount, recentOrders },
      }
    }

    const ordersPerStaff = Math.round(recentOrders / onDutyCount)
    if (ordersPerStaff < 15) return null

    return {
      category:    'operations',
      severity:    ordersPerStaff >= 25 ? 'CRITICAL' : 'WARNING',
      title:       'High staff workload',
      description: `${onDutyCount} staff on duty handling ${recentOrders} orders in the last hour (~${ordersPerStaff}/staff).`,
      metadata:    { onDutyCount, recentOrders, ordersPerStaff },
    }
  },
}
