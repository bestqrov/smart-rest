import type { Channel } from '../models/MessageTemplate'
import type { StrategyContext } from './StrategyContext'
import type { FollowupPlan, FollowupTouchpoint } from './StrategyResult'

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_DAYS        = 14
const DEFAULT_NURTURE_TOUCHES = 3

// Generated-plan templates by urgency (days between touchpoints)
const URGENCY_CADENCE: Record<string, number[]> = {
  CRITICAL: [0, 1, 2],          // immediate, 1-day gap, 2-day gap
  HIGH:     [0, 2, 5],          // immediate, 2-day, 5-day
  MEDIUM:   [0, 3, 7, 12],      // immediate, then 3 / 7 / 12 days
  LOW:      [0, 5, 10, 14],     // spaced out — don't pressure
}

// Goal labels per sequence position (0-indexed)
const POSITION_GOALS = [
  'Deliver primary value proposition and CTA',
  'Follow up with social proof or case study',
  'Address likely objections with proof',
  'Final nudge — create mild urgency, offer help',
  'Last-chance outreach before sequence ends',
]

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the follow-up touchpoint plan.
 *
 * Priority:
 *   1. DB_SEQUENCE — use the selected FollowupSequence from DecisionResult.
 *      Steps are converted to FollowupTouchpoints with original delays preserved.
 *   2. GENERATED   — no DB sequence; synthesise a minimal plan from knowledge:
 *      urgency → cadence, persona.nurtureTouchpoints, scenario.maxFollowupDays.
 *   3. NONE        — scenario stage or urgency signals single-touch only.
 *
 * The plan is always capped at scenario.maxFollowupDays (or DEFAULT_MAX_DAYS).
 * Same input → same output (cadence arrays are constants, no randomness).
 *
 * Pure function: no DB access, no side effects.
 */
export function planSequence(ctx: StrategyContext, primaryChannel: Channel): FollowupPlan {
  const { decisionResult: dr, scenarioKnowledge: sk, personaKnowledge: pk } = ctx

  const maxDays      = sk?.maxFollowupDays ?? DEFAULT_MAX_DAYS
  const urgency      = sk?.urgency         ?? 'MEDIUM'
  const targetTouches = pk?.nurtureTouchpoints ?? DEFAULT_NURTURE_TOUCHES

  // ── Path 1: use DB follow-up sequence ──────────────────────────────────────
  if (dr.selectedFollowupSequence) {
    const seq    = dr.selectedFollowupSequence
    const active = seq.steps.filter(s => s.isActive).sort((a, b) => a.order - b.order)

    const touchpoints: FollowupTouchpoint[] = active
      .filter(step => {
        const cumulativeDays = step.delayDays
        return cumulativeDays <= maxDays
      })
      .map((step, idx) => ({
        order:       step.order,
        delayDays:   step.delayDays,
        delayHours:  step.delayHours,
        channel:     (step.channelOverride as Channel | null) ?? primaryChannel,
        condition:   step.condition,
        goal:        POSITION_GOALS[idx] ?? `Follow-up ${step.order}`,
        templateRef: step.template.toString(),
      }))

    return {
      source:           'DB_SEQUENCE',
      sequenceSlug:     seq.slug,
      touchpoints,
      totalTouchpoints: touchpoints.length,
      maxDays,
      reason:
        `Using DB sequence '${seq.slug}' (${active.length} active step(s)). ` +
        `${touchpoints.length} step(s) fall within the ${maxDays}-day cap.`,
    }
  }

  // ── Path 2: generate a minimal plan ───────────────────────────────────────
  if (shouldGeneratePlan(urgency, targetTouches)) {
    const cadence = buildCadence(urgency, targetTouches, maxDays)

    const touchpoints: FollowupTouchpoint[] = cadence.map((delayDays, idx) => ({
      order:       idx + 1,
      delayDays,
      delayHours:  0,
      channel:     primaryChannel,
      condition:   idx === 0 ? 'always' : 'no_reply',
      goal:        POSITION_GOALS[idx] ?? `Follow-up ${idx + 1}`,
      templateRef: null,
    }))

    return {
      source:           'GENERATED',
      sequenceSlug:     null,
      touchpoints,
      totalTouchpoints: touchpoints.length,
      maxDays,
      reason:
        `No DB sequence found. Generated ${touchpoints.length} touchpoints using ` +
        `urgency='${urgency}', nurtureTouchpoints=${targetTouches}, maxDays=${maxDays}.`,
    }
  }

  // ── Path 3: single-touch only ─────────────────────────────────────────────
  return {
    source:           'NONE',
    sequenceSlug:     null,
    touchpoints:      [],
    totalTouchpoints: 0,
    maxDays,
    reason:
      `Single-touch scenario (urgency='${urgency}', ` +
      `nurtureTouchpoints=${targetTouches}). No follow-up series planned.`,
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Determines whether to generate a synthetic plan vs no-op. */
function shouldGeneratePlan(urgency: string, targetTouches: number): boolean {
  // Always generate for CRITICAL/HIGH; for MEDIUM/LOW only if touchpoints > 1
  if (urgency === 'CRITICAL' || urgency === 'HIGH') return true
  return targetTouches > 1
}

/**
 * Build the list of delay-day values for each generated touchpoint.
 *
 * Strategy:
 *   - Use the base cadence from URGENCY_CADENCE (capped at targetTouches)
 *   - All delays must be <= maxDays
 *   - First touchpoint is always day 0 (sent after initialDelaySeconds)
 */
function buildCadence(
  urgency:       string,
  targetTouches: number,
  maxDays:       number,
): number[] {
  const base = URGENCY_CADENCE[urgency] ?? URGENCY_CADENCE['MEDIUM']!

  // Extend if targetTouches > base.length by appending evenly-spaced days
  let cadence = [...base]
  while (cadence.length < targetTouches) {
    const last    = cadence[cadence.length - 1]!
    const spacing = Math.max(2, Math.floor(maxDays / targetTouches))
    cadence.push(last + spacing)
  }

  // Trim to targetTouches and apply maxDays cap
  return cadence
    .slice(0, targetTouches)
    .filter(d => d <= maxDays)
}
