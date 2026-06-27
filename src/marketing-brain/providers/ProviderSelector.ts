import type { AIProvider }      from './AIProvider'
import { listActiveProviders }  from './ProviderRegistry'
import { shouldFallback }       from './ProviderErrors'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectionOptions {
  /**
   * Force a specific provider id.
   * If not found or inactive, falls through to normal priority selection.
   */
  forceProvider?:    string
  /**
   * Provider ids to skip in this selection round.
   * Used by the fallback loop to exclude already-tried providers.
   */
  excludeProviders?: string[]
}

export interface SelectionResult {
  provider:    AIProvider
  reason:      string
}

export interface FallbackChain {
  /** Ordered list of providers to try, starting with the highest priority. */
  providers:   AIProvider[]
  /** Reasoning for the chain construction. */
  reason:      string
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Select the best available provider for this request.
 *
 * Selection logic:
 *   1. If options.forceProvider is set and that provider is active → use it
 *   2. Otherwise, take all active providers sorted by priority (ascending)
 *   3. Apply options.excludeProviders filter
 *   4. Return the first remaining provider
 *   5. If none remain → return null
 *
 * Pure function with respect to the registry snapshot taken at call time.
 */
export function selectProvider(options?: SelectionOptions): SelectionResult | null {
  const activeProviders = listActiveProviders()

  if (!activeProviders.length) return null

  // Forced selection
  if (options?.forceProvider) {
    const forced = activeProviders.find(p => p.id === options.forceProvider)
    if (forced) {
      return {
        provider: forced,
        reason:   `Forced selection: provider '${forced.id}' was explicitly requested.`,
      }
    }
    // Forced provider not found/active — fall through to priority selection
  }

  // Exclude already-tried providers
  const excluded = new Set(options?.excludeProviders ?? [])
  const candidates = activeProviders.filter(p => !excluded.has(p.id))

  if (!candidates.length) return null

  const selected = candidates[0]!
  const reason = excluded.size > 0
    ? `Priority selection: '${selected.id}' (priority ${selected.priority}) after excluding [${[...excluded].join(', ')}].`
    : `Priority selection: '${selected.id}' (priority ${selected.priority}) — highest priority active provider.`

  return { provider: selected, reason }
}

/**
 * Build the full fallback chain for this request.
 *
 * Returns all active providers in priority order, optionally excluding some.
 * The fallback loop tries each in sequence until one succeeds or all fail.
 */
export function buildFallbackChain(options?: SelectionOptions): FallbackChain {
  const activeProviders = listActiveProviders()
  const excluded        = new Set(options?.excludeProviders ?? [])

  let chain = activeProviders.filter(p => !excluded.has(p.id))

  // If forceProvider is set, move it to the front
  if (options?.forceProvider) {
    const idx = chain.findIndex(p => p.id === options.forceProvider)
    if (idx > 0) {
      const [forced] = chain.splice(idx, 1)
      if (forced) chain = [forced, ...chain]
    }
  }

  const ids    = chain.map(p => `${p.id}(${p.priority})`).join(' → ')
  const reason = chain.length
    ? `Fallback chain: [${ids}]. ${chain.length} provider(s) available.`
    : 'No active providers available.'

  return { providers: chain, reason }
}

/**
 * Execute a generate call with automatic fallback.
 *
 * Iterates through the fallback chain. On failure, checks shouldFallback(error)
 * to decide whether to try the next provider or re-throw immediately.
 *
 * @param chain    The ordered list of providers to try (from buildFallbackChain).
 * @param call     The async function to call for each provider.
 * @returns        The successful result + which provider was used.
 */
export async function executeWithFallback<T>(
  chain: FallbackChain,
  call:  (provider: AIProvider) => Promise<T>,
): Promise<{ result: T; provider: AIProvider; attempts: ProviderAttempt[] }> {
  const attempts: ProviderAttempt[] = []

  if (!chain.providers.length) {
    throw new Error('No active providers available to handle this request.')
  }

  for (const provider of chain.providers) {
    const attemptStart = Date.now()
    try {
      const result = await call(provider)
      attempts.push({
        provider:  provider.id,
        success:   true,
        latencyMs: Date.now() - attemptStart,
      })
      return { result, provider, attempts }
    } catch (error: unknown) {
      const latencyMs = Date.now() - attemptStart
      const errMsg    = error instanceof Error ? error.message : String(error)

      attempts.push({
        provider:  provider.id,
        success:   false,
        latencyMs,
        error:     errMsg,
      })

      if (!shouldFallback(error)) {
        // Non-retryable error (safety block, auth failure, context too long)
        // Don't try other providers — same content will fail the same way
        throw error
      }

      // Continue to next provider in chain
    }
  }

  const errorSummary = attempts
    .map(a => `${a.provider}: ${a.error ?? 'unknown'}`)
    .join(' | ')

  throw new Error(`All providers failed: [${errorSummary}]`)
}

/** Audit record for one provider attempt. */
export interface ProviderAttempt {
  provider:  string
  success:   boolean
  latencyMs: number
  error?:    string
}
