// ─── Smart Intelligence AI Readiness — Provider Availability (K58) ─────────
// Reuses K42's registryStatus/getProvider/getModel directly — no second
// provider health tracker.

import { registryStatus, getProvider, getModel } from '../ai'
import type { ProviderAvailabilityResult } from './types'

export function checkProviderAvailability(providerId?: string, modelId?: string): ProviderAvailabilityResult {
  const status = registryStatus()
  const reasons: string[] = []

  if (status.active === 0) reasons.push('no active AI provider is registered')

  let requestedProviderOk: boolean | undefined
  let requestedModelOk: boolean | undefined

  if (providerId) {
    const provider = getProvider(providerId)
    requestedProviderOk = !!provider?.isActive
    if (!requestedProviderOk) reasons.push(`requested provider "${providerId}" is not active`)

    if (modelId) {
      requestedModelOk = !!getModel(providerId, modelId)
      if (!requestedModelOk) reasons.push(`requested model "${providerId}:${modelId}" is not registered`)
    }
  }

  const ready = status.active > 0 && requestedProviderOk !== false && requestedModelOk !== false

  return {
    ready, hasActiveProvider: status.active > 0, activeCount: status.active, totalCount: status.total,
    requestedProviderOk, requestedModelOk, reasons,
  }
}
