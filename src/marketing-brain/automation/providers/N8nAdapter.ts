import type { ICampaignExecution } from '../../models/CampaignExecution'
import {
  buildPayload,
  isRetryableStatus,
} from './DeliveryProvider'
import type { DeliveryProvider, DeliveryResult } from './DeliveryProvider'

export interface N8nConfig {
  /** Full URL of the n8n webhook endpoint, e.g. https://n8n.example.com/webhook/abc */
  webhookUrl:     string
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?:     number
  /** Secret forwarded as X-Webhook-Secret header (optional). */
  webhookSecret?: string
}

export class N8nAdapter implements DeliveryProvider {
  readonly id       = 'n8n'
  readonly name     = 'n8n Workflow Automation'
  readonly isActive = true

  private readonly webhookUrl:    string
  private readonly timeoutMs:     number
  private readonly webhookSecret: string | undefined

  constructor(config: N8nConfig) {
    this.webhookUrl    = config.webhookUrl
    this.timeoutMs     = config.timeoutMs ?? 10_000
    this.webhookSecret = config.webhookSecret
  }

  async send(execution: ICampaignExecution): Promise<DeliveryResult> {
    const payload   = buildPayload(execution)
    const startedAt = Date.now()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Source':     'smartrestau-marketing-brain',
    }
    if (this.webhookSecret) {
      headers['X-Webhook-Secret'] = this.webhookSecret
    }

    const controller = new AbortController()
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(this.webhookUrl, {
        method:  'POST',
        headers,
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      })

      const latencyMs = Date.now() - startedAt

      if (res.ok) {
        let providerMessageId: string | null = null
        try {
          const body = await res.json() as Record<string, unknown>
          providerMessageId =
            (body.executionId as string | undefined)
            ?? (body.messageId as string | undefined)
            ?? (body.id as string | undefined)
            ?? null
        } catch {
          // response body is not JSON or empty — that's fine
        }

        return {
          success:           true,
          provider:          this.id,
          providerMessageId,
          latencyMs,
          error:             null,
          statusCode:        res.status,
          retryable:         false,
        }
      }

      // Non-2xx
      let errorBody = ''
      try { errorBody = await res.text() } catch { /* ignore */ }

      return {
        success:           false,
        provider:          this.id,
        providerMessageId: null,
        latencyMs,
        error:             `HTTP ${res.status}: ${errorBody.slice(0, 200)}`,
        statusCode:        res.status,
        retryable:         isRetryableStatus(res.status),
      }
    } catch (err: unknown) {
      const latencyMs = Date.now() - startedAt
      const isAbort   = err instanceof Error && err.name === 'AbortError'

      return {
        success:           false,
        provider:          this.id,
        providerMessageId: null,
        latencyMs,
        error:             isAbort
          ? `Webhook timeout after ${this.timeoutMs}ms`
          : `Network error: ${err instanceof Error ? err.message : String(err)}`,
        statusCode:        null,
        retryable:         true,   // network errors are always retryable
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timer      = setTimeout(() => controller.abort(), 5_000)
      const res        = await fetch(this.webhookUrl, {
        method: 'HEAD',
        signal: controller.signal,
      }).finally(() => clearTimeout(timer))
      // Any response (including 405 Method Not Allowed) means the endpoint is reachable
      return res.status < 500
    } catch {
      return false
    }
  }
}
