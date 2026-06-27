import type { AIProviderRequest, AIProviderResponse } from './AIProvider'
import type { ProviderConfigMap }  from './ProviderConfig'
import type { UsageHook }          from './UsageTracker'
import type { ProviderAttempt }    from './ProviderSelector'

import {
  registerProviders,
  clearRegistry,
  registryStatus,
  hasActiveProvider,
  listProviders,
} from './ProviderRegistry'
import {
  buildFallbackChain,
  executeWithFallback,
} from './ProviderSelector'
import { addUsageHook, clearHooks } from './UsageTracker'

import { GeminiAdapter }      from './adapters/GeminiAdapter'
import { ClaudeAdapter }      from './adapters/ClaudeAdapter'
import { OpenAIAdapter }      from './adapters/OpenAIAdapter'
import { GroqAdapter }        from './adapters/GroqAdapter'
import { OpenRouterAdapter }  from './adapters/OpenRouterAdapter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Force a specific provider id (bypasses priority selection). */
  forceProvider?:    string
  /** Provider ids to exclude from this call. */
  excludeProviders?: string[]
}

export type ManagerResult =
  | {
      ok:        true
      response:  AIProviderResponse
      provider:  string
      attempts:  ProviderAttempt[]
    }
  | {
      ok:        false
      error:     string
      errorCode?: string
      provider:  null
      attempts:  ProviderAttempt[]
    }

export interface ManagerStatus {
  hasActiveProvider: boolean
  providers: Array<{
    id:       string
    name:     string
    active:   boolean
    priority: number
  }>
}

// ─── Manager interface ────────────────────────────────────────────────────────

export interface AIProviderManager {
  /**
   * Generate AI content from a systemPrompt + userPrompt.
   *
   * Selects the best available provider (by priority), calls it, and falls back
   * to the next if it fails. Returns a ManagerResult discriminated union.
   *
   * Never throws — all errors are captured in result.ok = false.
   */
  generate(request: AIProviderRequest, options?: GenerateOptions): Promise<ManagerResult>

  /**
   * Register a usage hook. Called after every provider attempt.
   * Returns an unsubscribe function.
   */
  addUsageHook(hook: UsageHook): () => void

  /**
   * Check whether any active provider is registered.
   */
  hasActiveProvider(): boolean

  /**
   * Return a snapshot of the registry for diagnostics and monitoring.
   */
  status(): ManagerStatus

  /**
   * Validate the API key for a specific provider (structural check only).
   * Returns false if the provider is not registered or is disabled.
   */
  validateApiKey(providerId: string, key: string): boolean
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create and configure an AIProviderManager.
 *
 * This is the main entry point. Call it once at startup and reuse the returned
 * manager throughout the process lifetime.
 *
 * @param config   Per-provider configuration. Keys map to provider ids.
 * @param options  Manager-level options (see ManagerFactoryOptions).
 *
 * @example
 *   const manager = createAIProviderManager({
 *     gemini: { apiKey: process.env.GEMINI_API_KEY! }
 *   })
 *   const result = await manager.generate({ systemPrompt, userPrompt })
 */
export function createAIProviderManager(
  config:  ProviderConfigMap,
  options?: { clearExisting?: boolean },
): AIProviderManager {
  if (options?.clearExisting) {
    clearRegistry()
    clearHooks()
  }

  // Register Gemini only when an API key is provided (it is the only active adapter).
  // Disabled placeholders are always registered so they appear in status() and
  // healthCheck() results — they are skipped automatically by the selector.
  registerProviders([
    ...(config.gemini     ? [new GeminiAdapter(config.gemini)]         : []),
    new ClaudeAdapter    (config.claude),
    new OpenAIAdapter    (config.openai),
    new GroqAdapter      (config.groq),
    new OpenRouterAdapter(config.openrouter),
  ])

  return {
    async generate(
      request: AIProviderRequest,
      opts?:   GenerateOptions,
    ): Promise<ManagerResult> {
      const chain    = buildFallbackChain({
        forceProvider:    opts?.forceProvider,
        excludeProviders: opts?.excludeProviders,
      })
      const attempts: ProviderAttempt[] = []

      if (!chain.providers.length) {
        return {
          ok:        false,
          error:     'No active AI providers are available. Configure a provider API key.',
          errorCode: 'NO_ACTIVE_PROVIDER',
          provider:  null,
          attempts,
        }
      }

      try {
        const { result, provider, attempts: chainAttempts } = await executeWithFallback(
          chain,
          (p) => p.generate(request),
        )
        return {
          ok:       true,
          response: result,
          provider: provider.id,
          attempts: chainAttempts,
        }
      } catch (error: unknown) {
        const msg      = error instanceof Error ? error.message : String(error)
        const code     = (error as { code?: string }).code ?? 'UNKNOWN'
        const chainAttempts = attempts  // captured above

        return {
          ok:        false,
          error:     msg,
          errorCode: code,
          provider:  null,
          attempts:  chainAttempts,
        }
      }
    },

    addUsageHook(hook: UsageHook): () => void {
      return addUsageHook(hook)
    },

    hasActiveProvider(): boolean {
      return hasActiveProvider()
    },

    status(): ManagerStatus {
      const s = registryStatus()
      return {
        hasActiveProvider: s.active > 0,
        providers:         s.providers,
      }
    },

    validateApiKey(providerId: string, key: string): boolean {
      const provider = listProviders().find(p => p.id === providerId)
      if (!provider) return false
      return provider.validateApiKey(key)
    },
  }
}

// ─── Singleton convenience ────────────────────────────────────────────────────

let _defaultManager: AIProviderManager | null = null

/**
 * Get (or lazily create) the default manager using environment variables.
 *
 * Environment variables read:
 *   GEMINI_API_KEY — activates the Gemini adapter
 *
 * Call this in API routes or server-side code where the env is available.
 * In tests, use createAIProviderManager() directly with explicit config.
 */
export function getDefaultManager(): AIProviderManager {
  if (!_defaultManager) {
    _defaultManager = createAIProviderManager({
      ...(process.env.GEMINI_API_KEY
        ? { gemini: { apiKey: process.env.GEMINI_API_KEY } }
        : {}),
    })
  }
  return _defaultManager
}

/**
 * Reset the default manager singleton. Call after env changes or in tests.
 */
export function resetDefaultManager(): void {
  _defaultManager = null
}
