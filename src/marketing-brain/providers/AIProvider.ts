/**
 * The provider interface every AI adapter must implement.
 *
 * Contracts:
 *   - `generate()` either resolves with a valid AIProviderResponse or throws a ProviderError
 *   - `healthCheck()` never throws — it always resolves with a ProviderHealth object
 *   - `validateApiKey()` is synchronous and checks structure only (no API call)
 *   - `estimateCost()` is synchronous and deterministic — same request → same estimate
 *   - `isActive === false` means the adapter throws DisabledProviderError on generate()
 */

// ─── Request ──────────────────────────────────────────────────────────────────

export interface AIProviderRequest {
  /** Full system prompt from PromptBuilder. */
  systemPrompt: string
  /** Full user prompt from PromptBuilder. */
  userPrompt:   string
  /** Model override. When null, the adapter uses its configured default. */
  model?:       string
  /** Max tokens to generate. When null, the adapter uses its configured default. */
  maxTokens?:   number
  /**
   * Sampling temperature (0–2 for most providers, 0–1 for some).
   * 0 = deterministic / greedy. Higher = more creative.
   * Default: 0.7 (balanced).
   */
  temperature?: number
  /** Arbitrary metadata passed through for tracing. Not sent to the AI. */
  metadata?:    Record<string, string>
}

// ─── Response ─────────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens:  number
  outputTokens: number
  totalTokens:  number
}

export interface AIProviderResponse {
  /** The raw text content produced by the model. */
  content:     string
  /** The exact model identifier used (may differ from request.model if remapped). */
  model:       string
  /** Provider ID (matches AIProvider.id). */
  provider:    string
  /** Token usage for cost accounting and monitoring. */
  usage:       TokenUsage
  /** Wall-clock latency of the provider call in milliseconds. */
  latencyMs:   number
  /** Provider-assigned request identifier (for support inquiries). */
  requestId?:  string
  /**
   * The raw provider API response, kept for debugging.
   * Not part of the public contract — structure varies per provider.
   */
  raw?:        unknown
}

// ─── Health ───────────────────────────────────────────────────────────────────

export type ProviderStatus =
  | 'active'         // Provider is enabled and believed to be reachable
  | 'disabled'       // Provider is intentionally disabled (placeholder)
  | 'degraded'       // Provider is enabled but showing errors
  | 'unavailable'    // Provider is enabled but health check failed

export interface ProviderHealth {
  healthy:    boolean
  status:     ProviderStatus
  latencyMs?: number
  error?:     string
  checkedAt:  string   // ISO 8601
}

// ─── The provider interface ───────────────────────────────────────────────────

export interface AIProvider {
  /**
   * Stable string identifier. One word, lowercase.
   * Examples: 'gemini', 'claude', 'openai', 'groq', 'openrouter'
   */
  readonly id: string

  /** Human-readable provider name for logs and metrics. */
  readonly name: string

  /**
   * false = this adapter is a disabled placeholder.
   * generate() will throw DisabledProviderError immediately.
   * ProviderSelector skips disabled providers automatically.
   */
  readonly isActive: boolean

  /**
   * Selection priority. Lower number = higher preference.
   * 1 = try first. 99 = last resort.
   * ProviderSelector picks the lowest-priority active provider.
   */
  readonly priority: number

  /**
   * Check whether an API key has the expected structural format.
   * Synchronous — does NOT make an API call.
   * Returns false immediately for disabled adapters.
   */
  validateApiKey(key: string): boolean

  /**
   * Estimate the cost in USD for a given request, before the call is made.
   * Based on the estimated input token count (4 chars ≈ 1 token).
   * Returns 0 for disabled adapters.
   */
  estimateCost(request: AIProviderRequest): number

  /**
   * Send the prompt to the AI provider and return the response.
   * May throw any subclass of ProviderError.
   * Disabled adapters throw DisabledProviderError immediately.
   */
  generate(request: AIProviderRequest): Promise<AIProviderResponse>

  /**
   * Ping the provider with a minimal request to verify it is reachable.
   * Never throws — returns ProviderHealth with healthy: false on any error.
   * Disabled adapters return healthy: false with status 'disabled' immediately.
   */
  healthCheck(): Promise<ProviderHealth>
}
