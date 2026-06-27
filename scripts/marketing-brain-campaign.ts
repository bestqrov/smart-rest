/**
 * Campaign Orchestrator — Phase C Integration Test
 *
 * Proves:
 *   1. MarketingGeneration → orchestrate() → CampaignExecution records created
 *   2. Follow-up executions scheduled (correct count, order, timing)
 *   3. cancelCampaign() → all QUEUED/READY executions set to CANCELLED
 *   4. Cancelled executions cannot be re-activated (status stays CANCELLED)
 *   5. tickReady() promotes QUEUED executions whose scheduledAt has passed
 *   6. getReadyExecutions() returns only READY records, sorted by priority
 *
 * Run:
 *   npm run integration:campaign
 *
 * Requires: DATABASE_URL in .env  (no Gemini call — uses a mock generation record)
 */

import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import { connect, disconnect }   from '../src/marketing-brain/connection'
import { MarketingGeneration }   from '../src/marketing-brain/models/MarketingGeneration'
import { CampaignExecution }     from '../src/marketing-brain/models/CampaignExecution'
import {
  orchestrate,
  cancelCampaign,
  cancelExecution,
  getExecutions,
  tickReady,
  getReadyExecutions,
} from '../src/marketing-brain/CampaignOrchestratorService'
import type { StrategyResult } from '../src/marketing-brain/strategy'

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m',
  red:   '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', grey: '\x1b[90m',
}
const sep  = (ch = '─', w = 60) => c.grey + ch.repeat(w) + c.reset
const ok   = (t: string) => `${c.green}✓ ${t}${c.reset}`
const fail = (t: string) => `${c.red}✗ ${t}${c.reset}`
const step = (n: number, t: string) => console.log(`\n${sep()}\n${c.bold}[${n}] ${t}${c.reset}`)

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) { console.log(ok(message)); passed++ }
  else           { console.error(fail(message)); failed++ }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_LEAD_ID   = new mongoose.Types.ObjectId().toString()
const MOCK_GEN_ID    = crypto.randomUUID()

