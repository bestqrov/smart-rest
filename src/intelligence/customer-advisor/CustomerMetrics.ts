// ─── Smart Intelligence Customer Advisor v1 — Customer Metrics (K61) ───────
// The single per-customer aggregation every detector below reuses — no
// duplicate spend/visit calculation. Reuses CafeCustomer's already-tracked
// visits/lastVisit (K19 CRM Foundation, no recompute), the existing Order
// model for spend (same "aggregate in JS, no groupBy on Mongo" convention
// K52/K60 already use), and K20's getTier for loyalty tier.

import prisma from '../../prisma'
import { getTier } from '../../loyalty/LoyaltyService'
import type { CustomerMetric } from './types'

const DEFAULT_WINDOW_DAYS = 180

export async function computeCustomerMetrics(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<CustomerMetric[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const [customers, orders, loyaltyAccounts] = await Promise.all([
    prisma.cafeCustomer.findMany({ where: { cafeId: tenantId } }),
    prisma.order.findMany({
      where:  { cafeId: tenantId, isPaid: true, createdAt: { gte: since }, customerPhone: { not: null } },
      select: { customerPhone: true, totalPrice: true },
    }),
    prisma.loyaltyAccount.findMany({ where: { cafeId: tenantId }, select: { phone: true, lifetimePoints: true } }),
  ])

  const spendByPhone = new Map<string, { totalSpend: number; orderCount: number }>()
  for (const order of orders) {
    const phone = order.customerPhone!
    const entry = spendByPhone.get(phone) ?? { totalSpend: 0, orderCount: 0 }
    entry.totalSpend += order.totalPrice
    entry.orderCount += 1
    spendByPhone.set(phone, entry)
  }

  const loyaltyByPhone = new Map(loyaltyAccounts.map(l => [l.phone, l.lifetimePoints]))
  const now = Date.now()

  return customers.map(customer => {
    const spend = spendByPhone.get(customer.phone) ?? { totalSpend: 0, orderCount: 0 }
    return {
      phone: customer.phone, name: customer.name, visits: customer.visits,
      createdAt: customer.createdAt, lastVisit: customer.lastVisit,
      daysSinceLastVisit: Math.floor((now - customer.lastVisit.getTime()) / (24 * 60 * 60 * 1000)),
      totalSpend: spend.totalSpend, orderCount: spend.orderCount,
      loyaltyTier: getTier(loyaltyByPhone.get(customer.phone) ?? 0),
    }
  })
}
