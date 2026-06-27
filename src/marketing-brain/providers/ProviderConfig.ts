/**
 * Per-provider configuration shapes.
 *
 * ProviderConfigMap is passed to createAIProviderManager() at startup.
 * Keys that are absent → that provider is not instantiated.
 * Keys with an isActive: false override → that provider is disabled even with a key.
 *
 * Design: config types for disabled providers are defined but unused in this sprint.
 * They document the expected shape for when those adapters are enabled.
 */

// ─── Active provider ──────────────────────────────────────────────────────────

export interface GeminiConfig {
  /** GEMINI_API_KEY — required. */
  apiKey:       string
  /**
   * Gemini model to use.
   * Defaults to 'gemini-1.5-flash' (fast, cheap, good for marketing copy).
   * Other options: 'gemini-1.5-pro', 'gemini-2.0-flash'
   */
  model?:       string
  /** Max output tokens. Default: 1024 (generous for a single marketing message). */
  maxTokens?:   number
  /** Sampling temperature (0–2). Default: 0.7. */
  temperature?: number
  /** HTTP request timeout in ms. Default: 30_000 (30s). */
  timeoutMs?:   number
  /** Provider priority — lower = preferred. Default: 1 (Gemini is the primary). */
  priority?:    number
}

// ─── Disabled placeholder configs (typed but unused until adapters are enabled) ─

export interface ClaudeConfig {
  apiKey:      string
  model?:      string   // e.g. 'claude-3-5-sonnet-20241022'
  maxTokens?:  number
  timeoutMs?:  number
  priority?:   number
}

export interface OpenAIConfig {
  apiKey:       string
  model?:       string   // e.g. 'gpt-4o-mini', 'gpt-4o'
  maxTokens?:   number
  temperature?: number
  timeoutMs?:   number
  priority?:    number
  baseUrl?:     string   // override for Azure OpenAI or self-hosted
}

export interface GroqConfig {
  apiKey:       string
  model?:       string   // e.g. 'llama3-8b-8192', 'mixtral-8x7b-32768'
  maxTokens?:   number
  temperature?: number
  timeoutMs?:   number
  priority?:    number
}

export interface OpenRouterConfig {
  apiKey:       string
  model?:       string   // e.g. 'anthropic/claude-3-haiku', 'mistralai/mistral-7b-instruct'
  maxTokens?:   number
  temperature?: number
  timeoutMs?:   number
  priority?:    number
  /** HTTP Referer for OpenRouter tracking. */
  siteUrl?:     string
  siteName?:    string
}

// ─── The full config map ──────────────────────────────────────────────────────

/**
 * Pass this to createAIProviderManager(). Any omitted key means that provider
 * is not loaded. Omitting 'gemini' means no active provider — the manager
 * will return an error on every generate() call.
 */
export interface ProviderConfigMap {
  /** ACTIVE: Gemini is the only enabled provider in this sprint. */
  gemini?:      GeminiConfig
  /** DISABLED: Placeholder. Will throw DisabledProviderError. */
  claude?:      ClaudeConfig
  /** DISABLED: Placeholder. Will throw DisabledProviderError. */
  openai?:      OpenAIConfig
  /** DISABLED: Placeholder. Will throw DisabledProviderError. */
  groq?:        GroqConfig
  /** DISABLED: Placeholder. Will throw DisabledProviderError. */
  openrouter?:  OpenRouterConfig
}
