import type { StrategyContext }        from './StrategyContext'
import type { StopCondition, StopCode } from './StrategyResult'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the complete list of conditions that should stop the outreach sequence.
 *
 * Some conditions are always present (OPT_OUT, CONVERTED, HARD_BOUNCE).
 * Others are context-dependent (MAX_DAYS threshold, REPLY_RECEIVED scope).
 *
 * Conditions are sorted by code for a deterministic, stable output.
 *
 * Pure function: no DB access, no side effects.
 */
export function buildStopConditions(ctx: StrategyContext): StopCondition[] {
  const { scenarioKnowledge: sk, personaKnowledge: pk, decisionResult: dr } = ctx

  const urgency        = sk?.urgency         ?? 'MEDIUM'
  const maxFollowupDays = sk?.maxFollowupDays ?? 14
  const nurtureTouches  = pk?.nurtureTouchpoints ?? 3
  const stage           = dr.selectedScenario?.stage

  const conditions: StopCondition[] = []

  // ── Always-on (event-based) ────────────────────────────────────────────────

  conditions.push({
    code:        'OPT_OUT',
    description: 'Lead explicitly opted out, unsubscribed, or asked to stop messaging.',
    threshold:   null,
  })

  conditions.push({
    code:        'CONVERTED',
    description: describeConversion(sk?.cta),
    threshold:   null,
  })

  conditions.push({
    code:        'HARD_BOUNCE',
    description: 'Message undeliverable on all available channels after repeated attempts.',
    threshold:   null,
  })

  // ── Threshold-based ───────────────────────────────────────────────────────

  // MAX_DAYS: absolute calendar cap
  conditions.push({
    code:        'MAX_DAYS',
    description:
      `Stop all outreach after ${maxFollowupDays} calendar day(s) from the trigger, ` +
      'regardless of replies or attempts.',
    threshold: maxFollowupDays,
  })

  // MAX_ATTEMPTS: touchpoint ceiling
  // Add a buffer of 1 over the nurture touchpoints to account for initial message
  const maxAttempts = nurtureTouches + 1
  conditions.push({
    code:        'MAX_ATTEMPTS',
    description:
      `Stop after ${maxAttempts} total outreach attempt(s) (initial + ${nurtureTouches} follow-up(s)).`,
    threshold: maxAttempts,
  })

  // ── Context-dependent ─────────────────────────────────────────────────────

  // REPLY_RECEIVED: soft stop for AWARENESS/CONSIDERATION stages
  // At these stages, a reply = lead engaged = different scenario should take over
  if (stage === 'AWARENESS' || stage === 'CONSIDERATION') {
    conditions.push({
      code:        'REPLY_RECEIVED',
      description:
        `A reply signals lead engagement at the ${stage} stage. ` +
        'Stop this sequence and transition to the next scenario (e.g. CONSIDERATION or DECISION).',
      threshold: null,
    })
  }

  // OBJECTION_FILED: only if we know there's an objection in play
  if (ctx.objectionKnowledge) {
    const resolutionDays = ctx.objectionKnowledge.resolutionWindowDays
    conditions.push({
      code:        'OBJECTION_FILED',
      description:
        `Lead filed an explicit ${ctx.objectionKnowledge.category} objection. ` +
        `Automated sequence stops; human agent has ${resolutionDays} day(s) to resolve it.`,
      threshold: null,
    })
  }

  // For CRITICAL urgency, add an explicit no-reaction stop so we don't waste slots
  if (urgency === 'CRITICAL') {
    conditions.push({
      code:        'MAX_DAYS',   // reuses the same code, different threshold
      description: `CRITICAL urgency: hard stop after 3 days if no engagement (urgency window).`,
      threshold:   3,
    } as StopCondition)
    // Note: deduplicate MAX_DAYS — keep the smaller threshold
  }

  // Deduplicate MAX_DAYS by keeping the strictest (lowest) threshold
  const deduped = deduplicateByCode(conditions)

  // Sort by code for deterministic output
  return deduped.sort((a, b) => a.code.localeCompare(b.code))
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function describeConversion(cta: string | undefined): string {
  const descriptions: Record<string, string> = {
    BOOK_DEMO:   'Lead booked a demo — primary goal achieved. Stop the sequence.',
    START_TRIAL: 'Lead started a free trial — primary goal achieved. Stop the sequence.',
    REPLY:       'Lead replied positively and was moved to the next funnel stage.',
    VIEW_MENU:   'Lead viewed the digital menu and took a qualifying action.',
    REACTIVATE:  'Churned lead reactivated their account.',
    UPSELL:      'Existing customer upgraded to a higher plan.',
    RENEW:       'Subscription renewed — retention goal achieved.',
  }
  return descriptions[cta ?? ''] ?? 'Primary conversion goal achieved. Stop the sequence.'
}

/**
 * For codes that can appear multiple times (MAX_DAYS), keep the entry
 * with the lowest (strictest) threshold.
 */
function deduplicateByCode(conditions: StopCondition[]): StopCondition[] {
  const map = new Map<StopCode, StopCondition>()

  for (const c of conditions) {
    const existing = map.get(c.code)
    if (!existing) {
      map.set(c.code, c)
      continue
    }
    // Keep whichever has the stricter (lower) threshold
    if (c.threshold !== null && (existing.threshold === null || c.threshold < existing.threshold)) {
      map.set(c.code, c)
    }
  }

  return [...map.values()]
}
