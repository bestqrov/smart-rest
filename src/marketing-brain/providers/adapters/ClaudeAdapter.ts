/**
 * DISABLED PLACEHOLDER — Anthropic Claude
 *
 * This adapter is intentionally inactive. It implements the AIProvider interface
 * so the registry and selector can enumerate it, but every method that would
 * make a real API call throws DisabledProviderError.
 *
 * To enable: set isActive = true, install @anthropic-ai/sdk, implement generate().
 *
 * Planned model: claude-3-5-sonnet-20241022 or later.
 * Planned pricing (approx): $3/1M input, $15/1M output.
 */
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  ProviderHealth,
} from '../AIProvider'
import type { ClaudeConfig } from '../ProviderConfig'
import { DisabledProviderError } from '../ProviderErrors'

const DEFAULT_PRIORITY = 2

export class ClaudeAdapter implements AIProvider {
  readonly id       = 'claude'
  readonly name     = 'Anthropic Claude'
  readonly isActive = false
  readonly priority: number

  constructor(config?: ClaudeConfig) {
    this.priority = config?.priority ?? DEFAULT_PRIORITY
  }

  validateApiKey(_key: string): boolean {
    // Anthropic keys start with 'sk-ant-'
    return false   // Disabled — always returns false
  }

  estimateCost(_request: AIProviderRequest): number {
    return 0   // Disabled — no cost estimate
  }

  async generate(_request: AIProviderRequest): Promise<AIProviderResponse> {
    throw new DisabledProviderError('claude')
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      healthy:   false,
      status:    'disabled',
      error:     'Claude adapter is disabled. It is a placeholder for future integration.',
      checkedAt: new Date().toISOString(),
    }
  }
}
