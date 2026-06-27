import type { DecisionResult }  from '../decision-engine/DecisionResult'
import type { DecisionContext }  from '../decision-engine/DecisionContext'
import type { StrategyContext }  from './StrategyContext'
import type { StrategyResult }   from './StrategyResult'

import * as CountryKnowledgeService      from '../knowledge/CountryKnowledgeService'
import * as PersonaKnowledgeService      from '../knowledge/PersonaKnowledgeService'
import * as ScenarioKnowledgeService     from '../knowledge/ScenarioKnowledgeService'
import * as BusinessTypeKnowledgeService from '../knowledge/BusinessTypeKnowledgeService'
import * as ObjectionKnowledgeService    from '../knowledge/ObjectionKnowledgeService'

import { planChannels }        from './ChannelPlanner'
import { planTiming }          from './TimingPlanner'
import { planSequence }        from './SequencePlanner'
import { planEscalation }      from './EscalationPlanner'
import { buildStopConditions } from './StopConditions'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Plan the complete outreach strategy for a given DecisionResult.
 *
 * Steps:
 *   1. Fetch all required knowledge objects in parallel (one round-trip each)
 *   2. Assemble the StrategyContext
 *   3. Run all planners (pure, synchronous)
 *   4. Build the unified StrategyResult
 *
 * Never throws — errors in knowledge fetching are silent (null knowledge).
 * The planners always produce a valid strategy with available data.
 *
 * Guarantees determinism: same DecisionResult + DecisionContext → same StrategyResult.
 */
export async function plan(
  decisionResult:  DecisionResult,
  decisionContext: DecisionContext,
): Promise<StrategyResult> {
  // 1. Resolve persona slug (may have been inferred during decision phase)
  const personaSlug = resolvePersonaSlug(decisionResult, decisionContext)

  // 2. Fetch knowledge in parallel — all nullable, no throws
  const [countryKnowledge, personaKnowledge, scenarioKnowledge, businessTypeKnowledge, objectionKnowledge] =
    await Promise.all([
      CountryKnowledgeService     .getByCode(decisionContext.country).catch(() => null),
      personaSlug
        ? PersonaKnowledgeService .getBySlug(personaSlug).catch(() => null)
        : Promise.resolve(null),
      ScenarioKnowledgeService    .getByTrigger(decisionContext.scenario).catch(() => null),
      BusinessTypeKnowledgeService.getBySlug(decisionContext.businessType).catch(() => null),
      decisionContext.objection
        ? ObjectionKnowledgeService.getBySlug(decisionContext.objection).catch(() => null)
        : Promise.resolve(null),
    ])

  // 3. Assemble StrategyContext
  const ctx: StrategyContext = {
    decisionResult,
    decisionContext,
    countryKnowledge,
    personaKnowledge,
    scenarioKnowledge,
    businessTypeKnowledge,
    objectionKnowledge,
  }

  // 4. Run planners (pure, synchronous)
  const channelPlan    = planChannels(ctx)
  const timingPlan     = planTiming(ctx)
  const sequencePlan   = planSequence(ctx, channelPlan.primaryChannel)
  const escalationPlan = planEscalation(ctx)
  const stopConditions = buildStopConditions(ctx)

  // 5. Compute expectedDurationDays
  const maxTouchpointDay = sequencePlan.touchpoints.reduce(
    (max, tp) => Math.max(max, tp.delayDays),
    0,
  )
  const expectedDurationDays = Math.min(
    maxTouchpointDay,
    sequencePlan.maxDays,
  )

  // 6. Build unified reasoning
  const summary = buildSummary(
    channelPlan.primaryChannel,
    channelPlan.secondaryChannel,
    timingPlan,
    sequencePlan,
    escalationPlan.triggers.length,
    decisionResult.confidenceScore,
  )

  return {
    primaryChannel:      channelPlan.primaryChannel,
    secondaryChannel:    channelPlan.secondaryChannel,
    recommendedSendTime: timingPlan,
    followupPlan:        sequencePlan,
    escalationPlan,
    stopConditions,
    expectedDurationDays,
    reasoning: {
      summary,
      channelReason:    channelPlan.reason,
      timingReason:     timingPlan.reason,
      sequenceReason:   sequencePlan.reason,
      escalationReason: escalationPlan.reason,
      stopReason:       buildStopReason(stopConditions),
    },
  }
}

/**
 * Variant that accepts a pre-assembled StrategyContext.
 * Useful when knowledge is already available (e.g. in tests or cached contexts).
 * Synchronous — no DB calls.
 */
export function planFromContext(ctx: StrategyContext): StrategyResult {
  const channelPlan    = planChannels(ctx)
  const timingPlan     = planTiming(ctx)
  const sequencePlan   = planSequence(ctx, channelPlan.primaryChannel)
  const escalationPlan = planEscalation(ctx)
  const stopConditions = buildStopConditions(ctx)

  const maxTouchpointDay = sequencePlan.touchpoints.reduce(
    (max, tp) => Math.max(max, tp.delayDays),
    0,
  )
  const expectedDurationDays = Math.min(maxTouchpointDay, sequencePlan.maxDays)

  const summary = buildSummary(
    channelPlan.primaryChannel,
    channelPlan.secondaryChannel,
    timingPlan,
    sequencePlan,
    escalationPlan.triggers.length,
    ctx.decisionResult.confidenceScore,
  )

  return {
    primaryChannel:      channelPlan.primaryChannel,
    secondaryChannel:    channelPlan.secondaryChannel,
    recommendedSendTime: timingPlan,
    followupPlan:        sequencePlan,
    escalationPlan,
    stopConditions,
    expectedDurationDays,
    reasoning: {
      summary,
      channelReason:    channelPlan.reason,
      timingReason:     timingPlan.reason,
      sequenceReason:   sequencePlan.reason,
      escalationReason: escalationPlan.reason,
      stopReason:       buildStopReason(stopConditions),
    },
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extract the persona slug used during decision-making.
 * Caller may have provided it explicitly in DecisionContext.
 * If not, extract it from the PERSONA reasoning step (set by DecisionEngine).
 */
function resolvePersonaSlug(result: DecisionResult, ctx: DecisionContext): string | null {
  if (ctx.persona) return ctx.persona
  const personaStep = result.reasoning.steps.find(s => s.dimension === 'PERSONA')
  const slug        = personaStep?.selected
  return slug && slug !== '—' ? slug : null
}

function buildSummary(
  primary:       string,
  secondary:     string | null,
  timing:        { bestHourStart: number; bestHourEnd: number; bestDays: string[] },
  sequence:      { source: string; totalTouchpoints: number; maxDays: number },
  escalations:   number,
  confidence:    number,
): string {
  const channelDesc = secondary
    ? `${primary} → ${secondary} (fallback)`
    : primary

  const windowDesc = `${timing.bestHourStart}:00–${timing.bestHourEnd}:00`
  const dayDesc    = timing.bestDays.slice(0, 3).join('/')

  return [
    `Channel: ${channelDesc}`,
    `Window: ${windowDesc} on ${dayDesc}`,
    `Sequence: ${sequence.totalTouchpoints} touchpoint(s) over ${sequence.maxDays}d [${sequence.source}]`,
    `${escalations} escalation trigger(s)`,
    `Decision confidence: ${confidence}/100`,
  ].join(' | ')
}

function buildStopReason(conditions: import('./StrategyResult').StopCondition[]): string {
  const codes = conditions.map(c =>
    c.threshold !== null ? `${c.code}(${c.threshold})` : c.code,
  )
  return `${conditions.length} stop condition(s): [${codes.join(', ')}]`
}
