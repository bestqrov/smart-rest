import { eventBus } from '../../core'
import type { PlatformEvent } from '../../core'
import { collectModule } from '../services/AnalyticsService'

// ─── EventBus subscriptions ───────────────────────────────────────────────────
// Analytics listens to platform events and triggers focused re-collection.
// This keeps snapshots fresh without requiring cron jobs.

type UnsubscribeFn = () => void
const subscriptions: UnsubscribeFn[] = []

function onBillingEvent(_event: PlatformEvent): void {
  // fire-and-forget: refresh billing snapshot
  collectModule('billing', '30d', { persist: true }).catch(() => undefined)
}

function onMarketingEvent(_event: PlatformEvent): void {
  collectModule('marketing', '30d', { persist: true }).catch(() => undefined)
}

function onCertificationEvent(_event: PlatformEvent): void {
  collectModule('certification', '30d', { persist: true }).catch(() => undefined)
}

function onRestaurantEvent(_event: PlatformEvent): void {
  collectModule('restaurants', '30d', { persist: true }).catch(() => undefined)
}

function onAIEvent(_event: PlatformEvent): void {
  collectModule('ai', '30d', { persist: true }).catch(() => undefined)
}

export function subscribeToEvents(): void {
  if (subscriptions.length > 0) return  // already subscribed

  subscriptions.push(
    eventBus.subscribe('BillingPaid',              onBillingEvent),
    eventBus.subscribe('BillingOverdue',           onBillingEvent),
    eventBus.subscribe('CampaignCompleted',        onMarketingEvent),
    eventBus.subscribe('CampaignFailed',           onMarketingEvent),
    eventBus.subscribe('CertificateIssued',        onCertificationEvent),
    eventBus.subscribe('CertificateExpired',       onCertificationEvent),
    eventBus.subscribe('RestaurantCreated',        onRestaurantEvent),
    eventBus.subscribe('AIGenerationCompleted',    onAIEvent),
    eventBus.subscribe('AIGenerationFailed',       onAIEvent),
  )
}

export function unsubscribeFromEvents(): void {
  for (const unsub of subscriptions) {
    unsub()
  }
  subscriptions.length = 0
}
