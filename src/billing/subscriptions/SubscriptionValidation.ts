// ─── Billing Subscriptions — Validation ───────────────────────────────────

import { findActiveByTenant } from './SubscriptionRepository'
import type { BillingSubscription, SubscriptionStatus } from './SubscriptionTypes'

export class SubscriptionError extends Error {
  constructor(message: string) { super(message); this.name = 'SubscriptionError' }
}

// Valid state transitions
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIAL:        ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  ACTIVE:       ['GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'EXPIRED'],
  GRACE_PERIOD: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  SUSPENDED:    ['ACTIVE', 'CANCELLED'],
  CANCELLED:    [],
  EXPIRED:      [],
}

export function assertTransition(current: SubscriptionStatus, next: SubscriptionStatus): void {
  const allowed = VALID_TRANSITIONS[current] ?? []
  if (!allowed.includes(next)) {
    throw new SubscriptionError(
      `Invalid transition: ${current} → ${next}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`
    )
  }
}

export async function assertOneActivePerTenant(tenantId: string, excludeId?: string): Promise<void> {
  const existing = await findActiveByTenant(tenantId)
  if (existing && existing.id !== excludeId) {
    throw new SubscriptionError(
      `Tenant ${tenantId} already has an active subscription (${existing.status})`
    )
  }
}

export function assertNotTerminal(sub: BillingSubscription): void {
  if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
    throw new SubscriptionError(
      `Cannot modify a ${sub.status} subscription`
    )
  }
}

export function assertTrialNotRestarted(sub: BillingSubscription, targetStatus: SubscriptionStatus): void {
  if (targetStatus === 'TRIAL' && sub.status !== 'TRIAL') {
    throw new SubscriptionError('Trial cannot be restarted on an existing subscription')
  }
}
