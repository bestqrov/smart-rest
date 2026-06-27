/**
 * Retry policy for AI provider calls.
 *
 * The policy itself is deterministic — given the same inputs, `shouldRetry`
 * and `nextDelayMs` always return the same values. No randomness.
 *
 * Provider adapters use this to decide whether and when to retry after:
 *   - A transient provider error (HTTP 5xx, timeout, network failure)
 *   - An output that failed OutputValidator
 *   - An explicit rate-limit response (429)
 *
 * Compliance failures, brand failures, and safety failures are NEVER retried
 * (they are deterministic — retrying with the same input will get the same fail).
 *
 * Pure module: no DB access, no side effects.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** The reason a retry is being considered. */
export type RetryReason =
  | 'PROVIDER_ERROR'         // HTTP 5xx, connection refused, DNS failure
  | 'PROVIDER_TIMEOUT'       // response exceeded timeoutMs
  | 'PROVIDER_RATE_LIMIT'    // HTTP 429 — Too Many Requests
  | 'OUTPUT_INVALID'         // AI returned output that failed OutputValidator
  | 'UNKNOWN'

/** Controls whether and how the pipeline retries after failure. */
export interface RetryPolicy {
  /** Maximum total attempts (first try + retries). 1 = no retry. */
  maxAttempts:          number
  /** Delay (ms) before the first retry. */
  baseDelayMs:          number
  /** Cap on computed delay (ms) — prevents infinite growth for many retries. */
  maxDelayMs:           number
  /**
   * Exponential backoff multiplier applied to each successive retry.
   * Effective delay for attempt n = min(baseDelayMs × multiplier^(n-1), maxDelayMs).
   * Set to 1.0 for constant delay.
   */
  backoffMultiplier:    number
  /** Which failure reasons should trigger a retry. */
  retryOn:              Record<RetryReason, boolean>
}

/** Snapshot of one retry attempt — stored in PipelineResult for audit. */
export interface RetryRecord {
  attempt:    number
  reason:     RetryReason
  delayMs:    number
  willRetry:  boolean
}

// ─── Pre-built policies ───────────────────────────────────────────────────────

/** Conservative default: up to 3 attempts, exponential backoff, retry on errors and invalid output. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts:       3,
  baseDelayMs:       1_000,
  maxDelayMs:        10_000,
  backoffMultiplier: 2.0,
  retryOn: {
    PROVIDER_ERROR:       true,
    PROVIDER_TIMEOUT:     true,
    PROVIDER_RATE_LIMIT:  true,
    OUTPUT_INVALID:       true,
    UNKNOWN:              false,
  },
}

/** Aggressive: up to 5 attempts, faster backoff — for time-sensitive scenarios. */
export const AGGRESSIVE_RETRY_POLICY: RetryPolicy = {
  maxAttempts:       5,
  baseDelayMs:         500,
  maxDelayMs:         5_000,
  backoffMultiplier: 1.5,
  retryOn: {
    PROVIDER_ERROR:       true,
    PROVIDER_TIMEOUT:     true,
    PROVIDER_RATE_LIMIT:  true,
    OUTPUT_INVALID:       true,
    UNKNOWN:              true,
  },
}

/** No retry: single attempt only. Use for tests or idempotency-sensitive contexts. */
export const NO_RETRY_POLICY: RetryPolicy = {
  maxAttempts:       1,
  baseDelayMs:       0,
  maxDelayMs:        0,
  backoffMultiplier: 1.0,
  retryOn: {
    PROVIDER_ERROR:       false,
    PROVIDER_TIMEOUT:     false,
    PROVIDER_RATE_LIMIT:  false,
    OUTPUT_INVALID:       false,
    UNKNOWN:              false,
  },
}

/** Rate-limit aware: long initial delay, low multiplier. */
export const RATE_LIMIT_RETRY_POLICY: RetryPolicy = {
  maxAttempts:       4,
  baseDelayMs:       5_000,
  maxDelayMs:        60_000,
  backoffMultiplier: 2.5,
  retryOn: {
    PROVIDER_ERROR:       true,
    PROVIDER_TIMEOUT:     true,
    PROVIDER_RATE_LIMIT:  true,
    OUTPUT_INVALID:       false,
    UNKNOWN:              false,
  },
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a RetryPolicy by merging caller overrides into the default policy.
 * Any field omitted from `overrides` keeps its default value.
 */
export function buildRetryPolicy(overrides?: Partial<RetryPolicy>): RetryPolicy {
  if (!overrides) return DEFAULT_RETRY_POLICY
  return {
    ...DEFAULT_RETRY_POLICY,
    ...overrides,
    retryOn: {
      ...DEFAULT_RETRY_POLICY.retryOn,
      ...(overrides.retryOn ?? {}),
    },
  }
}

/**
 * Determine whether the pipeline should retry after this failure.
 *
 * Returns false if:
 *   - attempt >= maxAttempts (already used all retries)
 *   - reason is not in the `retryOn` list
 *   - policy maxAttempts is 1 (no-retry mode)
 *
 * Pure function — same inputs → same output, no side effects.
 */
export function shouldRetry(
  policy:  RetryPolicy,
  attempt: number,  // 1-based: 1 = first try, 2 = first retry, …
  reason:  RetryReason,
): boolean {
  if (attempt >= policy.maxAttempts) return false
  return policy.retryOn[reason] === true
}

/**
 * Compute the delay (ms) to wait before the next attempt.
 *
 * Formula: min(baseDelayMs × backoffMultiplier^(attempt - 1), maxDelayMs)
 *   attempt = 1 → baseDelayMs
 *   attempt = 2 → baseDelayMs × multiplier
 *   attempt = 3 → baseDelayMs × multiplier²
 *   …
 *
 * Returns 0 when policy.baseDelayMs is 0 (e.g. NO_RETRY_POLICY).
 *
 * Pure function — deterministic, no randomness.
 */
export function nextDelayMs(policy: RetryPolicy, attempt: number): number {
  if (policy.baseDelayMs === 0) return 0
  const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1)
  return Math.min(Math.round(delay), policy.maxDelayMs)
}

/**
 * Build a RetryRecord for the audit trail (stored in PipelineResult.retryHistory).
 */
export function buildRetryRecord(
  attempt:  number,
  reason:   RetryReason,
  policy:   RetryPolicy,
): RetryRecord {
  const willRetry = shouldRetry(policy, attempt, reason)
  const delayMs   = willRetry ? nextDelayMs(policy, attempt) : 0
  return { attempt, reason, delayMs, willRetry }
}
