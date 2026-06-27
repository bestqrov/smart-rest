import type { IAIRule }       from '../models/AIRule'
import { mergeRuleConstraints } from '../decision-engine/RuleEvaluator'
import type { PromptContext }   from './PromptContext'

// ─── Channel output instructions ──────────────────────────────────────────────

const CHANNEL_INSTRUCTIONS: Record<string, string[]> = {
  WHATSAPP: [
    'Write ONLY the final WhatsApp message body — no JSON, no labels, no subject line.',
    'Plain text only: no markdown bold, no tables, no code blocks.',
    'Use line breaks for paragraph separation.',
    'Maximum 1–2 emojis if the tone is warm; zero emojis for formal or urgent messages.',
    'Single CTA at the very end — one link or action, no alternatives.',
    'Aim for under 800 characters unless the scenario explicitly requires more.',
  ],
  EMAIL: [
    'Output two labelled blocks: "Subject:" on its own line, then "Body:" on its own line.',
    'Subject line: max 60 characters, no clickbait, no ALL CAPS.',
    'Body may use plain text or basic markdown (headings, bold, bullet lists).',
    'Open with a personalised greeting. Close with the agent/sender name.',
    'CTA: one clear sentence with a link or action. Do not include multiple CTAs.',
    'Add a single-line unsubscribe footer at the very end.',
  ],
  SMS: [
    'Write ONLY the final SMS text — no labels, no JSON.',
    'Maximum 160 characters for a single-segment SMS (or 306 for Unicode/Arabic).',
    'No markdown. No emojis (SMS rendering is unreliable).',
    'Begin with the business name or sender label (e.g. "SmartRestau:").',
    'One action only: include the link or phone number, not both.',
  ],
  IN_APP: [
    'Output two labelled blocks: "Title:" on its own line, then "Body:" on its own line.',
    'Title: max 50 characters — action-oriented, no punctuation at end.',
    'Body: max 150 characters — one clear value statement + one CTA.',
    'No markdown, no links (in-app handles navigation internally).',
  ],
  PUSH: [
    'Output two labelled blocks: "Title:" on its own line, then "Body:" on its own line.',
    'Title: max 50 characters — bold and direct.',
    'Body: max 100 characters — must create curiosity or urgency.',
    'No markdown, no URLs.',
    'Avoid using the owner\'s name in the body (not always available at send time).',
  ],
}

const DEFAULT_CHANNEL_INSTRUCTIONS = [
  'Write ONLY the final message — no explanations, no alternatives, no labels.',
  'Plain text output only.',
  'Single clear CTA at the end.',
]

// ─── Formality level → instruction ───────────────────────────────────────────

