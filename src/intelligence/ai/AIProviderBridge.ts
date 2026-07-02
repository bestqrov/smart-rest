// ─── Smart Intelligence AI Provider Layer — Bridge (K42) ───────────────────
// The provider interface, registry, selector/failover, and usage tracker
// already exist and are complete (marketing-brain/providers/) — re-exported
// here under the Intelligence namespace rather than reimplemented, same
// posture as every other Intelligence sub-module wrapping an existing
// service (Data Hub wraps billing/reviews/etc., Knowledge Engine wraps the
// Data Hub). initAIProviderBridge wires one addUsageHook (existing,
// UsageTracker.ts) that republishes each usage event as a platform event
// via the existing publishStandardEvent (K11) — bridging AI usage into the
// Intelligence Event Hub without touching UsageTracker itself.

import { publishStandardEvent } from '../../core'
import { addUsageHook } from '../../marketing-brain/providers'
import type { UsageEvent } from '../../marketing-brain/providers'
import { registerBuiltinModels } from './ModelRegistry'

let initialized = false

export function initAIProviderBridge(): void {
  if (initialized) return

  addUsageHook((event: UsageEvent) => {
    publishStandardEvent('IntelAIUsageRecorded', {
      tenantId: event.metadata?.['tenantId'] ?? 'platform',
      resourceId: event.requestId ?? event.provider,
      metadata: {
        provider: event.provider, model: event.model,
        totalTokens: event.totalTokens, costUsd: event.costUsd,
        success: event.success, latencyMs: event.latencyMs,
      },
    }, 'ai-provider-bridge')
  })

  registerBuiltinModels()
  initialized = true
}
