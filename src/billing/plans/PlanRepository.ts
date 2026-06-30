// ─── Billing Plans — Repository ────────────────────────────────────────────

import type { BillingPlan, CreatePlanInput, UpdatePlanInput } from './PlanTypes'

async function db() {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).billingPlan
}

function toModel(row: any): BillingPlan {
  return {
    id: row.id, name: row.name, code: row.code,
    description: row.description ?? null,
    monthlyPrice: row.monthlyPrice, yearlyPrice: row.yearlyPrice,
    currency: row.currency, isActive: row.isActive, isDefault: row.isDefault,
    displayOrder: row.displayOrder, maxUsers: row.maxUsers,
    maxStorageGB: row.maxStorageGB, aiCredits: row.aiCredits,
    marketplaceEnabled: row.marketplaceEnabled, automationEnabled: row.automationEnabled,
    certificationEnabled: row.certificationEnabled, apiAccess: row.apiAccess,
    supportLevel: row.supportLevel, createdAt: row.createdAt, updatedAt: row.updatedAt,
  }
}

export async function findAll(filter?: { isActive?: boolean }): Promise<BillingPlan[]> {
  const col   = await db()
  const where: any = {}
  if (filter?.isActive !== undefined) where.isActive = filter.isActive
  const rows  = await col.findMany({ where, orderBy: { displayOrder: 'asc' } })
  return rows.map(toModel)
}

export async function findById(id: string): Promise<BillingPlan | null> {
  const col = await db()
  const row = await col.findUnique({ where: { id } })
  return row ? toModel(row) : null
}

export async function findByCode(code: string): Promise<BillingPlan | null> {
  const col = await db()
  const row = await col.findUnique({ where: { code } })
  return row ? toModel(row) : null
}

export async function findDefault(): Promise<BillingPlan | null> {
  const col = await db()
  const row = await col.findFirst({ where: { isDefault: true } })
  return row ? toModel(row) : null
}

export async function create(input: CreatePlanInput): Promise<BillingPlan> {
  const col = await db()
  const row = await col.create({
    data: {
      name: input.name, code: input.code.toUpperCase(),
      description: input.description,
      monthlyPrice: input.monthlyPrice, yearlyPrice: input.yearlyPrice ?? 0,
      currency: input.currency ?? 'MAD',
      isActive: input.isActive ?? true, isDefault: input.isDefault ?? false,
      displayOrder: input.displayOrder ?? 0,
      maxUsers: input.maxUsers ?? 5, maxStorageGB: input.maxStorageGB ?? 10,
      aiCredits: input.aiCredits ?? 0,
      marketplaceEnabled: input.marketplaceEnabled ?? false,
      automationEnabled: input.automationEnabled ?? false,
      certificationEnabled: input.certificationEnabled ?? false,
      apiAccess: input.apiAccess ?? false,
      supportLevel: input.supportLevel ?? 'COMMUNITY',
    },
  })
  return toModel(row)
}

export async function update(id: string, input: UpdatePlanInput): Promise<BillingPlan> {
  const col = await db()
  const data: any = { ...input }
  if (data.code) data.code = data.code.toUpperCase()
  const row = await col.update({ where: { id }, data })
  return toModel(row)
}

export async function remove(id: string): Promise<void> {
  const col = await db()
  await col.delete({ where: { id } })
}

export async function unsetAllDefaults(): Promise<void> {
  const col = await db()
  await col.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
}

export async function countActiveSubscriptions(planCode: string): Promise<number> {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).tenantProfile.count({
    where: { plan: planCode, state: { in: ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'] } },
  })
}