const FORMALITY_INSTRUCTIONS: Record<string, string> = {
  HIGH:   'Use formal register throughout. Avoid colloquialisms, contractions, and slang.',
  MEDIUM: 'Use professional but accessible language. Friendly without being casual.',
  LOW:    'Conversational and warm tone. Contractions and light informality are acceptable.',
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the system prompt from all available context.
 *
 * Section order (stable — always the same):
 *   1. Identity & Role
 *   2. Task Context
 *   3. Audience Profile         (if personaKnowledge)
 *   4. Cultural Intelligence    (if countryKnowledge)
 *   5. Business Context         (if businessTypeKnowledge)
 *   6. Active Objection Context (if objectionKnowledge)
 *   7. Content Directives       (if scenarioKnowledge)
 *   8. Mandatory AI Rules       (hard rules, sorted)
 *   9. Preferred AI Rules       (soft rules, sorted)
 *  10. Hard Constraints         (merged from rules)
 *  11. Output Instructions      (channel-specific)
 *
 * Sections 3–9 are omitted when the corresponding data is absent.
 * Sections 8, 10, 11 are always present.
 *
 * Pure function: no DB access, no side effects.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = []

  sections.push(buildIdentitySection(ctx))
  sections.push(buildTaskContextSection(ctx))

  const audienceSection = buildAudienceSection(ctx)
  if (audienceSection) sections.push(audienceSection)

  const culturalSection = buildCulturalSection(ctx)
  if (culturalSection) sections.push(culturalSection)

  const bizSection = buildBusinessContextSection(ctx)
  if (bizSection) sections.push(bizSection)

  const objectionSection = buildObjectionSection(ctx)
  if (objectionSection) sections.push(objectionSection)

  const directivesSection = buildContentDirectivesSection(ctx)
  if (directivesSection) sections.push(directivesSection)

  const rulesSection = buildRulesSection(ctx.decisionResult.selectedAIRules)
  if (rulesSection) sections.push(rulesSection)

  sections.push(buildConstraintsSection(ctx))
  sections.push(buildOutputInstructionsSection(ctx))

  return sections.join('\n\n')
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildIdentitySection(ctx: PromptContext): string {
  const { decisionContext: dc, strategyResult: sr } = ctx
  const channel  = sr.primaryChannel
  const lang     = dc.language
  const country  = ctx.countryKnowledge?.nameEn ?? dc.country.toUpperCase()
  const bizType  = ctx.businessTypeKnowledge?.nameEn ?? dc.businessType

  return [
    '## Identity & Role',
    '',
    `You are an expert ${channel} copywriter specialising in B2B restaurant and food-service ` +
    `technology marketing for the ${country} market.`,
    '',
    `You work for SmartRestau — a platform that helps restaurant owners in MENA and Africa ` +
    `manage orders, tables, QR menus, and customer loyalty.`,
    '',
    `Your task: write a single ${channel} message in **${lang}** targeted at a ${bizType} owner.`,
    '',
    `You MUST follow every rule and constraint in this prompt without exception.`,
  ].join('\n')
}

function buildTaskContextSection(ctx: PromptContext): string {
  const { decisionContext: dc, strategyResult: sr, scenarioKnowledge: sk } = ctx
  const scenario  = dc.scenario
  const stage     = dk(ctx).selectedScenario?.stage ?? sk?.stage ?? 'UNKNOWN'
  const goal      = sk?.primaryGoal ?? 'drive engagement and conversion'
  const indicator = sk?.successIndicator ?? 'lead replies or takes the desired action'
  const urgency   = sk?.urgency ?? 'MEDIUM'
  const cta       = sk?.cta ?? null
  const channel   = sr.primaryChannel

  const lines = [
    '## Task Context',
    '',
    `**Scenario:** ${scenario} (funnel stage: ${stage})`,
    `**Urgency:** ${urgency}`,
    `**Primary goal:** ${goal}`,
    `**Success looks like:** ${indicator}`,
    `**Delivery channel:** ${channel}`,
  ]

  if (cta) {
    lines.push(`**Recommended CTA type:** ${CTA_LABELS[cta] ?? cta}`)
  }

  if (dc.campaignGoal) {
    lines.push(`**Campaign goal:** ${dc.campaignGoal}`)
  }

  return lines.join('\n')
}

function buildAudienceSection(ctx: PromptContext): string | null {
  const pk = ctx.personaKnowledge
  if (!pk) return null

  const lines = [
    '## Audience Profile',
    '',
    `**Persona:** ${pk.nameEn} (${pk.slug})`,
    `**Age range:** ${pk.ageRange.min}–${pk.ageRange.max}`,
    `**Tech comfort:** ${pk.techComfort}`,
    `**Decision speed:** ${pk.decisionSpeed}`,
    `**Price sensitivity:** ${pk.priceSensitivity}`,
    `**Trust requirement:** ${pk.trustRequirement}`,
    `**Preferred content length:** ${pk.contentLength}`,
  ]

  if (pk.painPoints.length) {
    lines.push('', '**Pain points:**')
    pk.painPoints.forEach(p => lines.push(`- ${p}`))
  }

  if (pk.goals.length) {
    lines.push('', '**Goals:**')
    pk.goals.forEach(g => lines.push(`- ${g}`))
  }

  if (pk.messagingPrinciples.length) {
    lines.push('', '**Messaging principles (do these):**')
    pk.messagingPrinciples.forEach(p => lines.push(`- ${p}`))
  }

  if (pk.triggerWords.length) {
    lines.push('', `**Words that resonate:** ${pk.triggerWords.join(', ')}`)
  }

  if (pk.avoidWords.length) {
    lines.push(`**Words to avoid:** ${pk.avoidWords.join(', ')}`)
  }

  return lines.join('\n')
}

function buildCulturalSection(ctx: PromptContext): string | null {
  const ck = ctx.countryKnowledge
  if (!ck) return null

  const lines = [
    '## Cultural Intelligence',
    '',
    `**Country:** ${ck.nameEn} (${ck.code})`,
    `**Dialect / register:** ${ck.dialect}`,
    `**Script direction:** ${ck.scriptDirection}`,
    `**Formality:** ${ck.formalityLevel} — ${FORMALITY_INSTRUCTIONS[ck.formalityLevel] ?? ''}`,
    `**Decision-making style:** ${ck.decisionMaking}`,
    `**Market maturity:** ${ck.marketMaturity}`,
    `**Digital adoption:** ${ck.digitalAdoption}`,
  ]

  if (ck.culturalNotes.length) {
    lines.push('', '**Cultural notes (respect these in the message):**')
    ck.culturalNotes.forEach(n => lines.push(`- ${n}`))
  }

  if (ck.businessCulture.length) {
    lines.push('', '**Business culture:**')
    ck.businessCulture.forEach(n => lines.push(`- ${n}`))
  }

  if (ck.trustBuilding.length) {
    lines.push('', '**Trust-building signals that work here:**')
    ck.trustBuilding.forEach(t => lines.push(`- ${t}`))
  }

  if (ck.keyPainPoints.length) {
    lines.push('', `**Common market pain points:** ${ck.keyPainPoints.join('; ')}`)
  }

  return lines.join('\n')
}

function buildBusinessContextSection(ctx: PromptContext): string | null {
  const bk = ctx.businessTypeKnowledge
  if (!bk) return null

  const lines = [
    '## Business Context',
    '',
    `**Business type:** ${bk.nameEn} (${bk.slug})`,
    `**Typical staff size:** ${bk.staffSize}`,
    `**Digital readiness:** ${bk.digitalReadiness}`,
    `**Primary decision-maker:** ${bk.primaryDecisionMaker}`,
    `**Budget cycle:** ${bk.budgetCycle}`,
  ]

  if (bk.operationalPainPoints.length) {
    lines.push('', '**Their operational frustrations:**')
    bk.operationalPainPoints.forEach(p => lines.push(`- ${p}`))
  }

  if (bk.keySmartRestauUseCases.length) {
    lines.push('', '**SmartRestau features that matter most to them:**')
    bk.keySmartRestauUseCases.forEach(u => lines.push(`- ${u}`))
  }

  if (bk.keyBenefits.length) {
    lines.push('', `**Lead with these benefits:** ${bk.keyBenefits.join('; ')}`)
  }

  if (bk.avoidTopics.length) {
    lines.push(`**Topics that don't land well:** ${bk.avoidTopics.join('; ')}`)
  }

  return lines.join('\n')
}

function buildObjectionSection(ctx: PromptContext): string | null {
  const ok = ctx.objectionKnowledge
  if (!ok) return null

  const lines = [
    '## Active Objection Context',
    '',
    `**Objection category:** ${ok.category} (${ok.slug})`,
    `**Underlying fear:** ${ok.underlyingFear}`,
    `**Emotional state of the lead:** ${ok.emotionalCore}`,
    '',
    `**Handling strategy:** ${ok.handlingStrategy}`,
  ]

  if (ok.acknowledgements.length) {
    lines.push('', '**Acknowledge the concern with one of these openings:**')
    ok.acknowledgements.forEach(a => lines.push(`- ${a}`))
  }

  if (ok.reframingTactics.length) {
    lines.push('', '**Reframe using one of these angles:**')
    ok.reframingTactics.forEach(r => lines.push(`- ${r}`))
  }

  if (ok.proofTypes.length) {
    lines.push('', `**Best proof types for this objection:** ${ok.proofTypes.join(', ')}`)
  }

  if (ok.doNotSay.length) {
    lines.push('', '**NEVER say any of these (they make the objection worse):**')
    ok.doNotSay.forEach(d => lines.push(`- "${d}"`))
  }

  return lines.join('\n')
}

function buildContentDirectivesSection(ctx: PromptContext): string | null {
  const sk = ctx.scenarioKnowledge
  if (!sk) return null

  const hasIncludes = sk.keyMessages.length > 0
  const hasExcludes = sk.avoidMessages.length > 0

  if (!hasIncludes && !hasExcludes) return null

  const lines = ['## Content Directives', '']

  if (hasIncludes) {
    lines.push('**Include at least one of these messages/themes:**')
    sk.keyMessages.forEach(m => lines.push(`- ${m}`))
  }

  if (hasExcludes) {
    if (hasIncludes) lines.push('')
    lines.push('**Do NOT include any of these messages/themes:**')
    sk.avoidMessages.forEach(m => lines.push(`- ${m}`))
  }

  return lines.join('\n')
}

function buildRulesSection(rules: IAIRule[]): string | null {
  if (!rules.length) return null

  const hard = rules.filter(r => r.isHard).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.slug.localeCompare(b.slug)
  })
  const soft = rules.filter(r => !r.isHard).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.slug.localeCompare(b.slug)
  })

  const sections: string[] = []

  if (hard.length) {
    sections.push('## Mandatory Rules (HARD — violation invalidates the output)')
    sections.push('')
    hard.forEach((r, i) => {
      sections.push(`**Rule ${i + 1}: ${r.nameEn}**`)
      sections.push(r.rule.instruction)
      const good = r.rule.goodExamples[0]
      const bad  = r.rule.badExamples[0]
      if (good) sections.push(`  Example: ${good}`)
      if (bad)  sections.push(`  Anti-example (WRONG): ${bad}`)
    })
  }

  if (soft.length) {
    if (hard.length) sections.push('')
    sections.push('## Preferred Rules (SOFT — follow unless a hard rule takes precedence)')
    sections.push('')
    soft.forEach((r, i) => {
      sections.push(`**${i + 1}. ${r.nameEn}:** ${r.rule.instruction}`)
    })
  }

  return sections.join('\n')
}

