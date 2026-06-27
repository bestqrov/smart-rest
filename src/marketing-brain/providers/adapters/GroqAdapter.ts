/**
 * DISABLED PLACEHOLDER — Groq
 *
 * This adapter is intentionally inactive. It implements the AIProvider interface
 * so the registry and selector can enumerate it, but every method that would
 * make a real API call throws DisabledProviderError.
 *
 * Note: groq-sdk is already installed in this project (see package.json).
 * To enable: set isActive = true, implement generate() using the existing SDK.
 *
 * Planned model: llama3-70b-8192 (fast inference) or mixtral-8x7b-32768.
 * Planned pricing: effectively free / very low cost during Groq's growth phase.
 * Groq's main value: ultra-fast inference latency (< 500ms for most requests).
 */
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  ProviderHealth,
} from '../AIProvider'
import type { GroqConfig } from '../ProviderConfig'
import { DisabledProviderError } from '../ProviderErrors'

const DEFAULT_PRIORITY = 4

export class GroqAdapter implements AIProvider {
  readonly id       = 'groq'
  readonly name     = 'Groq'
  readonly isActive = false
  readonly priority: number

  constructor(config?: GroqConfig) {
    this.priority = config?.priority ?? DEFAULT_PRIORITY
  }

  validateApiKey(_key: string): boolean {
    // Groq keys start with 'gsk_'
    return false   // Disabled — always returns false
  }

  estimateCost(_request: AIProviderRequest): number {
    return 0
  }

  async generate(_request: AIProviderRequest): Promise<AIProviderResponse> {
    throw new DisabledProviderError('groq')
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      healthy:   false,
      status:    'disabled',
      error:     'Groq adapter is disabled. groq-sdk is installed — enable when ready.',
      checkedAt: new Date().toISOString(),
    }
  }
}
