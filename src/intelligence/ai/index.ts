// ─── Smart Intelligence AI Provider Layer — Public API (K42) ───────────────
// Re-exports the existing, complete marketing-brain provider system
// (interface, registry, selector/failover, usage tracking) under the
// Intelligence namespace, plus the new Model Registry and the usage-event
// bridge into the Intelligence Event Hub.

export {
  getDefaultManager,
  registerProvider,
  registerProviders,
  getProvider,
  listProviders,
  listActiveProviders,
  listDisabledProviders,
  hasActiveProvider,
  registryStatus,
  selectProvider,
  buildFallbackChain,
  executeWithFallback,
  addUsageHook,
  emitUsageEvent,
  calculateCostUsd,
  estimateInputTokens,
  isRetryable,
  shouldFallback,
} from '../../marketing-brain/providers'

export type {
  AIProviderManager, GenerateOptions, ManagerResult, ManagerStatus,
  AIProvider, AIProviderRequest, AIProviderResponse, TokenUsage,
  ProviderHealth, ProviderStatus, UsageEvent, UsageHook,
  SelectionOptions, SelectionResult, FallbackChain, ProviderAttempt,
} from '../../marketing-brain/providers'

export type { ModelDescriptor } from './types'
export {
  registerModel, getModel, getAllModels, getModelsByProvider, getDefaultModel, registerBuiltinModels,
} from './ModelRegistry'

export { initAIProviderBridge } from './AIProviderBridge'
