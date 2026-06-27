import type { StrategyContext }   from './StrategyContext'
import type { EscalationPlan, EscalationTrigger } from './StrategyResult'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the escalation plan: when and how to hand off to a human agent.
 *
 * Triggers are assembled from multiple signals:
 *   - Urgency (CRITICAL → immediate escalation path)
 *   - Persona trust requirement (HIGH → early escalation)
 *   - Active objection (objectionKnowledge.escalationTrigger)
 *   - Always-on: max unanswered follow-ups + no conversion at end of sequence
 *
 * Result is sorted by minDaysSinceStart ascending (earliest triggers first).
 * Same input → same output (deterministic).
 *
 * Pure function: no DB access, no side effects.
 */
export function planEscalation(ctx: StrategyContext): EscalationPlan {
  const { scenarioKnowledge: sk, personaKnowledge: pk, objectionKnowledge: ok } = ctx

  const urgency          = sk?.urgency         ?? 'MEDIUM'
  const trustRequirement = pk?.trustRequirement ?? 'MEDIUM'
  const maxFollowupDays  = sk?.maxFollowupDays  ?? 14
  const nurtureTouches   = pk?.nurtureTouchpoints ?? 3

  const triggers: EscalationTrigger[] = []

  // 1. CRITICAL urgency → human-in-the-loop from day 1
  if (urgency === 'CRITICAL') {
    triggers.push({
      code:              'CRITICAL_URGENCY',
      condition:         'Scenario urgency is CRITICAL — immediate human oversight required',
      action:            'ASSIGN_TO_HUMAN',
      description:
        'This is a time-sensitive scenario. Route to a human agent immediately ' +
        'after the first automated message is sent.',
      minDaysSinceStart: 0,
    })
  }

  // 2. No reply after first touchpoint on HIGH+ urgency
  if (urgency === 'HIGH' || urgency === 'CRITICAL') {
    triggers.push({
      code:              'HIGH_URGENCY_NO_REPLY',
      condition:         'No reply after 24 hours on a HIGH/CRITICAL urgency scenario',
      action:            'SEND_MANAGER_ALERT',
      description:
        'Lead has not replied within 24 hours of the first message. ' +
        'Notify the sales manager for manual follow-up.',
      minDaysSinceStart: 1,
    })
  }

  // 3. High trust requirement persona → escalate early
  if (trustRequirement === 'HIGH') {
    const dayThreshold = Math.max(1, Math.floor(maxFollowupDays * 0.4))
    triggers.push({
      code:              'HIGH_TRUST_NO_RESPONSE',
      condition:         `No reply after ${dayThreshold} day(s) for a high-trust-requirement persona`,
      action:            'ASSIGN_TO_HUMAN',
      description:
        `Persona '${pk?.slug ?? 'unknown'}' requires high trust to convert. ` +
        `After ${dayThreshold} days without a response, automated outreach is unlikely to work — ` +
        'a human conversation is more effective.',
      minDaysSinceStart: dayThreshold,
    })
  }

  // 4. Objection-specific escalation
  if (ok) {
    const objectionDays = Math.min(ok.resolutionWindowDays, maxFollowupDays)
    triggers.push({
      code:              `OBJECTION_${ok.category}_UNRESOLVED`,
      condition:         ok.escalationTrigger,
      action:            'ASSIGN_TO_HUMAN',
      description:
        `Active objection '${ok.category}' (${ok.slug}): ${ok.escalationTrigger}. ` +
        `Resolution window: ${objectionDays} day(s). Human agent can address the ` +
        `underlying concern: "${ok.underlyingFear}".`,
      minDaysSinceStart: objectionDays,
    })
  }

  // 5. Max unanswered follow-ups (always present)
  triggers.push({
    code:              'MAX_FOLLOWUPS_NO_REPLY',
    condition:         `${nurtureTouches} follow-up(s) sent with no reply`,
    action:            'ASSIGN_TO_HUMAN',
    description:
      `After ${nurtureTouches} unanswered touchpoints, automated outreach has ` +
      'reached diminishing returns. Route to a human agent for a personalised approach.',
    minDaysSinceStart: Math.floor(maxFollowupDays * 0.6),
  })

  // 6. Channel failure → switch to secondary
  triggers.push({
    code:              'PRIMARY_CHANNEL_FAILURE',
    condition:         'Message undeliverable on primary channel for 2+ consecutive attempts',
    action:            'SWITCH_CHANNEL',
    description:       'Primary channel is not reaching the lead. Switch to secondary channel.',
    minDaysSinceStart: 2,
  })

  // Sort by minDaysSinceStart ascending, then by code for determinism
  triggers.sort((a, b) =>
    a.minDaysSinceStart !== b.minDaysSinceStart
      ? a.minDaysSinceStart - b.minDaysSinceStart
      : a.code.localeCompare(b.code),
  )

  // Default escalation = when no other trigger fired by end of sequence
  const defaultAfterDays = Math.max(
    Math.floor(maxFollowupDays * 0.8),
    urgency === 'CRITICAL' ? 1 : 3,
  )

  const reason = buildReason(urgency, trustRequirement, ok?.category, triggers.length)

  return {
    triggers,
    defaultEscalationAfterDays: defaultAfterDays,
    reason,
  }
}

// ─── Reasoning ────────────────────────────────────────────────────────────────

function buildReason(
  urgency:    string,
  trust:      string,
  objection:  string | undefined,
  triggerCount: number,
): string {
  const parts: string[] = [`${triggerCount} escalation trigger(s) defined.`]

  if (urgency === 'CRITICAL') {
    parts.push('CRITICAL urgency: immediate human oversight path included.')
  } else if (urgency === 'HIGH') {
    parts.push('HIGH urgency: manager alert after 24h no-reply.')
  }

  if (trust === 'HIGH') {
    parts.push('High trust requirement: early human handoff after ~40% of sequence duration.')
  }

  if (objection) {
    parts.push(`Objection-specific trigger included for category '${objection}'.`)
  }

  return parts.join(' ')
}
