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
// MRR = sum of the active BillingPlan.monthlyPrice for every tenant whose
// TenantProfile.state is ACTIVE, matched by plan code (uppercased).
export async function getMRR(): Promise<MRRResult> {
  const prisma = await getPrisma()

  const [plans, activeTenants] = await Promise.all([
    (prisma as any).billingPlan.findMany({ where: { isActive: true } }),
    (prisma as any).tenantProfile.findMany({ where: { state: 'ACTIVE' }, select: { plan: true } }),
  ])

  const priceByCode: Record<string, { price: number; currency: string }> = {}
  let currency = 'MAD'
  for (const plan of plans) {
    priceByCode[String(plan.code).toUpperCase()] = { price: plan.monthlyPrice, currency: plan.currency }
    currency = plan.currency
  }

  const byPlan: Record<string, number> = {}
  let mrr = 0
  for (const tenant of activeTenants) {
    const code  = String(tenant.plan).toUpperCase()
    const price = priceByCode[code]?.price ?? 0
    byPlan[code] = (byPlan[code] ?? 0) + price
    mrr += price
  }

  return { mrr, currency, byPlan }
}

// ─── Subscription Counts ───────────────────────────────────────────────────
// Expired = tenants in GRACE_PERIOD (trial/billing period ended, awaiting renewal or suspension).
export async function getSubscriptionCounts(): Promise<SubscriptionCounts> {
  const prisma = await getPrisma()

  const [active, trial, expired] = await Promise.all([
    (prisma as any).tenantProfile.count({ where: { state: 'ACTIVE' } }),
    (prisma as any).tenantProfile.count({ where: { state: 'TRIAL' } }),
    (prisma as any).tenantProfile.count({ where: { state: 'GRACE_PERIOD' } }),
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
