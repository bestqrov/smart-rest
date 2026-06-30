// ─── Billing Platform — Subscription Service ──────────────────────────────
// Wraps tenant lifecycle transitions and fires billing events.

import type { Plan, AssignPlanInput, SuspendInput, SuspensionType, TenantProfile } from '../../tenant/types'
import { ensureProfile, getProfile }  from '../../tenant/provisioning/ProvisioningService'
import { activate, startTrial, assignPlan, cancel } from '../../tenant/lifecycle/LifecycleService'
import { suspend, reactivate }        from '../../tenant/suspension/SuspensionService'
import {
  emitSubscriptionCreated,
  emitSubscriptionRenewed,
  emitSubscriptionCancelled,
} from '../events/BillingEvents'
import {
  notifySubscriptionSuspended,
  notifySubscriptionRenewed,
} from '../notifications/BillingNotifications'

// ─── Create Subscription ──────────────────────────────────────────────────────
export async function createSubscription(
  tenantId: string,
  module:   string,
  plan:     Plan,
): Promise<TenantProfile> {
  await ensureProfile(tenantId)
  const input: AssignPlanInput = { plan }
  await assignPlan(tenantId, input)
  const profile = await activate(tenantId)
  await emitSubscriptionCreated({ tenantId, module, plan, metadata: { action: 'createSubscription' } as any }).catch(() => undefined)
  return profile
}

// ─── Start Trial Subscription ─────────────────────────────────────────────────
export async function startTrialSubscription(
  tenantId: string,
  module:   string,
  plan:     Plan,
): Promise<TenantProfile> {
  await ensureProfile(tenantId)
  const input: AssignPlanInput = { plan }
  await assignPlan(tenantId, input)
  const profile = await startTrial(tenantId, plan)
  await emitSubscriptionCreated({ tenantId, module, plan, metadata: { action: 'startTrialSubscription' } as any }).catch(() => undefined)
  return profile
}

// ─── Renew Subscription ───────────────────────────────────────────────────────
export async function renewSubscription(
  tenantId: string,
  module:   string,
): Promise<TenantProfile> {
  const existing = await getProfile(tenantId)
  const plan     = existing?.plan ?? 'FREE'
  const profile  = await activate(tenantId)
  await emitSubscriptionRenewed({ tenantId, module, plan, metadata: { action: 'renewSubscription' } as any }).catch(() => undefined)
  await notifySubscriptionRenewed(tenantId, plan).catch(() => undefined)
  return profile
}

// ─── Cancel Subscription ──────────────────────────────────────────────────────
export async function cancelSubscription(
  tenantId: string,
  module:   string,
): Promise<TenantProfile> {
  const existing = await getProfile(tenantId)
  const plan     = existing?.plan ?? 'FREE'
  const profile  = await cancel(tenantId)
  await emitSubscriptionCancelled({ tenantId, module, plan, metadata: { action: 'cancelSubscription' } as any }).catch(() => undefined)
  return profile
}

// ─── Suspend Subscription ─────────────────────────────────────────────────────
export async function suspendSubscription(
  tenantId: string,
  module:   string,
  reason:   string,
  by?:      string,
): Promise<TenantProfile> {
  const input: SuspendInput = {
    type:        'BILLING' as SuspensionType,
    reason,
    suspendedBy: by,
  }
  const profile = await suspend(tenantId, input)
  await notifySubscriptionSuspended(tenantId, reason).catch(() => undefined)
  return profile
}

// ─── Reactivate Subscription ──────────────────────────────────────────────────
export async function reactivateSubscription(
  tenantId: string,
  by?:      string,
): Promise<TenantProfile> {
  return reactivate(tenantId, by)
}

// ─── Change Plan ──────────────────────────────────────────────────────────────
export async function changePlan(
  tenantId: string,
  module:   string,
  newPlan:  Plan,
): Promise<TenantProfile> {
  const input: AssignPlanInput = { plan: newPlan }
  const profile = await assignPlan(tenantId, input)
  await emitSubscriptionRenewed({ tenantId, module, plan: newPlan, metadata: { action: 'changePlan' } as any }).catch(() => undefined)
  return profile
}

// ─── Get Subscription ─────────────────────────────────────────────────────────
export async function getSubscription(
  tenantId: string,
): Promise<TenantProfile | null> {
  return getProfile(tenantId)
}
