/**
 * DISABLED PLACEHOLDER — OpenAI
 *
 * This adapter is intentionally inactive. It implements the AIProvider interface
 * so the registry and selector can enumerate it, but every method that would
 * make a real API call throws DisabledProviderError.
 *
 * To enable: set isActive = true, install openai npm package, implement generate().
 *
 * Planned model: gpt-4o-mini (cheap) or gpt-4o (high quality).
 * Planned pricing (approx, gpt-4o-mini): $0.15/1M input, $0.60/1M output.
 */
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  ProviderHealth,
} from '../AIProvider'
import type { OpenAIConfig } from '../ProviderConfig'
import { DisabledProviderError } from '../ProviderErrors'

const DEFAULT_PRIORITY = 3

export class OpenAIAdapter implements AIProvider {
  readonly id       = 'openai'
  readonly name     = 'OpenAI'
  readonly isActive = false
  readonly priority: number

  constructor(config?: OpenAIConfig) {
    this.priority = config?.priority ?? DEFAULT_PRIORITY
  }

  validateApiKey(_key: string): boolean {
    // OpenAI keys start with 'sk-'
    return false   // Disabled — always returns false
  }

  estimateCost(_request: AIProviderRequest): number {
    return 0
  }

  async generate(_request: AIProviderRequest): Promise<AIProviderResponse> {
    throw new DisabledProviderError('openai')
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      healthy:   false,
      status:    'disabled',
      error:     'OpenAI adapter is disabled. It is a placeholder for future integration.',
      checkedAt: new Date().toISOString(),
    }
  }
}
