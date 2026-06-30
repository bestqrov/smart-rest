// ─── Billing Subscriptions — Repository ───────────────────────────────────

import type { BillingSubscription, CreateSubscriptionInput, SubscriptionStatus, SubscriptionWithPlan } from './SubscriptionTypes'

async function db() {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).billingSubscription
}

function toModel(row: any): BillingSubscription {
  return {
    id: row.id, tenantId: row.tenantId, planId: row.planId,
    planCode: row.planCode, planName: row.planName,
    status: row.status as SubscriptionStatus,
    startDate:   row.startDate,
    endDate:     row.endDate   ?? null,
    renewalDate: row.renewalDate ?? null,
    trialEndsAt: row.trialEndsAt ?? null,
    cancelledAt: row.cancelledAt ?? null,
    graceEndsAt: row.graceEndsAt ?? null,
    autoRenew:   row.autoRenew,
    notes:       row.notes ?? null,
    createdAt:   row.createdAt,
    updatedAt:   row.updatedAt,
  }
}

export async function create(input: CreateSubscriptionInput): Promise<BillingSubscription> {
  const col = await db()
  const row = await col.create({
    data: {
      tenantId:    input.tenantId,
      planId:      input.planId,
      planCode:    input.planCode,
      planName:    input.planName,
      status:      input.status,
      startDate:   input.startDate,
      endDate:     input.endDate,
      renewalDate: input.renewalDate,
      trialEndsAt: input.trialEndsAt,
      autoRenew:   input.autoRenew ?? true,
      notes:       input.notes,
    },
  })
  return toModel(row)
}

export async function update(id: string, data: Partial<{
  status: SubscriptionStatus; planId: string; planCode: string; planName: string
  endDate: Date | null; renewalDate: Date | null; trialEndsAt: Date | null
  cancelledAt: Date | null; graceEndsAt: Date | null; autoRenew: boolean; notes: string | null
}>): Promise<BillingSubscription> {
  const col = await db()
  const row = await col.update({ where: { id }, data })
  return toModel(row)
}

export async function findById(id: string): Promise<BillingSubscription | null> {
  const col = await db()
  const row = await col.findUnique({ where: { id } })
  return row ? toModel(row) : null
}

// Returns the most recent non-terminal subscription for a tenant
export async function findActiveByTenant(tenantId: string): Promise<BillingSubscription | null> {
  const col = await db()
  const row = await col.findFirst({
    where: { tenantId, status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED'] } },
    orderBy: { createdAt: 'desc' },
  })
  return row ? toModel(row) : null
}

// Returns all subscriptions for a tenant (history)
export async function findAllByTenant(tenantId: string): Promise<BillingSubscription[]> {
  const col  = await db()
  const rows = await col.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  return rows.map(toModel)
}

export async function findAll(filter: {
  status?:   SubscriptionStatus
  tenantId?: string
  planCode?: string
  page?:     number
  limit?:    number
}): Promise<{ subscriptions: BillingSubscription[]; total: number; page: number; pages: number }> {
  const col   = await db()
  const page  = Math.max(1, filter.page  ?? 1)
  const limit = Math.min(100, filter.limit ?? 20)
  const skip  = (page - 1) * limit
  const where: any = {}
  if (filter.status)   where.status   = filter.status
  if (filter.tenantId) where.tenantId = filter.tenantId
  if (filter.planCode) where.planCode = filter.planCode

  const [rows, total] = await Promise.all([
    col.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    col.count({ where }),
  ])
  return { subscriptions: rows.map(toModel), total, page, pages: Math.ceil(total / limit) }
}

// Returns subscription enriched with plan data
export async function findWithPlan(id: string): Promise<SubscriptionWithPlan | null> {
  const { default: prisma } = await import('../../prisma')
  const sub = await (prisma as any).billingSubscription.findUnique({ where: { id } })
  if (!sub) return null

  const plan = await (prisma as any).billingPlan.findUnique({ where: { id: sub.planId } }).catch(() => null)
  return { ...toModel(sub), plan: plan ?? null }
}

// Returns count of active subscriptions for a plan (used by plan delete guard)
export async function countByPlan(planCode: string): Promise<number> {
  const col = await db()
  return col.count({
    where: { planCode, status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'] } },
  })
}
