import { mergeConstraints }       from './AIRuleResolver'
import { render }                  from './VariableResolver'
import { validateBuiltPrompt }     from './Validators'
import type { IAIRule }            from '../models/AIRule'
import type { IMessageTemplate }   from '../models/MessageTemplate'
import type { BuiltPrompt, ResolvedContext } from '../types'

// ─── Build arguments ──────────────────────────────────────────────────────────

export interface PromptBuildArgs {
  template:          IMessageTemplate
  resolvedVariables: Record<string, string>
  aiRules:           IAIRule[]
  ctx:               ResolvedContext
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assembles the final provider-agnostic prompt from all decision outputs.
 *
 * The returned { system, user } pair maps to every major LLM API:
 *   Anthropic:  system + messages[{role:'user', content: user}]
 *   OpenAI/Groq: messages[{role:'system'},{role:'user'}]
 *   Gemini:     systemInstruction + contents[{role:'user', parts:[{text:user}]}]
 *
 * No AI call is made here. The prompt is built deterministically from the
 * template, rules, and resolved variables — the caller decides which
 * provider to invoke.
 */
export function build(args: PromptBuildArgs): BuiltPrompt & { promptWarnings: string[] } {
  const { template, resolvedVariables, aiRules, ctx } = args

  const constraints = mergeConstraints(aiRules)

  const system = buildSystem(aiRules, constraints, ctx)
  const user   = buildUser(template, resolvedVariables, constraints, ctx)

  const promptWarnings = validateBuiltPrompt(system, user)

  return {
    system,
    user,
    constraints,
    metadata: {
      templateSlug:   template.slug,
      personaSlug:    ctx.personaSlug,
      scenarioStage:  ctx.scenarioStage,
      languageCode:   ctx.languageCode,
      channel:        ctx.channel,
      rulesApplied:   aiRules.length,
      hardRulesCount: aiRules.filter(r => r.isHard).length,
    },
    promptWarnings,
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystem(
  rules:       IAIRule[],
  constraints: ReturnType<typeof mergeConstraints>,
  ctx:         ResolvedContext,
): string {
  const parts: string[] = []

  // Identity block
  parts.push(buildIdentityBlock(ctx))

  // Rules block (hard rules first, then soft, grouped by type)
  if (rules.length) {
    parts.push(buildRulesBlock(rules))
  }

  // Global constraints block (merged quantitative limits)
  const constraintBlock = buildConstraintBlock(constraints)
  if (constraintBlock) parts.push(constraintBlock)

  // Output instructions
  parts.push(buildOutputInstructions(ctx))

  return parts.join('\n\n')
}

function buildIdentityBlock(ctx: ResolvedContext): string {
  const channelLabel: Record<string, string> = {
    WHATSAPP: 'WhatsApp',
    EMAIL:    'email',
    SMS:      'SMS',
    IN_APP:   'in-app notification',
    PUSH:     'push notification',
  }

  return [
    'You are an expert marketing copywriter specialising in the restaurant and food-service industry in MENA and Africa.',
    '',
    `Your task is to write a ${channelLabel[ctx.channel] ?? ctx.channel} message in language code "${ctx.languageCode}".`,
    ctx.personaSlug  ? `Audience persona: ${ctx.personaSlug}.`   : '',
    ctx.scenarioStage ? `Funnel stage: ${ctx.scenarioStage}.` : '',
    ctx.countryCode  ? `Target country: ${ctx.countryCode}.` : '',
  ].filter(Boolean).join('\n')
}

function buildRulesBlock(rules: IAIRule[]): string {
  const hard = rules.filter(r => r.isHard)
  const soft = rules.filter(r => !r.isHard)

  const lines: string[] = ['## Rules']

  const formatRule = (rule: IAIRule, idx: number): string => {
    const tag   = rule.isHard ? ' [MANDATORY]' : ''
    const label = `### ${idx + 1}. ${rule.nameEn}${tag}`
    const body  = [label, '', rule.rule.instruction]

    if (rule.rule.goodExamples?.length) {
      body.push('', '**Good examples:**')
      rule.rule.goodExamples.forEach(e => body.push(`  ✓ ${e}`))
    }

    if (rule.rule.badExamples?.length) {
      body.push('', '**Never do this:**')
      rule.rule.badExamples.forEach(e => body.push(`  ✗ ${e}`))
    }

    return body.join('\n')
  }

  if (hard.length) {
    lines.push('', '### Mandatory (always enforced, no exceptions):')
    hard.forEach((r, i) => lines.push('', formatRule(r, i)))
  }

  if (soft.length) {
    lines.push('', '### Preferred (follow unless a mandatory rule conflicts):')
    soft.forEach((r, i) => lines.push('', formatRule(r, hard.length + i)))
  }

  return lines.join('\n')
}

function buildConstraintBlock(
  constraints: ReturnType<typeof mergeConstraints>,
): string {
  const { maxChars, maxLines, maxWords, forbiddenPatterns, requiredTokens } = constraints

  const lines: string[] = []

  if (maxChars !== null) lines.push(`- Maximum characters: ${maxChars}`)
  if (maxLines !== null) lines.push(`- Maximum lines: ${maxLines}`)
  if (maxWords !== null) lines.push(`- Maximum words: ${maxWords}`)

  if (forbiddenPatterns.length) {
    lines.push(`- Forbidden words/phrases: ${forbiddenPatterns.map(p => `"${p}"`).join(', ')}`)
  }

  if (requiredTokens.length) {
    lines.push(`- Required in output: ${requiredTokens.map(t => `"${t}"`).join(', ')}`)
  }

  return lines.length ? `## Hard Constraints\n${lines.join('\n')}` : ''
}

function buildOutputInstructions(ctx: ResolvedContext): string {
  const channelNote: Partial<Record<string, string>> = {
    WHATSAPP: 'Write plain text only. *Bold* and _italic_ are supported but use sparingly.',
    EMAIL:    'Write HTML or plain text as appropriate for the template format.',
    SMS:      'Keep it extremely short. No URLs unless using a link-shortener.',
  }

  return [
    '## Output Instructions',
    '',
    `Write ONLY the final ${ctx.channel} message. Do not add:`,
    '- Explanations or commentary',
    '- A subject line prefix (unless this is an email)',
    '- Metadata, translations, or alternatives',
    '',
    channelNote[ctx.channel] ?? '',
    '',
    'If the base template is already perfect, reproduce it exactly without changes.',
  ].filter(line => line !== undefined).join('\n')
}

// ─── User prompt ──────────────────────────────────────────────────────────────

function buildUser(
  template:          IMessageTemplate,
  resolvedVariables: Record<string, string>,
  constraints:       ReturnType<typeof mergeConstraints>,
  ctx:               ResolvedContext,
): string {
  const renderedBody = render(template.body, resolvedVariables)
  const varSection   = buildVariablesSection(resolvedVariables)

  const lines: string[] = [
    '## Task',
    '',
    `Optimise the following ${ctx.channel} message for the context described in the system prompt.`,
    'Preserve the meaning and structure. Apply all rules above.',
    '',
    '## Base Template',
    '',
    renderedBody,
  ]

  if (varSection) {
    lines.push('', '## Variable Values Used', '', varSection)
  }

  if (constraints.maxChars !== null) {
    const rendered = renderedBody.length
    if (rendered > constraints.maxChars) {
      lines.push(
        '',
        `⚠ The base template is ${rendered} chars, which exceeds the ${constraints.maxChars}-char limit.`,
        'Shorten it while keeping the core message and CTA intact.',
      )
    }
  }

  return lines.join('\n')
}

function buildVariablesSection(resolved: Record<string, string>): string {
  const entries = Object.entries(resolved).filter(([, v]) => v)
  if (!entries.length) return ''
  return entries.map(([k, v]) => `  {{${k}}} = "${v}"`).join('\n')
}
