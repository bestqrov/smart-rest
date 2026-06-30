// ─── Billing Platform — Plan Catalog Service ───────────────────────────────

import { PLAN_DEFINITIONS, getPlan, listPlans } from '../../tenant/plans'
import type { Plan, PlanDefinition }             from '../../tenant/types'

export type { Plan, PlanDefinition }

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export interface PlanWithPricing extends PlanDefinition {
  pricing: Record<string, { price: number; currency: string }>
}

export async function getPlanWithPricing(plan: Plan): Promise<PlanWithPricing> {
  const prisma = await getPrisma()
  const def    = getPlan(plan)

  const premiumRows = await (prisma as any).premiumPlan.findMany({})
  const pricing: Record<string, { price: number; currency: string }> = {}
  for (const row of premiumRows) {
    pricing[row.country] = { price: row.monthlyPrice, currency: row.currency }
  }

  return { ...def, pricing }
}

export async function listPlansWithPricing(): Promise<PlanWithPricing[]> {
  const plans = listPlans()
  return Promise.all(plans.map(p => getPlanWithPricing(p.name)))
}

export async function getPriceForTenant(
  plan: Plan,
  country: string,
): Promise<{ price: number; currency: string } | null> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).premiumPlan.findUnique({ where: { country } })
  if (!row) return null
  if (plan === 'FREE') return { price: 0, currency: row.currency }
  return { price: row.monthlyPrice, currency: row.currency }
}

export { getPlan, listPlans, PLAN_DEFINITIONS }
