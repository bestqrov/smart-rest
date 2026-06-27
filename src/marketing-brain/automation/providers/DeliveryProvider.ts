import type { ICampaignExecution } from '../../models/CampaignExecution'

// ─── DeliveryResult ───────────────────────────────────────────────────────────

export interface DeliveryResult {
  success:           boolean
  provider:          string
  providerMessageId: string | null
  latencyMs:         number
  error:             string | null
  statusCode:        number | null
  /** True = transient failure — the caller may retry. False = permanent. */
  retryable:         boolean
}

// ─── DeliveryPayload ──────────────────────────────────────────────────────────

/** The data structure serialized and sent to every provider endpoint. */
export interface DeliveryPayload {
  executionId:  string
  campaignId:   string
  generationId: string
  leadId:       string
  channel:      string
  message:      string | null
  goal:         string | null
  scheduledAt:  string    // ISO-8601
  priority:     number
  metadata:     Record<string, unknown>
}

// ─── DeliveryProvider interface ───────────────────────────────────────────────

export interface DeliveryProvider {
  /** Stable, machine-readable identifier. */
  readonly id:       string
  /** Human-readable label. */
  readonly name:     string
  /** Only active providers are dispatched to. */
  readonly isActive: boolean

  /**
   * Attempt to deliver one execution.
   * Must never throw — surface errors via DeliveryResult.error + success=false.
   */
  send(execution: ICampaignExecution): Promise<DeliveryResult>

  /** Returns true if the provider endpoint is reachable. */
  healthCheck(): Promise<boolean>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildPayload(execution: ICampaignExecution): DeliveryPayload {
  return {
    executionId:  (execution._id as object).toString(),
    campaignId:   execution.campaignId,
    generationId: execution.generationId,
    leadId:       execution.leadId,
    channel:      execution.channel,
    message:      execution.message,
    goal:         execution.goal,
    scheduledAt:  execution.scheduledAt.toISOString(),
    priority:     execution.priority,
    metadata:     execution.metadata ?? {},
  }
}

/** Classify an HTTP status code as retryable or permanent. */
export function isRetryableStatus(statusCode: number): boolean {
  // 429 Too Many Requests and all 5xx are transient
  return statusCode === 429 || statusCode >= 500
}
