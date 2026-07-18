// ─── Billing Platform — Revenue Metrics Service ────────────────────────────
// Read-only aggregations over existing Subscription / Payment data.

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export interface MRRResult {
  mrr:      number
  currency: string
  byPlan:   Record<string, number>
}

export interface SubscriptionCounts {
  active:  number
  trial:   number
  expired: number
}

export interface RevenueDashboard {
  mrr:                 number
  currency:             string
  mrrByPlan:            Record<string, number>
  activeSubscriptions:  number
  trialSubscriptions:   number
  expiredSubscriptions: number
  failedPayments:       number
}

// ─── Monthly Recurring Revenue ─────────────────────────────────────────────
// MRR = sum of the active BillingPlan.monthlyPrice for every BillingSubscription
// whose status is ACTIVE, matched by plan code (uppercased). BillingSubscription
// is the single source of truth for subscription state — not TenantProfile,
// which tracks a separate, platform-level access concern.
export async function getMRR(): Promise<MRRResult> {
  const prisma = await getPrisma()

  const [plans, activeSubscriptions] = await Promise.all([
    (prisma as any).billingPlan.findMany({ where: { isActive: true } }),
    (prisma as any).billingSubscription.findMany({ where: { status: 'ACTIVE' }, select: { planCode: true } }),
  ])

  const priceByCode: Record<string, { price: number; currency: string }> = {}
  let currency = 'MAD'
  for (const plan of plans) {
    priceByCode[String(plan.code).toUpperCase()] = { price: plan.monthlyPrice, currency: plan.currency }
    currency = plan.currency
  }

  const byPlan: Record<string, number> = {}
  let mrr = 0
  for (const sub of activeSubscriptions) {
    const code  = String(sub.planCode).toUpperCase()
    const price = priceByCode[code]?.price ?? 0
    byPlan[code] = (byPlan[code] ?? 0) + price
    mrr += price
  }

  return { mrr, currency, byPlan }
}

// ─── Subscription Counts ───────────────────────────────────────────────────
// Counted directly off BillingSubscription.status. "Expired" now means the
// terminal EXPIRED status (the engine has a dedicated status for this), not
// GRACE_PERIOD as the old TenantProfile-based version approximated it.
export async function getSubscriptionCounts(): Promise<SubscriptionCounts> {
  const prisma = await getPrisma()

  const [active, trial, expired] = await Promise.all([
    (prisma as any).billingSubscription.count({ where: { status: 'ACTIVE' } }),
    (prisma as any).billingSubscription.count({ where: { status: 'TRIAL' } }),
    (prisma as any).billingSubscription.count({ where: { status: 'EXPIRED' } }),
  ])

  return { active, trial, expired }
}

// ─── Failed Payments ────────────────────────────────────────────────────────
export async function getFailedPaymentsCount(): Promise<number> {
  const prisma = await getPrisma()
  return (prisma as any).paymentTransaction.count({ where: { status: 'FAILED' } })
}

// ─── Combined Revenue Dashboard ─────────────────────────────────────────────
export async function getRevenueDashboard(): Promise<RevenueDashboard> {
  const [mrrResult, counts, failedPayments] = await Promise.all([
    getMRR(),
    getSubscriptionCounts(),
    getFailedPaymentsCount(),
  ])

  return {
    mrr:                  mrrResult.mrr,
    currency:             mrrResult.currency,
    mrrByPlan:            mrrResult.byPlan,
    activeSubscriptions:  counts.active,
    trialSubscriptions:   counts.trial,
    expiredSubscriptions: counts.expired,
    failedPayments,
  }
}
