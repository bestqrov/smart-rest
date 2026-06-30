// ─── Billing Plans — Service ───────────────────────────────────────────────

import * as Repo       from './PlanRepository'
import * as Validation from './PlanValidation'
import * as Events     from './PlanEvents'
import { AuditService } from '../../core'
import type { BillingPlan, CreatePlanInput, UpdatePlanInput } from './PlanTypes'

async function audit(action: string, entityId: string, performedBy: string, meta?: Record<string, unknown>) {
  await AuditService.createAudit({
    module:      'BILLING_PLANS',
    entity:      'BillingPlan',
    entityId,
    action,
    performedBy,
    metadata:    meta,
  }).catch(() => undefined)
}

export async function listPlans(filter?: { isActive?: boolean }): Promise<BillingPlan[]> {
  return Repo.findAll(filter)
}

export async function getPlan(id: string): Promise<BillingPlan | null> {
  return Repo.findById(id)
}

export async function createPlan(input: CreatePlanInput, by: string): Promise<BillingPlan> {
  await Validation.validateCreate(input)
  if (input.isDefault) await Repo.unsetAllDefaults()
  const plan = await Repo.create(input)
  Events.emitPlanCreated(plan)
  await audit('CREATE', plan.id, by, { code: plan.code, name: plan.name })
  return plan
}

export async function updatePlan(id: string, input: UpdatePlanInput, by: string): Promise<BillingPlan> {
  await Validation.validateUpdate(id, input)
  if (input.isDefault === true) await Repo.unsetAllDefaults()
  const plan = await Repo.update(id, input)
  Events.emitPlanUpdated(plan, input as Record<string, unknown>)
  await audit('UPDATE', id, by, input as Record<string, unknown>)
  return plan
}

export async function deletePlan(id: string, by: string): Promise<void> {
  const plan = await Repo.findById(id)
  if (!plan) throw new Validation.PlanValidationError('Plan not found')
  await Validation.validateDelete(id)
  await Repo.remove(id)
  Events.emitPlanDeleted(id, plan.code)
  await audit('DELETE', id, by, { code: plan.code })
}

export async function duplicatePlan(id: string, by: string): Promise<BillingPlan> {
  const source = await Repo.findById(id)
  if (!source) throw new Validation.PlanValidationError('Plan not found')

  const newCode = `${source.code}_COPY_${Date.now()}`
  const newPlan = await Repo.create({
    name:                 `${source.name} (Copy)`,
    code:                 newCode,
    description:          source.description ?? undefined,
    monthlyPrice:         source.monthlyPrice,
    yearlyPrice:          source.yearlyPrice,
    currency:             source.currency,
    isActive:             false,
    isDefault:            false,
    displayOrder:         source.displayOrder + 1,
    maxUsers:             source.maxUsers,
    maxStorageGB:         source.maxStorageGB,
    aiCredits:            source.aiCredits,
    marketplaceEnabled:   source.marketplaceEnabled,
    automationEnabled:    source.automationEnabled,
    certificationEnabled: source.certificationEnabled,
    apiAccess:            source.apiAccess,
    supportLevel:         source.supportLevel,
  })
  Events.emitPlanCreated(newPlan)
  await audit('DUPLICATE', newPlan.id, by, { sourceId: id, sourceCode: source.code })
  return newPlan
}

export async function activatePlan(id: string, by: string): Promise<BillingPlan> {
  const plan = await Repo.update(id, { isActive: true })
  Events.emitPlanActivated(plan)
  await audit('ACTIVATE', id, by)
  return plan
}

export async function deactivatePlan(id: string, by: string): Promise<BillingPlan> {
  const existing = await Repo.findById(id)
  if (existing?.isDefault) throw new Validation.PlanValidationError('Cannot deactivate the default plan')
  const plan = await Repo.update(id, { isActive: false })
  Events.emitPlanDeactivated(plan)
  await audit('DEACTIVATE', id, by)
  return plan
}

export async function setDefaultPlan(id: string, by: string): Promise<BillingPlan> {
  await Repo.unsetAllDefaults()
  const plan = await Repo.update(id, { isDefault: true, isActive: true })
  await audit('SET_DEFAULT', id, by)
  return plan
}
