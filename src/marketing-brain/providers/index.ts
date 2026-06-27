// ─── Manager (primary entry point) ───────────────────────────────────────────

export {
  createAIProviderManager,
  getDefaultManager,
  resetDefaultManager,
} from './AIProviderManager'

export type {
  AIProviderManager,
  GenerateOptions,
  ManagerResult,
  ManagerStatus,
} from './AIProviderManager'

// ─── Provider interface + types ───────────────────────────────────────────────

export type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  TokenUsage,
  ProviderHealth,
  ProviderStatus,
} from './AIProvider'

// ─── Config ───────────────────────────────────────────────────────────────────

export type {
  ProviderConfigMap,
  GeminiConfig,
  ClaudeConfig,
  OpenAIConfig,
  GroqConfig,
  OpenRouterConfig,
} from './ProviderConfig'

// ─── Errors ───────────────────────────────────────────────────────────────────

export {
  ProviderError,
  DisabledProviderError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderServerError,
  ProviderSafetyError,
  ProviderResponseError,
  ProviderNetworkError,
  ProviderContextTooLongError,
  isRetryable,
  shouldFallback,
} from './ProviderErrors'

export type { ProviderErrorCode } from './ProviderErrors'

// ─── Usage tracking ───────────────────────────────────────────────────────────

export {
  addUsageHook,
  clearHooks,
  hookCount,
  emit       as emitUsageEvent,
  calculateCostUsd,
  estimateInputTokens,
} from './UsageTracker'

export type { UsageEvent, UsageHook } from './UsageTracker'

// ─── Registry ────────────────────────────────────────────────────────────────

export {
  registerProvider,
  registerProviders,
  getProvider,
  listProviders,
  listActiveProviders,
  listDisabledProviders,
  clearRegistry,
  hasActiveProvider,
  registryStatus,
} from './ProviderRegistry'

// ─── Selector ────────────────────────────────────────────────────────────────

export {
  selectProvider,
  buildFallbackChain,
  executeWithFallback,
} from './ProviderSelector'

export type { SelectionOptions, SelectionResult, FallbackChain, ProviderAttempt } from './ProviderSelector'

// ─── Adapters (for direct instantiation in tests) ────────────────────────────

export { GeminiAdapter }      from './adapters/GeminiAdapter'
export { ClaudeAdapter }      from './adapters/ClaudeAdapter'
export { OpenAIAdapter }      from './adapters/OpenAIAdapter'
export { GroqAdapter }        from './adapters/GroqAdapter'
export { OpenRouterAdapter }  from './adapters/OpenRouterAdapter'