function buildConstraintsSection(ctx: PromptContext): string {
  const { decisionResult: dr, strategyResult: sr } = ctx
  const constraints = mergeRuleConstraints(dr.selectedAIRules)

  const lines = ['## Hard Constraints', '']

  if (constraints.maxChars !== null) {
    lines.push(`- Maximum characters: **${constraints.maxChars}**`)
  }
  if (constraints.maxLines !== null) {
    lines.push(`- Maximum lines: **${constraints.maxLines}**`)
  }
  if (constraints.maxWords !== null) {
    lines.push(`- Maximum words: **${constraints.maxWords}**`)
  }

  if (constraints.forbiddenPatterns.length) {
    lines.push(`- Forbidden words/patterns: ${constraints.forbiddenPatterns.map(p => `"${p}"`).join(', ')}`)
  }

  if (constraints.requiredTokens.length) {
    lines.push(`- Required tokens (must appear in output): ${constraints.requiredTokens.map(t => `"${t}"`).join(', ')}`)
  }

  // Channel-level character cap reminder
  const channelCap = CHANNEL_CHAR_CAPS[sr.primaryChannel]
  if (channelCap) {
    const current = constraints.maxChars
    if (current === null || channelCap < current) {
      lines.push(`- Channel cap for ${sr.primaryChannel}: **${channelCap} characters** (overrides any higher rule limit)`)
    }
  }

  // If no constraints at all, say so explicitly
  if (lines.length === 2) {
    lines.push('- No quantitative constraints from rules. Follow channel defaults.')
  }

  return lines.join('\n')
}

