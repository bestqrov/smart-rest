import crypto from 'crypto'
import logger  from '../logger'
import * as AIJobService from '../services/aiJobService'

import { connect }   from './connection'
import { MarketingGeneration } from './models/MarketingGeneration'
import type { Channel }        from './models/MessageTemplate'

import { decide }         from './decision-engine/DecisionEngine'
import { plan  }          from './strategy/StrategyEngine'
import * as CountryKnowledgeService      from './knowledge/CountryKnowledgeService'
import * as PersonaKnowledgeService      from './knowledge/PersonaKnowledgeService'
import * as ScenarioKnowledgeService     from './knowledge/ScenarioKnowledgeService'
import * as BusinessTypeKnowledgeService from './knowledge/BusinessTypeKnowledgeService'
import { build as buildPrompt }           from './prompt-builder/PromptBuilder'
import { runPipeline, processOutput }     from './generation/GenerationPipeline'
import { createAIProviderManager }        from './providers/AIProviderManager'
import type { PromptContext }  from './prompt-builder/PromptContext'
import type { DecisionContext } from './decision-engine/DecisionContext'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Input to the generation service.
 *
 * Maps a SmartRestau DemoRequest (or any lead-like entity) onto the
 * Marketing Brain's DecisionContext.
 */
export interface GenerationInput {
  leadId:       string      // DemoRequest._id — stored for traceability
  ownerName:    string
  cafeName:     string
  cafeCity?:    string
  language:     string      // 'ar' | 'fr' | 'en'
  country:      string      // ISO 3166-1 alpha-2 uppercase: 'MA' | 'SA'
  businessType: string      // Marketing Brain slug: 'cafe' | 'restaurant' etc.
  scenario:     string      // Scenario.trigger: 'demo_request_submitted' etc.
  channel?:     Channel
  persona?:     string
  ownerPhone?:  string
  agentName?:   string
  /** Extra variables forwarded to the template engine. */
  extra?:       Record<string, string | number>
}

