import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  ProviderHealth,
  TokenUsage,
} from '../AIProvider'
import type { GeminiConfig }        from '../ProviderConfig'
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderServerError,
  ProviderTimeoutError,
  ProviderSafetyError,
  ProviderResponseError,
  ProviderNetworkError,
  ProviderContextTooLongError,
} from '../ProviderErrors'
import {
  emit,
  calculateCostUsd,
  estimateInputTokens,
} from '../UsageTracker'

// ─── Gemini API types ─────────────────────────────────────────────────────────

interface GeminiPart       { text: string }
interface GeminiContent    { role: string; parts: GeminiPart[] }
interface GeminiCandidate  {
  content:      GeminiContent
  finishReason: string
  index:        number
}
interface GeminiUsage {
  promptTokenCount:     number
  candidatesTokenCount: number
  totalTokenCount:      number
}
interface GeminiResponse {
  candidates?:     GeminiCandidate[]
  usageMetadata?:  GeminiUsage
  modelVersion?:   string
  error?:          { code: number; message: string; status: string }
}

// ─── Pricing table (USD per 1M tokens) ───────────────────────────────────────

const PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  'gemini-1.5-flash':       { inputPerM: 0.075,  outputPerM: 0.30  },
  'gemini-1.5-flash-001':   { inputPerM: 0.075,  outputPerM: 0.30  },
  'gemini-1.5-flash-002':   { inputPerM: 0.075,  outputPerM: 0.30  },
  'gemini-1.5-pro':         { inputPerM: 1.25,   outputPerM: 5.00  },
  'gemini-1.5-pro-001':     { inputPerM: 1.25,   outputPerM: 5.00  },
  'gemini-1.5-pro-002':     { inputPerM: 1.25,   outputPerM: 5.00  },
  'gemini-2.0-flash':       { inputPerM: 0.10,   outputPerM: 0.40  },
  'gemini-2.0-flash-exp':   { inputPerM: 0.00,   outputPerM: 0.00  }, // free preview
  'gemini-2.0-flash-001':   { inputPerM: 0.10,   outputPerM: 0.40  },
}

const DEFAULT_PRICING   = { inputPerM: 0.075,  outputPerM: 0.30 }
const DEFAULT_MODEL     = 'gemini-1.5-flash'
const DEFAULT_MAX_TOKENS = 1024
const DEFAULT_TEMP       = 0.7
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_PRIORITY   = 1

