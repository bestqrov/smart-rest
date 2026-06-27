/**
 * Typed error hierarchy for AI provider failures.
 *
 * All provider errors extend ProviderError so callers can catch one base class.
 * Each subclass carries a `code` that lets ProviderSelector decide whether to
 * retry or fall back to the next provider.
 *
 * Retry behaviour per error type:
 *   DisabledProviderError   → skip this provider, try next (don't count as failure)
 *   ProviderAuthError       → do NOT retry (bad key won't fix itself)
 *   ProviderRateLimitError  → retry with delay, or fall back
 *   ProviderTimeoutError    → retry or fall back
 *   ProviderServerError     → retry or fall back
 *   ProviderSafetyError     → do NOT retry (AI refused the content — won't change)
 *   ProviderResponseError   → retry (malformed response, may be transient)
 *   ProviderNetworkError    → retry or fall back
 */

export type ProviderErrorCode =
  | 'DISABLED'            // Adapter is a placeholder — not a real failure
  | 'AUTH_FAILED'         // API key rejected by provider (401)
  | 'RATE_LIMITED'        // Too many requests (429)
  | 'TIMEOUT'             // Request exceeded timeoutMs
  | 'SERVER_ERROR'        // Provider returned HTTP 5xx
  | 'SAFETY_BLOCKED'      // AI refused to process the content (safety filter)
  | 'RESPONSE_MALFORMED'  // Provider returned unexpected / unparseable response
  | 'NETWORK_ERROR'       // DNS failure, connection refused, etc.
  | 'CONTEXT_TOO_LONG'    // Prompt exceeds the model's context window (413)
  | 'UNKNOWN'             // Unexpected error from provider

// ─── Base class ───────────────────────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    public readonly code:       ProviderErrorCode,
    public readonly provider:   string,
    message:                    string,
    public readonly retryable:  boolean,
    public readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

// ─── Specific error types ─────────────────────────────────────────────────────

export class DisabledProviderError extends ProviderError {
  constructor(provider: string) {
    super('DISABLED', provider,
      `Provider '${provider}' is disabled. It is a placeholder for a future integration.`,
      false,
    )
    this.name = 'DisabledProviderError'
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(provider: string, detail?: string) {
    super('AUTH_FAILED', provider,
      `Authentication failed for provider '${provider}'${detail ? `: ${detail}` : ''}. Check the API key.`,
      false,
      401,
    )
    this.name = 'ProviderAuthError'
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(
    provider:  string,
    public readonly retryAfterMs?: number,
  ) {
    super('RATE_LIMITED', provider,
      `Provider '${provider}' rate limit exceeded.${retryAfterMs ? ` Retry after ${retryAfterMs}ms.` : ''}`,
      true,
      429,
    )
    this.name = 'ProviderRateLimitError'
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string, timeoutMs: number) {
    super('TIMEOUT', provider,
      `Provider '${provider}' did not respond within ${timeoutMs}ms.`,
      true,
    )
    this.name = 'ProviderTimeoutError'
  }
}

export class ProviderServerError extends ProviderError {
  constructor(provider: string, statusCode: number, detail?: string) {
    super('SERVER_ERROR', provider,
      `Provider '${provider}' returned HTTP ${statusCode}${detail ? `: ${detail}` : ''}.`,
      true,
      statusCode,
    )
    this.name = 'ProviderServerError'
  }
}

export class ProviderSafetyError extends ProviderError {
  constructor(provider: string, reason?: string) {
    super('SAFETY_BLOCKED', provider,
      `Provider '${provider}' blocked the request due to safety filters${reason ? `: ${reason}` : ''}.`,
      false,
    )
    this.name = 'ProviderSafetyError'
  }
}

export class ProviderResponseError extends ProviderError {
  constructor(provider: string, detail: string) {
    super('RESPONSE_MALFORMED', provider,
      `Provider '${provider}' returned a malformed response: ${detail}`,
      true,
    )
    this.name = 'ProviderResponseError'
  }
}

export class ProviderNetworkError extends ProviderError {
  constructor(provider: string, cause: string) {
    super('NETWORK_ERROR', provider,
      `Network error reaching provider '${provider}': ${cause}`,
      true,
    )
    this.name = 'ProviderNetworkError'
  }
}

export class ProviderContextTooLongError extends ProviderError {
  constructor(provider: string) {
    super('CONTEXT_TOO_LONG', provider,
      `Provider '${provider}': prompt exceeds the model\'s context window.`,
      false,
      413,
    )
    this.name = 'ProviderContextTooLongError'
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** True for errors where retrying with the same input might succeed. */
export function isRetryable(error: unknown): boolean {
  return error instanceof ProviderError && error.retryable
}

/** True for errors that should fall back to the next provider in the priority chain. */
export function shouldFallback(error: unknown): boolean {
  if (!(error instanceof ProviderError)) return true
  return (
    error.code === 'DISABLED'   ||
    error.code === 'AUTH_FAILED'||
    error.code === 'RATE_LIMITED' ||
    error.code === 'SERVER_ERROR' ||
    error.code === 'TIMEOUT'    ||
    error.code === 'NETWORK_ERROR'
  )
}