/** A representative StrategyResult with 3 follow-up touchpoints. */
const MOCK_STRATEGY: StrategyResult = {
  primaryChannel:   'WHATSAPP',
  secondaryChannel: 'EMAIL',
  recommendedSendTime: {
    initialDelaySeconds: 0,
    bestDays:            ['Monday', 'Tuesday', 'Wednesday'],
    bestHourStart:       9,
    bestHourEnd:         12,
    avoidPeriods:        [],
    optimalHour:         9,
    reason:              'Peak engagement window for Morocco',
  },
  followupPlan: {
    source:          'GENERATED',
    sequenceSlug:    null,
    totalTouchpoints: 3,
    maxDays:         14,
    reason:          'Standard demo follow-up sequence',
    touchpoints: [
      {
        order:      1,
        channel:    'WHATSAPP',
        delayDays:  1,
        delayHours: 0,
        condition:  'no_reply',
        goal:       'First follow-up — check if demo was received',
        templateRef: null,
      },
      {
        order:      2,
        channel:    'WHATSAPP',
        delayDays:  3,
        delayHours: 0,
        condition:  'no_reply',
        goal:       'Second follow-up — offer live demo',
        templateRef: null,
      },
      {
        order:      3,
        channel:    'EMAIL',
        delayDays:  7,
        delayHours: 0,
        condition:  'no_reply',
        goal:       'Final follow-up — last chance before closing lead',
        templateRef: null,
      },
    ],
  },
  escalationPlan: {
    triggers: [],
    defaultEscalationAfterDays: 14,
    reason: 'No escalation triggers configured',
  },
  stopConditions: [
    { code: 'CONVERTED',    description: 'Lead booked the demo',         threshold: null },
    { code: 'OPT_OUT',      description: 'Lead explicitly opted out',    threshold: null },
    { code: 'MAX_ATTEMPTS', description: 'Max 3 follow-ups exhausted',   threshold: 3   },
    { code: 'MAX_DAYS',     description: 'Campaign cap reached',         threshold: 14  },
  ],
  expectedDurationDays: 14,
  reasoning: {
    summary:          'Standard demo acquisition sequence for French-speaking Moroccan cafe owner',
    channelReason:    'WhatsApp dominant in Morocco; email as fallback',
    timingReason:     '9am Casablanca is peak engagement',
    sequenceReason:   '3-touch sequence with 1d/3d/7d spacing',
    escalationReason: 'No escalation configured',
    stopReason:       'Stop after 3 touches or conversion',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createMockGeneration(overrides: Partial<{
  generationId: string
  leadId: string
  status: string
}> = {}): Promise<InstanceType<typeof MarketingGeneration>> {
  return MarketingGeneration.create({
    generationId:    overrides.generationId ?? MOCK_GEN_ID,
    leadId:          overrides.leadId       ?? MOCK_LEAD_ID,
    scenario:        'demo_request_submitted',
    channel:         'WHATSAPP',
    language:        'fr',
    country:         'MA',
    businessType:    'cafe',
    status:          (overrides.status ?? 'COMPLETED') as 'COMPLETED' | 'PENDING' | 'FAILED',
    attempts:        1,
    generatedMessage:'Si Karim, votre démo SmartRestau est prête !',
    provider:        'gemini',
    promptVersion:   'v1-test',
    confidenceScore: 100,
    tokens:          500,
    estimatedCost:   0.00005,
    latencyMs:       1200,
    validationStatus:'OUTPUT_VALID',
    error:           null,
  })
}

// ─── Test 1: orchestrate() creates correct execution records ──────────────────

async function testOrchestrate(): Promise<string> {
  step(1, 'orchestrate() — creates PRIMARY + 3 FOLLOWUP execution records')

  const gen    = await createMockGeneration()
  const result = await orchestrate({ generation: gen as never, strategyResult: MOCK_STRATEGY })

  console.log(`\n   campaignId:     ${result.campaignId}`)
  console.log(`   totalScheduled: ${result.totalScheduled}`)
  console.log(`   primary.status: ${result.primary.status}`)
  console.log(`   followups:      ${result.followups.length}`)

  assert(!!result.campaignId,          'campaignId generated')
  assert(result.totalScheduled === 4,  'totalScheduled = 4 (1 primary + 3 followups)')
  assert(result.followups.length === 3,'followups.length = 3')

  // Primary
  const p = result.primary
  assert(p.executionType === 'PRIMARY',       'primary.executionType = PRIMARY')
  assert(p.channel       === 'WHATSAPP',      'primary.channel = WHATSAPP')
  assert(p.priority      === 1,               'primary.priority = 1')
  assert(p.followupOrder === null,            'primary.followupOrder = null')
  assert(p.message !== null,                  'primary.message copied from generation')
  assert(p.status === 'READY' || p.status === 'QUEUED', 'primary.status = READY|QUEUED')

  // Follow-ups ordering
  const [f1, f2, f3] = result.followups
  assert(f1.followupOrder === 1, 'followup[0].order = 1')
  assert(f2.followupOrder === 2, 'followup[1].order = 2')
  assert(f3.followupOrder === 3, 'followup[2].order = 3')

  // Channel variety
  assert(f1.channel === 'WHATSAPP', 'followup[0].channel = WHATSAPP')
  assert(f2.channel === 'WHATSAPP', 'followup[1].channel = WHATSAPP')
  assert(f3.channel === 'EMAIL',    'followup[2].channel = EMAIL')

  // Timing: each followup is later than the previous
  assert(
    f1.scheduledAt.getTime() < f2.scheduledAt.getTime(),
    'followup[0].scheduledAt < followup[1].scheduledAt',
  )
  assert(
    f2.scheduledAt.getTime() < f3.scheduledAt.getTime(),
    'followup[1].scheduledAt < followup[2].scheduledAt',
  )

  // Message: followups have no message (generated at dispatch)
  assert(f1.message === null, 'followup[0].message = null (generated at dispatch)')
  assert(f2.message === null, 'followup[1].message = null')
  assert(f3.message === null, 'followup[2].message = null')

  // Goal recorded
  assert(typeof f1.goal === 'string' && f1.goal.length > 5, 'followup[0].goal set')

  // Verify in MongoDB
  const dbRecords = await getExecutions(result.campaignId)
  assert(dbRecords.length === 4, 'MongoDB: 4 records in campaign_executions')

  // generationId + leadId correctly stored
  assert(dbRecords.every(r => r.generationId === MOCK_GEN_ID), 'all records: generationId matches')
  assert(dbRecords.every(r => r.leadId === MOCK_LEAD_ID),      'all records: leadId matches')

  console.log(`\n   Follow-up schedule:`)
  result.followups.forEach(f => {
    const delay = Math.round((f.scheduledAt.getTime() - Date.now()) / 3_600_000)
    console.log(`   ${c.grey}order=${f.followupOrder} ch=${f.channel} in ~${delay}h${c.reset}`)
  })

  return result.campaignId
}

// ─── Test 2: cancelCampaign() cancels all QUEUED/READY records ────────────────

async function testCancelCampaign(campaignId: string): Promise<void> {
  step(2, 'cancelCampaign() — all QUEUED/READY executions set to CANCELLED')

  const cancelResult = await cancelCampaign(campaignId)

  console.log(`\n   campaignId:      ${cancelResult.campaignId}`)
  console.log(`   cancelledCount:  ${cancelResult.cancelledCount}`)
  console.log(`   alreadyFinal:    ${cancelResult.alreadyFinalCount}`)

  assert(cancelResult.cancelledCount >= 1,    'at least 1 execution was cancelled')
  assert(cancelResult.alreadyFinalCount === 0,'no already-final executions')

  // Verify in MongoDB: no QUEUED or READY remain
  const after = await getExecutions(campaignId)
  const stillActive = after.filter(r => r.status === 'QUEUED' || r.status === 'READY')
  assert(stillActive.length === 0,            'MongoDB: no QUEUED/READY remain after cancel')

  const cancelled = after.filter(r => r.status === 'CANCELLED')
  assert(cancelled.length === after.length,   'MongoDB: all records are CANCELLED')
}

// ─── Test 3: reject PENDING/FAILED generation ─────────────────────────────────

async function testRejectNonCompleted(): Promise<void> {
  step(3, 'orchestrate() — rejects PENDING or FAILED generation')

  const pendingId = new mongoose.Types.ObjectId().toString()
  const pending   = await createMockGeneration({
    generationId: crypto.randomUUID(),
    leadId:       pendingId,
    status:       'PENDING',
  })

  let threw = false
  try {
    await orchestrate({ generation: pending as never, strategyResult: MOCK_STRATEGY })
  } catch {
    threw = true
  }

  assert(threw, 'orchestrate() throws when generation.status ≠ COMPLETED')
}

// ─── Test 4: cancelExecution() — single execution cancel ─────────────────────

async function testCancelExecution(): Promise<void> {
  step(4, 'cancelExecution() — cancels a single QUEUED execution')

  const genId = crypto.randomUUID()
  const leadId = new mongoose.Types.ObjectId().toString()
  const gen   = await createMockGeneration({ generationId: genId, leadId })
  const result = await orchestrate({ generation: gen as never, strategyResult: MOCK_STRATEGY })

  // Cancel only the primary execution
  const primaryId = (result.primary._id as mongoose.Types.ObjectId).toString()
  const cancelled = await cancelExecution(primaryId)

  assert(cancelled, 'cancelExecution() returned true')

  // Primary is now CANCELLED
  const primaryDoc = await CampaignExecution.findById(primaryId)
  assert(primaryDoc?.status === 'CANCELLED', 'primary.status = CANCELLED after cancelExecution()')

  // Follow-ups unchanged
  const followupStatuses = await Promise.all(
    result.followups.map(f => CampaignExecution.findById(f._id)),
  )
  const allUntouched = followupStatuses.every(
    f => f?.status === 'QUEUED' || f?.status === 'READY',
  )
  assert(allUntouched, 'follow-ups are untouched (still QUEUED/READY)')

  // Cannot cancel the same execution twice
  const second = await cancelExecution(primaryId)
  assert(!second, 'cancelExecution() returns false for already-CANCELLED execution')

  // Cleanup
  await cancelCampaign(result.campaignId)
}

// ─── Test 5: tickReady() + getReadyExecutions() ───────────────────────────────

async function testTickReady(): Promise<void> {
  step(5, 'tickReady() promotes QUEUED executions whose scheduledAt ≤ now')

  // Create a fresh campaign — primary with initialDelaySeconds=0 is READY immediately.
  // Manually insert an extra QUEUED record with scheduledAt in the past to test tick.
  const genId  = crypto.randomUUID()
  const leadId = new mongoose.Types.ObjectId().toString()
  const gen    = await createMockGeneration({ generationId: genId, leadId })
  const result = await orchestrate({ generation: gen as never, strategyResult: MOCK_STRATEGY })

  // Force one QUEUED followup's scheduledAt to the past
  const followup = result.followups[0]
  await CampaignExecution.updateOne(
    { _id: followup._id },
    { $set: { scheduledAt: new Date(Date.now() - 5_000), status: 'QUEUED' } },
  )

  const promoted = await tickReady()
  assert(promoted >= 1, `tickReady() promoted at least 1 execution (got ${promoted})`)

  const ready = await getReadyExecutions()
  const ours  = ready.filter(r => r.generationId === genId)
  assert(ours.length >= 1, 'getReadyExecutions() returns our promoted execution')

  // Sorted by priority asc
  const priorities = ours.map(r => r.priority)
  const sorted     = [...priorities].sort((a, b) => a - b)
  assert(
    JSON.stringify(priorities) === JSON.stringify(sorted),
    'getReadyExecutions() sorted by priority asc',
  )

  // Cleanup
  await cancelCampaign(result.campaignId)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const allLeadIds: string[] = [MOCK_LEAD_ID]

async function main(): Promise<void> {
  console.log(`\n${sep('═')}\n${c.bold}  Campaign Orchestrator — Phase C Integration Test${c.reset}\n${sep('═')}`)

  if (!process.env.DATABASE_URL) {
    console.error(fail('DATABASE_URL not set')); process.exit(1)
  }

  await connect()
  console.log(ok('Connected to marketing_brain'))

  const campaignId = await testOrchestrate()
  await testCancelCampaign(campaignId)
  await testRejectNonCompleted()
  await testCancelExecution()
  await testTickReady()

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${sep('═')}`)
  const allPassed = failed === 0
  if (allPassed) {
    console.log(`${c.green}${c.bold}  ✓ ALL ${passed} ASSERTIONS PASSED${c.reset}`)
  } else {
    console.log(`${c.red}${c.bold}  ✗ ${failed} ASSERTION(S) FAILED (${passed} passed)${c.reset}`)
  }
  console.log(sep('═'))

  // Cleanup
  await MarketingGeneration.deleteMany({ leadId: { $in: allLeadIds } }).catch(() => undefined)
  await CampaignExecution.deleteMany({ leadId: { $in: allLeadIds } }).catch(() => undefined)

  process.exit(allPassed ? 0 : 1)
}

main()
  .catch((err: unknown) => {
    console.error(fail('UNHANDLED ERROR'), err)
    process.exit(1)
  })
  .finally(() => disconnect().catch(() => undefined))