const GEMINI_API_BASE    = 'https://generativelanguage.googleapis.com/v1beta/models'

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class GeminiAdapter implements AIProvider {
  readonly id       = 'gemini'
  readonly name     = 'Google Gemini'
  readonly isActive = true
  readonly priority: number

  private readonly apiKey:    string
  private readonly model:     string
  private readonly maxTokens: number
  private readonly temperature: number
  private readonly timeoutMs: number

  constructor(config: GeminiConfig) {
    this.apiKey      = config.apiKey
    this.model       = config.model        ?? DEFAULT_MODEL
    this.maxTokens   = config.maxTokens    ?? DEFAULT_MAX_TOKENS
    this.temperature = config.temperature  ?? DEFAULT_TEMP
    this.timeoutMs   = config.timeoutMs    ?? DEFAULT_TIMEOUT_MS
    this.priority    = config.priority     ?? DEFAULT_PRIORITY
  }

  // ── Interface: validateApiKey ──────────────────────────────────────────────

  /**
   * Gemini API keys follow the pattern: AIza... (39 chars total, alphanumeric + _ -).
   * This is a structural check only — does not make a network call.
   */
  validateApiKey(key: string): boolean {
    return /^AIza[\w\-]{35}$/.test(key)
  }

  // ── Interface: estimateCost ────────────────────────────────────────────────

  /**
   * Pre-call cost estimate in USD.
   * Based on character-ratio token estimation and the model's per-token price.
   */
  estimateCost(request: AIProviderRequest): number {
    const model    = request.model ?? this.model
    const pricing  = PRICING[model] ?? DEFAULT_PRICING
    const inputTok = estimateInputTokens(request.systemPrompt + request.userPrompt)
    // Estimate output as 25% of maxTokens (typical completion ratio)
    const outputTok = Math.ceil((request.maxTokens ?? this.maxTokens) * 0.25)
    return calculateCostUsd(inputTok, outputTok, pricing.inputPerM, pricing.outputPerM)
  }

  // ── Interface: generate ───────────────────────────────────────────────────

  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const model    = request.model     ?? this.model
    const maxTok   = request.maxTokens ?? this.maxTokens
    const temp     = request.temperature ?? this.temperature
    const started  = Date.now()

    // Build request body
    const body = {
      systemInstruction: {
        parts: [{ text: request.systemPrompt }],
      },
      contents: [
        {
          role:  'user',
          parts: [{ text: request.userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTok,
        temperature:     temp,
        stopSequences:   [],
      },
    }

    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${this.apiKey}`

    let raw: GeminiResponse
    try {
      raw = await this.fetchWithTimeout(url, body, this.timeoutMs)
    } catch (error: unknown) {
      const latencyMs = Date.now() - started
      const errMsg    = error instanceof Error ? error.message : String(error)

      if (error instanceof ProviderRateLimitError  ||
          error instanceof ProviderAuthError        ||
          error instanceof ProviderServerError      ||
          error instanceof ProviderTimeoutError     ||
          error instanceof ProviderContextTooLongError) {
        this.emitFailure(model, errMsg, latencyMs, request.metadata)
        throw error
      }

      const wrapped = new ProviderNetworkError('gemini', errMsg)
      this.emitFailure(model, wrapped.message, latencyMs, request.metadata)
      throw wrapped
    }

    const latencyMs = Date.now() - started

    // Parse response
    const candidate = raw.candidates?.[0]
    if (!candidate) {
      const err = new ProviderResponseError('gemini', 'No candidates in response')
      this.emitFailure(model, err.message, latencyMs, request.metadata)
      throw err
    }

    if (candidate.finishReason === 'SAFETY') {
      const err = new ProviderSafetyError('gemini', 'Content was blocked by Gemini safety filters')
      this.emitFailure(model, err.message, latencyMs, request.metadata)
      throw err
    }

    const content = candidate.content?.parts?.[0]?.text
    if (!content) {
      const err = new ProviderResponseError('gemini', 'Empty content in response candidate')
      this.emitFailure(model, err.message, latencyMs, request.metadata)
      throw err
    }

    const usageMeta = raw.usageMetadata
    const usage: TokenUsage = {
      inputTokens:  usageMeta?.promptTokenCount     ?? 0,
      outputTokens: usageMeta?.candidatesTokenCount ?? 0,
      totalTokens:  usageMeta?.totalTokenCount      ?? 0,
    }

    const pricing  = PRICING[model] ?? DEFAULT_PRICING
    const costUsd  = calculateCostUsd(
      usage.inputTokens,
      usage.outputTokens,
      pricing.inputPerM,
      pricing.outputPerM,
    )

    emit({
      provider:    'gemini',
      model:       raw.modelVersion ?? model,
      inputTokens:  usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens:  usage.totalTokens,
      latencyMs,
      costUsd,
      success:     true,
      timestamp:   new Date().toISOString(),
      metadata:    request.metadata,
    })

    return {
      content,
      model:    raw.modelVersion ?? model,
      provider: 'gemini',
      usage,
      latencyMs,
      raw,
    }
  }

  // ── Interface: healthCheck ────────────────────────────────────────────────

  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now()
    try {
      const minRequest: AIProviderRequest = {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt:   'Reply with the single word: ok',
        maxTokens:    5,
        temperature:  0,
      }
      await this.generate(minRequest)
      return {
        healthy:   true,
        status:    'active',
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      }
    } catch (error: unknown) {
      return {
        healthy:  false,
        status:   'unavailable',
        error:    error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      }
    }
  }

  // ── Private HTTP ──────────────────────────────────────────────────────────

  private async fetchWithTimeout(
    url:       string,
    body:      object,
    timeoutMs: number,
  ): Promise<GeminiResponse> {
    const controller = new AbortController()
    const timer      = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      })
    } catch (error: unknown) {
      clearTimeout(timer)
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('abort') || msg.includes('signal')) {
        throw new ProviderTimeoutError('gemini', timeoutMs)
      }
      throw new ProviderNetworkError('gemini', msg)
    } finally {
      clearTimeout(timer)
    }

    const data = await response.json() as GeminiResponse

    if (!response.ok) {
      const errorMsg = data.error?.message ?? `HTTP ${response.status}`
      if (response.status === 401 || response.status === 403) {
        throw new ProviderAuthError('gemini', errorMsg)
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        throw new ProviderRateLimitError('gemini', retryAfter ? parseInt(retryAfter) * 1000 : undefined)
      }
      if (response.status === 413) {
        throw new ProviderContextTooLongError('gemini')
      }
      if (response.status >= 500) {
        throw new ProviderServerError('gemini', response.status, errorMsg)
      }
      throw new ProviderResponseError('gemini', errorMsg)
    }

    return data
  }

  private emitFailure(
    model:     string,
    error:     string,
    latencyMs: number,
    metadata?: Record<string, string>,
  ): void {
    emit({
      provider:    'gemini',
      model,
      inputTokens:  0,
      outputTokens: 0,
      totalTokens:  0,
      latencyMs,
      costUsd:      0,
      success:      false,
      error,
      timestamp:   new Date().toISOString(),
      metadata,
    })
  }
}
