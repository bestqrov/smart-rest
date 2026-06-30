// ─── Billing Plans — Validation ────────────────────────────────────────────

import { findByCode, findById, countActiveSubscriptions } from './PlanRepository'
import type { CreatePlanInput, UpdatePlanInput } from './PlanTypes'

export class PlanValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'PlanValidationError' }
}

export async function validateCreate(input: CreatePlanInput): Promise<void> {
  if (!input.name?.trim())  throw new PlanValidationError('Name is required')
  if (!input.code?.trim())  throw new PlanValidationError('Code is required')
  if (input.monthlyPrice < 0) throw new PlanValidationError('Monthly price cannot be negative')

  const existing = await findByCode(input.code.toUpperCase())
  if (existing) throw new PlanValidationError(`Plan with code "${input.code}" already exists`)
}

export async function validateUpdate(id: string, input: UpdatePlanInput): Promise<void> {
  const plan = await findById(id)
  if (!plan) throw new PlanValidationError('Plan not found')

  if (input.monthlyPrice !== undefined && input.monthlyPrice < 0) {
    throw new PlanValidationError('Monthly price cannot be negative')
  }

  if (input.code) {
    const existing = await findByCode(input.code.toUpperCase())
    if (existing && existing.id !== id) {
      throw new PlanValidationError(`Plan with code "${input.code}" already exists`)
    }
  }
}

export async function validateDelete(id: string): Promise<void> {
  const plan = await findById(id)
  if (!plan) throw new PlanValidationError('Plan not found')

  if (plan.isDefault) throw new PlanValidationError('Cannot delete the default plan')

  const activeCount = await countActiveSubscriptions(plan.code)
  if (activeCount > 0) {
    throw new PlanValidationError(
      `Cannot delete plan "${plan.code}" — it has ${activeCount} active subscription(s)`
    )
  }
}
