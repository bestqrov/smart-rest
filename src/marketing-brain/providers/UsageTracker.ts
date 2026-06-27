/**
 * Usage metrics and cost tracking hook system.
 *
 * Hooks are callbacks registered at startup (or test time).
 * Every time an AI provider completes (success or failure), the adapters call
 * `emit(event)` — the tracker dispatches to all registered hooks.
 *
 * Design:
 *   - Hooks are fire-and-forget for async hooks (errors don't propagate to callers)
 *   - Sync hooks execute immediately
 *   - The hook registry is module-level (process-scoped singleton)
 *   - `addUsageHook()` returns an unsubscribe function
 *   - `clearHooks()` is provided for testing
 *
 * Usage example:
 *   addUsageHook(async (event) => {
 *     await db.usageLogs.create({ data: event })
 *   })
 *
 *   addUsageHook((event) => {
 *     console.log(`[${event.provider}] ${event.totalTokens} tokens | $${event.costUsd.toFixed(4)}`)
 *   })
 */

// ─── Event shape ──────────────────────────────────────────────────────────────

export interface UsageEvent {
  /** Provider ID (e.g. 'gemini', 'claude'). */
  provider:     string
  /** Exact model used (e.g. 'gemini-1.5-flash-001'). */
  model:        string
  inputTokens:  number
  outputTokens: number
  totalTokens:  number
  /** Wall-clock milliseconds for the provider call. */
  latencyMs:    number
  /** Estimated cost in USD for this call. */
  costUsd:      number
  /** true if the provider returned a successful response. */
  success:      boolean
  /** Error message if success = false. */
  error?:       string
  /** Provider-assigned request ID (if available). */
  requestId?:   string
  /** ISO 8601 timestamp of the event. */
  timestamp:    string
  /** Arbitrary metadata forwarded from AIProviderRequest.metadata. */
  metadata?:    Record<string, string>
}

/** A usage hook callback. Can be sync or async. */
export type UsageHook = (event: UsageEvent) => void | Promise<void>

// ─── Module-level registry ────────────────────────────────────────────────────

const hooks: UsageHook[] = []

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a usage hook. Returns an unsubscribe function.
 *
 * The hook is called after every AI provider attempt (success or failure).
 * Async hooks are awaited with a best-effort timeout of 5s — errors are swallowed
 * so that a broken analytics hook never blocks a generation result.
 */
export function addUsageHook(hook: UsageHook): () => void {
  hooks.push(hook)
  return () => {
    const idx = hooks.indexOf(hook)
    if (idx !== -1) hooks.splice(idx, 1)
  }
}

/** Remove all registered hooks. Primarily for test isolation. */
export function clearHooks(): void {
  hooks.length = 0
}

/** Return the current number of registered hooks. */
export function hookCount(): number {
  return hooks.length
}

/**
 * Emit a UsageEvent to all registered hooks.
 *
 * Async hooks are fire-and-forget — this function does NOT await them.
 * Errors from hooks are caught and logged to console.error (never re-thrown).
 *
 * Called by provider adapters immediately after a generate() call completes.
 */
export function emit(event: UsageEvent): void {
  for (const hook of hooks) {
    try {
      const result = hook(event)
      if (result && typeof result.catch === 'function') {
        result.catch((err: unknown) => {
          console.error('[UsageTracker] Async hook error:', err)
        })
      }
    } catch (err) {
      console.error('[UsageTracker] Sync hook error:', err)
    }
  }
}

// ─── Cost calculation helper ──────────────────────────────────────────────────

/**
 * Calculate cost in USD from token counts and per-million-token rates.
 *
 * @param inputTokens   Number of tokens in the prompt.
 * @param outputTokens  Number of tokens in the response.
 * @param inputPerM     Cost per 1,000,000 input tokens in USD.
 * @param outputPerM    Cost per 1,000,000 output tokens in USD.
 */
export function calculateCostUsd(
  inputTokens:  number,
  outputTokens: number,
  inputPerM:    number,
  outputPerM:   number,
): number {
  const inputCost  = (inputTokens  / 1_000_000) * inputPerM
  const outputCost = (outputTokens / 1_000_000) * outputPerM
  return inputCost + outputCost
}

/**
 * Estimate the input token count from a string.
 * Uses the 4-chars-per-token approximation (conservative; matches PromptBuilder).
 */
export function estimateInputTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