function buildOutputInstructionsSection(ctx: PromptContext): string {
  const channel      = ctx.strategyResult.primaryChannel
  const instructions = CHANNEL_INSTRUCTIONS[channel] ?? DEFAULT_CHANNEL_INSTRUCTIONS

  const lines = [
    '## Output Instructions',
    '',
    ...instructions.map(i => `- ${i}`),
    '',
    '**CRITICAL:** Do NOT add explanations, alternatives, translations, or meta-commentary.',
    'Output ONLY the final message — nothing before it, nothing after it.',
  ]

  return lines.join('\n')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Reference to DecisionResult (used inside section builders)
function dk(ctx: PromptContext) {
  return ctx.decisionResult
}

const CTA_LABELS: Record<string, string> = {
  BOOK_DEMO:   'Book a demo (link to calendar)',
  START_TRIAL: 'Start free trial (link to signup)',
  REPLY:       'Reply to this message (direct reply)',
  VIEW_MENU:   'View the digital menu (link)',
  REACTIVATE:  'Reactivate account (link)',
  UPSELL:      'Upgrade plan (link)',
  RENEW:       'Renew subscription (link)',
}

const CHANNEL_CHAR_CAPS: Partial<Record<string, number>> = {
  SMS:   160,
  PUSH:  100,
  IN_APP: 150,
}
