// ─── Billing Plans — Events ────────────────────────────────────────────────

import { eventBus } from '../../core'
import type { BillingPlan } from './PlanTypes'

export function emitPlanCreated(plan: BillingPlan): void {
  eventBus.publish('PlanCreated', { planId: plan.id, code: plan.code, name: plan.name }, 'billing-plans')
}

export function emitPlanUpdated(plan: BillingPlan, changes: Record<string, unknown>): void {
  eventBus.publish('PlanUpdated', { planId: plan.id, code: plan.code, changes }, 'billing-plans')
}

export function emitPlanDeleted(planId: string, code: string): void {
  eventBus.publish('PlanDeleted', { planId, code }, 'billing-plans')
}

export function emitPlanActivated(plan: BillingPlan): void {
  eventBus.publish('PlanActivated', { planId: plan.id, code: plan.code }, 'billing-plans')
}

export function emitPlanDeactivated(plan: BillingPlan): void {
  eventBus.publish('PlanDeactivated', { planId: plan.id, code: plan.code }, 'billing-plans')
}