export interface GenerationSummary {
  generationId:   string
  status:         'COMPLETED' | 'FAILED'
  attempts:       number
  latencyMs:      number
  tokens:         number | null
  estimatedCost:  number | null
  promptVersion:  string | null
  validationStatus: string | null
  error:          string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS    = 3
const BASE_DELAY_MS   = 1_000   // 1 s → 2 s → 4 s

// ─── Business-type slug map ───────────────────────────────────────────────────
// Translates SmartRestau Prisma enum values → Marketing Brain slugs.

const BT_MAP: Record<string, string> = {
  RESTAURANT: 'restaurant',
  CAFE:       'cafe',
  TRAITEUR:   'caterer',
  PASTRY:     'bakery',
  FOOD_TRUCK: 'food_truck',
  HOTEL:      'hotel',
}

export function mapBusinessType(raw: string): string {
  return BT_MAP[raw.toUpperCase()] ?? 'restaurant'
}

// ─── Language inference ───────────────────────────────────────────────────────
// Infers the preferred marketing language from country code when the caller
// doesn't specify one explicitly.

const FR_COUNTRIES = new Set(['MA', 'TN', 'DZ', 'MR', 'SN', 'CI', 'CM'])

export function inferLanguage(country: string): string {
  return FR_COUNTRIES.has(country.toUpperCase()) ? 'fr' : 'ar'
}

// ─── Core orchestrator ────────────────────────────────────────────────────────

/**
 * Run the complete Marketing Brain generation pipeline for one lead.
 *
 * Guarantees:
 *   - Never throws — all errors are caught and persisted as status=FAILED.
 *   - Every generation has a unique generationId for full traceability.
 *   - Retries up to MAX_ATTEMPTS times with exponential backoff.
 *   - The result (success or failure) is always stored in MongoDB.
 *
 * @returns A summary object — useful for logging / tests. Never throws.
 */
export async function generate(input: GenerationInput): Promise<GenerationSummary> {
  const generationId = crypto.randomUUID()
  const startedAt    = Date.now()

  // ── 0. Create AIJob record ─────────────────────────────────────────────────
  let aiJobId: string | null = null
  try {
    aiJobId = await AIJobService.createJob({
      module:         'marketing',
      jobType:        'campaign_generation',
      priority:       5,
      inputReference: input.leadId,
      metadata:       { scenario: input.scenario, channel: input.channel, country: input.country, language: input.language },
    })
  } catch { /* non-blocking */ }

  // ── 1. Ensure Marketing Brain MongoDB is connected ─────────────────────────
  try {
    await connect()
  } catch (connErr: unknown) {
    const error = connErr instanceof Error ? connErr.message : String(connErr)
    logger.error({ msg: '[MarketingBrain] DB connection failed — skipping generation', generationId, error })
    if (aiJobId) await AIJobService.failJob(aiJobId, error).catch(() => undefined)
    return {
      generationId, status: 'FAILED', attempts: 0,
      latencyMs: Date.now() - startedAt, tokens: null,
      estimatedCost: null, promptVersion: null, validationStatus: null,
      error,
    }
  }

  if (aiJobId) await AIJobService.startJob(aiJobId).catch(() => undefined)

  // ── 2. Create PENDING record ────────────────────────────────────────────────
  await MarketingGeneration.create({
    generationId,
    leadId:      input.leadId,
    scenario:    input.scenario,
    channel:     input.channel ?? 'WHATSAPP',
    language:    input.language,
    country:     input.country,
    businessType: input.businessType,
    status:      'PENDING',
    attempts:    0,
  }).catch((err: unknown) => {
    logger.warn({ msg: '[MarketingBrain] could not create PENDING record', generationId, err })
  })

  // ── 3. Retry loop ───────────────────────────────────────────────────────────
  let lastError: string | null = null
  let attempt                  = 0

  for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await runOnce(input, generationId)

      // Success
      const latencyMs = Date.now() - startedAt
      await MarketingGeneration.updateOne(
        { generationId },
        {
          status:           'COMPLETED',
          attempts:         attempt,
          generatedMessage: result.generatedMessage,
          provider:         result.provider,
          promptVersion:    result.promptVersion,
          confidenceScore:  result.confidenceScore,
          tokens:           result.tokens,
          estimatedCost:    result.estimatedCost,
          latencyMs,
          validationStatus: result.validationStatus,
          error:            null,
        },
      )

      if (aiJobId) {
        await AIJobService.completeJob(aiJobId, {
          outputReference: generationId,
          totalTokens:     result.tokens,
          estimatedCost:   result.estimatedCost,
          metadata:        { provider: result.provider, model: result.promptVersion, attempt },
        }).catch(() => undefined)
      }

      logger.info({
        msg:           '[MarketingBrain] generation completed',
        generationId,
        leadId:        input.leadId,
        attempt,
        tokens:        result.tokens,
        latencyMs,
      })

      return {
        generationId,
        status:           'COMPLETED',
        attempts:         attempt,
        latencyMs,
        tokens:           result.tokens,
        estimatedCost:    result.estimatedCost,
        promptVersion:    result.promptVersion,
        validationStatus: result.validationStatus,
        error:            null,
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err)

      logger.warn({
        msg:         '[MarketingBrain] attempt failed',
        generationId,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        error:       lastError,
      })

      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, BASE_DELAY_MS * 2 ** (attempt - 1)))
      }
    }
  }

  // All attempts exhausted
  const latencyMs = Date.now() - startedAt
  await MarketingGeneration.updateOne(
    { generationId },
    { status: 'FAILED', attempts: attempt - 1, error: lastError, latencyMs },
  ).catch(() => undefined)

  if (aiJobId) {
    await AIJobService.failJob(aiJobId, lastError ?? 'All attempts exhausted', true).catch(() => undefined)
  }

  logger.error({
    msg:         '[MarketingBrain] generation failed after all attempts',
    generationId,
    leadId:      input.leadId,
    attempts:    attempt - 1,
    error:       lastError,
  })

  return {
    generationId,
    status:           'FAILED',
    attempts:         attempt - 1,
    latencyMs,
    tokens:           null,
    estimatedCost:    null,
    promptVersion:    null,
    validationStatus: null,
    error:            lastError,
  }
}

// ─── Single attempt ───────────────────────────────────────────────────────────

interface RunResult {
  generatedMessage: string
  provider:         string
  promptVersion:    string
  confidenceScore:  number
  tokens:           number
  estimatedCost:    number
  validationStatus: string
}

