/**
 * DISABLED PLACEHOLDER — OpenRouter
 *
 * This adapter is intentionally inactive. It implements the AIProvider interface
 * so the registry and selector can enumerate it, but every method that would
 * make a real API call throws DisabledProviderError.
 *
 * OpenRouter is a unified API proxy for 200+ models (Claude, GPT-4, Llama, Mistral, etc.).
 * It uses the OpenAI Chat Completions API format, so implementation is straightforward.
 *
 * To enable: set isActive = true, implement generate() using fetch + OpenAI format.
 *
 * Planned endpoint: https://openrouter.ai/api/v1/chat/completions
 * Planned models: anthropic/claude-3-haiku (cheap) or mistralai/mistral-7b-instruct.
 * Value: model diversity, routing, fallback across providers via a single API key.
 */
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  ProviderHealth,
} from '../AIProvider'
import type { OpenRouterConfig } from '../ProviderConfig'
import { DisabledProviderError } from '../ProviderErrors'

const DEFAULT_PRIORITY = 5

export class OpenRouterAdapter implements AIProvider {
  readonly id       = 'openrouter'
  readonly name     = 'OpenRouter'
  readonly isActive = false
  readonly priority: number

  constructor(config?: OpenRouterConfig) {
    this.priority = config?.priority ?? DEFAULT_PRIORITY
  }

  validateApiKey(_key: string): boolean {
    // OpenRouter keys start with 'sk-or-v1-'
    return false   // Disabled — always returns false
  }

  estimateCost(_request: AIProviderRequest): number {
    return 0
  }

  async generate(_request: AIProviderRequest): Promise<AIProviderResponse> {
    throw new DisabledProviderError('openrouter')
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      healthy:   false,
      status:    'disabled',
      error:     'OpenRouter adapter is disabled. It is a placeholder for future integration.',
      checkedAt: new Date().toISOString(),
    }
  }
}
