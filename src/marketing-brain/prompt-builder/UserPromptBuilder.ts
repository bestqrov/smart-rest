import type { PromptContext }    from './PromptContext'
import { formatVariableList }   from './VariableInterpolator'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the user-turn prompt from the interpolated template body and all context.
 *
 * The user prompt serves as the "request" to the AI. It contains:
 *   1. Task instruction — what the AI should do with the base template
 *   2. Base template — the rendered template body (variables already substituted)
 *   3. Variable values — the resolved substitutions for transparency / logging
 *   4. Objection handling notes — if an active objection was detected
 *   5. Strategy notes — urgency, CTA, sequence position
 *
 * The AI is NOT asked to generate a campaign, plan, or multi-step strategy.
 * It is asked to produce ONE polished message for ONE channel.
 *
 * Pure function: no DB access, no side effects, deterministic.
 *
 * @param ctx            Full PromptContext.
 * @param renderedBody   Template body after variable interpolation (all {{keys}} resolved).
 * @returns              Assembled user prompt string.
 */
export function buildUserPrompt(ctx: PromptContext, renderedBody: string): string {
  const sections: string[] = []

  sections.push(buildTaskInstruction(ctx))
  sections.push(buildBaseTemplateSection(renderedBody))

  const varSection = buildVariableSection(ctx)
  if (varSection) sections.push(varSection)

  const objectionSection = buildObjectionNotes(ctx)
  if (objectionSection) sections.push(objectionSection)

  sections.push(buildStrategyNotes(ctx))

  return sections.join('\n\n')
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildTaskInstruction(ctx: PromptContext): string {
  const { strategyResult: sr, decisionContext: dc, scenarioKnowledge: sk } = ctx
  const channel = sr.primaryChannel
  const lang    = dc.language
  const tone    = sk?.recommendedTone ? ` with a ${sk.recommendedTone.toLowerCase()} tone` : ''

  return [
    '## Task',
    '',
    `Optimise the following base template into a final, polished ${channel} message` +
    `${tone}, written in **${lang}**.`,
    '',
    'Requirements:',
    '- Apply all Mandatory Rules from the system prompt without exception.',
    '- Preserve the core intent and variable values from the base template.',
    '- Respect all cultural and persona guidelines from the system prompt.',
    '- Produce ONE message only — the exact text to be sent.',
    '- Do NOT translate, explain, or add commentary.',
  ].join('\n')
}

function buildBaseTemplateSection(renderedBody: string): string {
  return [
    '## Base Template',
    '',
    '```',
    renderedBody.trim(),
    '```',
  ].join('\n')
}

function buildVariableSection(ctx: PromptContext): string | null {
  const vars = ctx.decisionResult.selectedVariables
  if (!vars || Object.keys(vars).length === 0) return null

  return [
    '## Variable Values Used',
    '',
    'These values were substituted into the template above.',
    'Preserve them in the final output — do NOT replace or invent alternatives.',
    '',
    formatVariableList(vars),
  ].join('\n')
}

function buildObjectionNotes(ctx: PromptContext): string | null {
  const ok = ctx.objectionKnowledge
  if (!ok) return null

  const lines = [
    '## Objection Handling Notes',
    '',
    `The lead has raised a **${ok.category}** objection. Their underlying concern is:`,
    `"${ok.underlyingFear}"`,
    '',
    `The message should ${ok.handlingStrategy.toLowerCase()} without directly mentioning ` +
    `the objection — address the fear indirectly through reassurance and proof.`,
  ]

  if (ok.proofTypes.length) {
    lines.push('', `Preferred proof elements: ${ok.proofTypes.join(', ')}.`)
  }

  return lines.join('\n')
}

function buildStrategyNotes(ctx: PromptContext): string {
  const { strategyResult: sr, scenarioKnowledge: sk, decisionContext: dc } = ctx

  const urgency     = sk?.urgency ?? 'MEDIUM'
  const cta         = sk?.cta ?? null
  const position    = sk?.positionInJourney ?? null
  const maxDays     = sk?.maxFollowupDays ?? null
  const channel     = sr.primaryChannel
  const secondary   = sr.secondaryChannel
  const touchpoints = sr.followupPlan.totalTouchpoints
  const bestHour    = sr.recommendedSendTime.bestHourStart

  const lines = [
    '## Strategy Notes',
    '',
    `- Urgency: **${urgency}**`,
    `- Delivery channel: **${channel}**${secondary ? ` (fallback: ${secondary})` : ''}`,
    `- Recommended send time: around **${bestHour}:00** local time`,
    `- Follow-up sequence: ${touchpoints} touchpoint(s) planned after this message`,
  ]

  if (position !== null) {
    lines.push(`- Position in journey: message ${position} of the nurture sequence`)
  }

  if (maxDays !== null) {
    lines.push(`- Sequence window: ${maxDays} day(s) from trigger`)
  }

  if (cta) {
    lines.push(`- CTA: **${CTA_ACTIONS[cta] ?? cta}**`)
  }

  if (dc.customNote) {
    lines.push('', `**Additional note from caller:** ${dc.customNote}`)
  }

  return lines.join('\n')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CTA_ACTIONS: Record<string, string> = {
  BOOK_DEMO:   'direct the lead to book a demo',
  START_TRIAL: 'invite the lead to start a free trial',
  REPLY:       'encourage the lead to reply to this message',
  VIEW_MENU:   'invite the lead to view the digital menu',
  REACTIVATE:  'invite the lead to reactivate their account',
  UPSELL:      'introduce the upgrade option naturally',
  RENEW:       'remind and invite renewal before expiry',
}
