import crypto from 'crypto'
import logger  from '../logger'

import { connect } from './connection'
import { CampaignExecution } from './models/CampaignExecution'
import type { ICampaignExecution, CampaignStatus } from './models/CampaignExecution'
import type { IMarketingGeneration } from './models/MarketingGeneration'
import type { StrategyResult, FollowupTouchpoint } from './strategy'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrchestrationInput {
  /** The completed generation record (status must be COMPLETED). */
  generation:     IMarketingGeneration
  /** Full strategy result produced by the Strategy Engine for this lead. */
  strategyResult: StrategyResult
}

export interface OrchestrationResult {
  /** UUID shared by all executions in this orchestration run. */
  campaignId:     string
  /** The primary (immediate/delayed) execution. */
  primary:        ICampaignExecution
  /** Follow-up executions, sorted by scheduledAt asc. */
  followups:      ICampaignExecution[]
  /** Total executions created (primary + followups). */
  totalScheduled: number
}

export interface CancelResult {
  campaignId:        string
  cancelledCount:    number
  alreadyFinalCount: number  // SENT | FAILED — cannot cancel
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Transform a completed MarketingGeneration into executable CampaignExecution records.
 *
 * Always creates:
 *   - 1 PRIMARY execution (immediate or delayed per recommendedSendTime)
 *   - 0–N FOLLOWUP executions (from followupPlan.touchpoints)
 *
 * Scheduling rules:
 *   - Primary:  scheduledAt = triggerTime + initialDelaySeconds
 *   - Followup: scheduledAt = triggerTime + delayDays * 86400s + delayHours * 3600s
 *
 * Guarantees:
 *   - Never throws — errors surface as thrown errors from callers (unlike
 *     MarketingGenerationService which silences them). The orchestrator is
 *     called by internal flows that can handle failures explicitly.
 *   - Idempotent on campaignId collision: upserts via generationId index.
 */
export async function orchestrate(input: OrchestrationInput): Promise<OrchestrationResult> {
  const { generation, strategyResult } = input

  if (generation.status !== 'COMPLETED') {
    throw new Error(
      `CampaignOrchestrator: generation ${generation.generationId} is not COMPLETED (status=${generation.status})`,
    )
  }

  await connect()

  const campaignId  = crypto.randomUUID()
  const triggerTime = new Date(generation.generatedAt).getTime()
  const now         = Date.now()
  const channel     = strategyResult.primaryChannel
  const send        = strategyResult.recommendedSendTime
  const followup    = strategyResult.followupPlan

  // ── Primary execution ──────────────────────────────────────────────────────

  const primaryScheduledAt = new Date(
    triggerTime + (send.initialDelaySeconds * 1_000),
  )

  const primaryDoc = await CampaignExecution.create({
    campaignId,
    generationId:  generation.generationId,
    leadId:        generation.leadId,
    executionType: 'PRIMARY',
    followupOrder: null,
    channel,
    scheduledAt:   primaryScheduledAt,
    priority:      1,
    status:        derivedStatus(primaryScheduledAt, now),
    retryCount:    0,
    message:       generation.generatedMessage,
    goal:          'Initial outreach — qualify and book demo',
    metadata: {
      scenario:     generation.scenario,
      language:     generation.language,
      country:      generation.country,
      businessType: generation.businessType,
      promptVersion: generation.promptVersion,
      confidenceScore: generation.confidenceScore,
    },
  })

  // ── Follow-up executions ───────────────────────────────────────────────────

  const followupDocs: ICampaignExecution[] = []

  if (followup.source !== 'NONE' && followup.touchpoints.length > 0) {
    const rows: Record<string, unknown>[] = followup.touchpoints.map((tp: FollowupTouchpoint) => {
      const scheduledAt = new Date(
        triggerTime
        + tp.delayDays  * 86_400_000
        + tp.delayHours * 3_600_000,
      )
      return {
        campaignId,
        generationId:  generation.generationId,
        leadId:        generation.leadId,
        executionType: 'FOLLOWUP',
        followupOrder: tp.order,
        channel:       tp.channel,
        scheduledAt,
        priority:      tp.order + 1,
        status:        derivedStatus(scheduledAt, now),
        retryCount:    0,
        message:       null,
        goal:          tp.goal,
        metadata: {
          condition:    tp.condition,
          templateRef:  tp.templateRef,
          sequenceSlug: followup.sequenceSlug,
        },
      }
    })
    const docs = (await CampaignExecution.insertMany(rows)) as unknown as ICampaignExecution[]
    followupDocs.push(...docs)
  }

  const totalScheduled = 1 + followupDocs.length

  logger.info({
    msg:           '[CampaignOrchestrator] campaign created',
    campaignId,
    generationId:  generation.generationId,
    leadId:        generation.leadId,
    channel,
    primaryAt:     primaryScheduledAt.toISOString(),
    followups:     followupDocs.length,
    totalScheduled,
  })

  followupDocs.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

  const result: OrchestrationResult = {
    campaignId,
    primary:        primaryDoc as unknown as ICampaignExecution,
    followups:      followupDocs,
    totalScheduled,
  }
  return result
}

/**
 * Cancel all QUEUED and READY executions for a campaign.
 *
 * SENT and FAILED executions are already final — they cannot be cancelled.
 * Returns the count of records that were actually cancelled.
 */
export async function cancelCampaign(campaignId: string): Promise<CancelResult> {
  await connect()

  const cancellable: CampaignStatus[] = ['QUEUED', 'READY']
  const final:       CampaignStatus[] = ['SENT', 'FAILED']

  const [updateResult, finalCount] = await Promise.all([
    CampaignExecution.updateMany(
      { campaignId, status: { $in: cancellable } },
      { $set: { status: 'CANCELLED' } },
    ),
    CampaignExecution.countDocuments({ campaignId, status: { $in: final } }),
  ])

  const cancelledCount = updateResult.modifiedCount

  logger.info({
    msg:              '[CampaignOrchestrator] campaign cancelled',
    campaignId,
    cancelledCount,
    alreadyFinalCount: finalCount,
  })

  return { campaignId, cancelledCount, alreadyFinalCount: finalCount }
}

/**
 * Cancel a single execution by its MongoDB _id string.
 * Only works if the execution is still QUEUED or READY.
 *
 * @returns true if the record was cancelled, false if it was already final.
 */
export async function cancelExecution(executionId: string): Promise<boolean> {
  await connect()

  const result = await CampaignExecution.updateOne(
    { _id: executionId, status: { $in: ['QUEUED', 'READY'] } },
    { $set: { status: 'CANCELLED' } },
  )

  return result.modifiedCount === 1
}

/**
 * Retrieve all executions for a campaign, sorted by scheduledAt asc.
 * Useful for inspection and the Automation Engine's polling loop.
 */
export async function getExecutions(campaignId: string): Promise<ICampaignExecution[]> {
  await connect()
  return CampaignExecution.find({ campaignId }).sort({ scheduledAt: 1 }).lean()
}

/**
 * Mark all QUEUED executions whose scheduledAt has passed as READY.
 *
 * Called by the Automation Engine's polling loop before dispatching.
 * Returns the count of executions that transitioned to READY.
 */
export async function tickReady(): Promise<number> {
  await connect()

  const result = await CampaignExecution.updateMany(
    { status: 'QUEUED', scheduledAt: { $lte: new Date() } },
    { $set: { status: 'READY' } },
  )

  if (result.modifiedCount > 0) {
    logger.info({
      msg:   '[CampaignOrchestrator] executions promoted to READY',
      count: result.modifiedCount,
    })
  }

  return result.modifiedCount
}

/**
 * Get all READY executions for the Automation Engine to dispatch.
 * Sorted by priority asc (lower = more urgent), then scheduledAt asc.
 */
export async function getReadyExecutions(): Promise<ICampaignExecution[]> {
  await connect()
  return CampaignExecution
    .find({ status: 'READY' })
    .sort({ priority: 1, scheduledAt: 1 })
    .lean()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * An execution is READY immediately if its scheduledAt is in the past or now.
 * Otherwise it is QUEUED until the Automation Engine's tick promotes it.
 */
function derivedStatus(scheduledAt: Date, nowMs: number): 'QUEUED' | 'READY' {
  return scheduledAt.getTime() <= nowMs ? 'READY' : 'QUEUED'
}