async function runOnce(input: GenerationInput, generationId: string): Promise<RunResult> {
  const ctx: DecisionContext = {
    ownerName:    input.ownerName,
    language:     input.language,
    country:      input.country,
    businessType: input.businessType,
    scenario:     input.scenario,
    channel:      input.channel,
    persona:      input.persona,
    cafeName:     input.cafeName,
    cafeCity:     input.cafeCity,
    ownerPhone:   input.ownerPhone,
    agentName:    input.agentName,
    campaignGoal: 'CONVERT',
    ...(input.extra as Partial<DecisionContext>),
  }

  // Decision Engine
  const decisionResult = await decide(ctx)
  if (decisionResult.errors.length) {
    throw new Error(`DecisionEngine: ${decisionResult.errors.join('; ')}`)
  }
  if (!decisionResult.selectedTemplate) {
    throw new Error('DecisionEngine: no template matched — check language/scenario/businessType')
  }

  // Strategy Engine
  const strategyResult = await plan(decisionResult, ctx)

  // Knowledge (parallel — silent failures are OK)
  const [countryKnowledge, personaKnowledge, scenarioKnowledge, businessTypeKnowledge] =
    await Promise.all([
      CountryKnowledgeService     .getByCode(input.country).catch(() => null),
      decisionResult.reasoning.steps.find(s => s.dimension === 'PERSONA')?.selected
        ? PersonaKnowledgeService .getBySlug(
            decisionResult.reasoning.steps.find(s => s.dimension === 'PERSONA')!.selected,
          ).catch(() => null)
        : Promise.resolve(null),
      ScenarioKnowledgeService    .getByTrigger(input.scenario).catch(() => null),
      BusinessTypeKnowledgeService.getBySlug(input.businessType).catch(() => null),
    ])

  // Prompt Builder
  const promptCtx: PromptContext = {
    decisionResult,
    decisionContext: ctx,
    strategyResult,
    countryKnowledge:      countryKnowledge      ?? null,
    personaKnowledge:      personaKnowledge      ?? null,
    scenarioKnowledge:     scenarioKnowledge     ?? null,
    businessTypeKnowledge: businessTypeKnowledge ?? null,
    objectionKnowledge:    null,
  }

  const buildResult = buildPrompt(promptCtx)
  if (!buildResult.ok) {
    type FailedBuild = { ok: false; errors: string[] }
    throw new Error(`PromptBuilder: ${(buildResult as unknown as FailedBuild).errors.join('; ')}`)
  }
  const { result: promptResult } = buildResult

  // Generation Pipeline pre-flight
  const pipeline = runPipeline({ promptResult })
  if (pipeline.status !== 'READY_TO_SEND') {
    throw new Error(`Pipeline pre-flight blocked: ${pipeline.status}`)
  }

  // AI Provider call
  const manager = createAIProviderManager(
    { gemini: { apiKey: process.env.GEMINI_API_KEY ?? '' } },
    { clearExisting: false },   // keep existing registry if already initialised
  )

  let tokens         = 0
  let estimatedCost  = 0

  manager.addUsageHook(event => {
    tokens        = event.totalTokens
    estimatedCost = event.costUsd
  })

  const genResult = await manager.generate({
    systemPrompt: promptResult.systemPrompt,
    userPrompt:   promptResult.userPrompt,
    maxTokens:    512,
    temperature:  0.7,
    metadata:     {
      generationId,
      leadId: input.leadId,
      scenario: input.scenario,
    },
  })

  if (!genResult.ok) {
    type FailedGen = { ok: false; error: string }
    throw new Error(`AIProvider: ${(genResult as unknown as FailedGen).error}`)
  }

  // Output Validation
  const finalPipeline = processOutput(pipeline, genResult.response.content)
  if (finalPipeline.status !== 'OUTPUT_VALID') {
    throw new Error(`OutputValidator: ${finalPipeline.status}`)
  }

  return {
    generatedMessage: finalPipeline.validatedOutput!.content,
    provider:         genResult.response.provider,
    promptVersion:    promptResult.version,
    confidenceScore:  decisionResult.confidenceScore,
    tokens,
    estimatedCost,
    validationStatus: finalPipeline.status,
  }
}
