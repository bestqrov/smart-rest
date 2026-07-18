// ─── Billing Subscriptions — Events ───────────────────────────────────────

import { eventBus } from '../../core'
import type { BillingSubscription } from './SubscriptionTypes'

function payload(sub: BillingSubscription, extra?: Record<string, unknown>) {
  return {
    subscriptionId: sub.id, tenantId: sub.tenantId,
    planCode: sub.planCode, planName: sub.planName, status: sub.status,
    ...extra,
  }
}

export function emitSubscriptionCreated(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionCreated', payload(sub), 'subscription-engine')
}

export function emitSubscriptionActivated(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionActivated', payload(sub), 'subscription-engine')
}

export function emitSubscriptionRenewed(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionRenewed', payload(sub), 'subscription-engine')
}

export function emitSubscriptionSuspended(sub: BillingSubscription, reason?: string): void {
  eventBus.publish('SubscriptionSuspended', payload(sub, reason ? { reason } : undefined), 'subscription-engine')
}

export function emitSubscriptionCancelled(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionCancelled', payload(sub), 'subscription-engine')
}

export function emitSubscriptionExpired(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionExpired', payload(sub), 'subscription-engine')
}

export function emitPlanChanged(sub: BillingSubscription, previousPlanCode: string): void {
  eventBus.publish('PlanChanged', payload(sub, { previousPlanCode }), 'subscription-engine')
}

// Matches the pre-existing 'TrialEnding' payload shape BillingEventNotificationHub
// already subscribes to (tenantId, subscriptionId, daysLeft) — reused, not a new event.
export function emitTrialEnding(sub: BillingSubscription, daysLeft: number): void {
  eventBus.publish('TrialEnding', payload(sub, { daysLeft }), 'subscription-engine')
}
