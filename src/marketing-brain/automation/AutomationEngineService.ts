import logger from '../../logger'
import { connect } from '../connection'
import { CampaignExecution } from '../models/CampaignExecution'
import { getReadyExecutions, tickReady } from '../CampaignOrchestratorService'
import type { ICampaignExecution } from '../models/CampaignExecution'
import { DeliveryAuditLog } from './models/DeliveryAuditLog'
import type { DeliveryProvider, DeliveryResult } from './providers/DeliveryProvider'
import { N8nAdapter } from './providers/N8nAdapter'
import type { N8nConfig } from './providers/N8nAdapter'

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AutomationEngineConfig {
  /** How many delivery attempts per execution before giving up. Default: 3. */
  maxAttempts?:    number
  /** Base delay for exponential backoff in ms. Default: 1 000. */
  baseDelayMs?:    number
  /** Polling interval in ms for the continuous loop. Default: 30 000. */
  pollIntervalMs?: number
  /** n8n webhook configuration. Required for production; can be omitted in tests. */
  n8n?:            N8nConfig
  /** Override providers list (useful in tests). */
  providers?:      DeliveryProvider[]
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface RunOnceResult {
  processed:  number
  sent:       number
  failed:     number
  skipped:    number
  durationMs: number
}

export interface DeliveryAttemptResult {
  executionId: string
  finalStatus: 'SENT' | 'FAILED'
  attempts:    number
  lastResult:  DeliveryResult
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_ATTEMPTS  = 3
const DEFAULT_BASE_DELAY_MS = 1_000

// ─── AutomationEngineService ──────────────────────────────────────────────────

export class AutomationEngineService {
  private readonly providers:     DeliveryProvider[]
  private readonly maxAttempts:   number
  private readonly baseDelayMs:   number
  private readonly pollIntervalMs: number

  private pollingTimer: ReturnType<typeof setTimeout> | null = null
  private running      = false

  constructor(config: AutomationEngineConfig = {}) {
    this.maxAttempts    = config.maxAttempts    ?? DEFAULT_MAX_ATTEMPTS
    this.baseDelayMs    = config.baseDelayMs    ?? DEFAULT_BASE_DELAY_MS
    this.pollIntervalMs = config.pollIntervalMs ?? 30_000

    if (config.providers) {
      this.providers = config.providers
    } else {
      this.providers = []
      if (config.n8n) {
        this.providers.push(new N8nAdapter(config.n8n))
      }
    }
  }

  // ── Provider selection ──────────────────────────────────────────────────────

  private selectProvider(channel: string): DeliveryProvider | null {
    // For now: any active provider handles all channels.
    // Future: match provider by channel capability.
    const active = this.providers.filter(p => p.isActive)
    return active[0] ?? null
  }

  // ── Core: deliver one execution with retries ────────────────────────────────

  async deliverWithRetry(execution: ICampaignExecution): Promise<DeliveryAttemptResult> {
    const executionId = (execution._id as object).toString()

    // Guard: never send CANCELLED executions
    if (execution.status === 'CANCELLED') {
      throw new Error(
        `AutomationEngine: cannot deliver CANCELLED execution ${executionId}`,
      )
    }

    // Guard: never send future QUEUED executions
    if (execution.status === 'QUEUED') {
      throw new Error(
        `AutomationEngine: cannot deliver QUEUED execution ${executionId} — run tickReady() first`,
      )
    }

    const provider = this.selectProvider(execution.channel)
    if (!provider) {
      const err = `No active provider available for channel ${execution.channel}`
      await this.markFailed(execution, err, 1)
      return {
        executionId,
        finalStatus: 'FAILED',
        attempts:    1,
        lastResult:  {
          success: false, provider: 'none', providerMessageId: null,
          latencyMs: 0, error: err, statusCode: null, retryable: false,
        },
      }
    }

    let lastResult: DeliveryResult | null = null
    let attempt = 0

    while (attempt < this.maxAttempts) {
      attempt++

      lastResult = await provider.send(execution)

      // Write audit log for every attempt
      await this.writeAuditLog(execution, lastResult, attempt)

      if (lastResult.success) {
        await this.markSent(execution, lastResult)
        return { executionId, finalStatus: 'SENT', attempts: attempt, lastResult }
      }

      logger.warn({
        msg:         '[AutomationEngine] delivery attempt failed',
        executionId,
        attempt,
        maxAttempts: this.maxAttempts,
        error:       lastResult.error,
        retryable:   lastResult.retryable,
      })

      // Permanent failure — stop retrying immediately
      if (!lastResult.retryable) {
        break
      }

      // Transient failure — wait before next attempt (except after last attempt)
      if (attempt < this.maxAttempts) {
        await sleep(this.baseDelayMs * 2 ** (attempt - 1))
      }
    }

    // All attempts exhausted or permanent failure
    await this.markFailed(execution, lastResult!.error ?? 'Unknown delivery error', attempt)

    return {
      executionId,
      finalStatus: 'FAILED',
      attempts:    attempt,
      lastResult:  lastResult!,
    }
  }

  // ── Core: process all READY executions ─────────────────────────────────────

  async runOnce(): Promise<RunOnceResult> {
    await connect()

    const startedAt = Date.now()

    // Promote any QUEUED executions whose scheduledAt has passed
    await tickReady()

    const executions = await getReadyExecutions()

    let sent    = 0
    let failed  = 0
    let skipped = 0

    for (const execution of executions) {
      if (execution.status === 'CANCELLED') {
        skipped++
        continue
      }

      try {
        const result = await this.deliverWithRetry(execution)
        if (result.finalStatus === 'SENT') sent++
        else                               failed++
      } catch (err: unknown) {
        // Unexpected error (e.g. DB failure) — log and continue
        logger.error({
          msg:         '[AutomationEngine] unexpected error during delivery',
          executionId: (execution._id as object).toString(),
          err,
        })
        skipped++
      }
    }

    const result: RunOnceResult = {
      processed:  executions.length,
      sent,
      failed,
      skipped,
      durationMs: Date.now() - startedAt,
    }

    logger.info({ msg: '[AutomationEngine] runOnce complete', ...result })

    return result
  }

  // ── Polling loop ───────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return
    this.running = true

    const poll = async () => {
      try {
        await this.runOnce()
      } catch (err: unknown) {
        logger.error({ msg: '[AutomationEngine] poll error', err })
      } finally {
        if (this.running) {
          this.pollingTimer = setTimeout(poll, this.pollIntervalMs)
        }
      }
    }

    void poll()
  }

  stop(): void {
    this.running = false
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer)
      this.pollingTimer = null
    }
    logger.info({ msg: '[AutomationEngine] stopped' })
  }

  // ── Internal state mutators ────────────────────────────────────────────────

  private async markSent(
    execution: ICampaignExecution,
    result:    DeliveryResult,
  ): Promise<void> {
    await CampaignExecution.updateOne(
      { _id: execution._id },
      {
        $set: { status: 'SENT' },
        $inc: { retryCount: 0 },   // no increment on success
      },
    )
    logger.info({
      msg:               '[AutomationEngine] execution SENT',
      executionId:       (execution._id as object).toString(),
      provider:          result.provider,
      providerMessageId: result.providerMessageId,
      latencyMs:         result.latencyMs,
    })
  }

  private async markFailed(
    execution: ICampaignExecution,
    error:     string,
    attempts:  number,
  ): Promise<void> {
    await CampaignExecution.updateOne(
      { _id: execution._id },
      {
        $set: { status: 'FAILED' },
        $inc: { retryCount: attempts },
      },
    )
    logger.error({
      msg:         '[AutomationEngine] execution FAILED permanently',
      executionId: (execution._id as object).toString(),
      attempts,
      error,
    })
  }

  private async writeAuditLog(
    execution: ICampaignExecution,
    result:    DeliveryResult,
    attempt:   number,
  ): Promise<void> {
    try {
      await DeliveryAuditLog.create({
        executionId:       (execution._id as object).toString(),
        campaignId:        execution.campaignId,
        generationId:      execution.generationId,
        leadId:            execution.leadId,
        channel:           execution.channel,
        provider:          result.provider,
        attempt,
        success:           result.success,
        providerMessageId: result.providerMessageId,
        statusCode:        result.statusCode,
        latencyMs:         result.latencyMs,
        error:             result.error,
        retryable:         result.retryable,
        deliveredAt:       new Date(),
      })
    } catch (err: unknown) {
      // Audit log failure must never crash the delivery flow
      logger.error({ msg: '[AutomationEngine] failed to write audit log', err })
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Default factory ──────────────────────────────────────────────────────────

/**
 * Build an AutomationEngineService from environment variables.
 *
 * Requires N8N_WEBHOOK_URL in the environment. Optional: N8N_WEBHOOK_SECRET.
 */
export function createDefaultEngine(
  overrides: Partial<AutomationEngineConfig> = {},
): AutomationEngineService {
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('AutomationEngine: N8N_WEBHOOK_URL is not set')
  }
  return new AutomationEngineService({
    n8n: {
      webhookUrl,
      webhookSecret: process.env.N8N_WEBHOOK_SECRET,
    },
    ...overrides,
  })
}
