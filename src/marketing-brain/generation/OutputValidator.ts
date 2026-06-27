import type { Channel }          from '../models/MessageTemplate'
import type { MergedConstraints } from '../decision-engine/RuleEvaluator'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutputCheckCode =
  | 'NO_UNRESOLVED_VARIABLES'
  | 'CHARACTER_LIMIT'
  | 'LINE_LIMIT'
  | 'WORD_LIMIT'
  | 'FORBIDDEN_CONTENT'
  | 'REQUIRED_TOKENS_PRESENT'
  | 'CHANNEL_FORMAT_VALID'
  | 'NON_EMPTY_OUTPUT'
  | 'CTA_PRESENT'

export interface OutputCheck {
  code:    OutputCheckCode
  passed:  boolean
  message: string
  details: string | null
}

/**
 * The validated, structured representation of an AI provider's raw output.
 * Provider adapters call `validateOutput()` with the raw string response.
 *
 * `passed = true` means the output is structurally valid and safe to deliver.
 * `passed = false` means the pipeline should retry or escalate.
 */
export interface ValidatedOutput {
  /** The cleaned and trimmed output string. */
  content:        string
  channel:        Channel
  characterCount: number
  lineCount:      number
  wordCount:      number
  /** Whether a call-to-action was detected at the end of the output. */
  hasCTA:         boolean
  /** Whether any {{key}} placeholder remains in the output. */
  hasUnresolved:  boolean
  checks:         OutputCheck[]
  passed:         boolean
  /** Specific failures — non-empty when passed = false. */
  failures:       string[]
}

// ─── Channel-specific format contracts ───────────────────────────────────────

// Character caps per channel. These are hard limits — output above this is invalid.
const CHANNEL_CHAR_CAPS: Record<Channel, number | null> = {
  WHATSAPP: 4096,   // WhatsApp Business API limit
  EMAIL:    null,   // Email has no hard char limit from our side
  SMS:      1530,   // 10 SMS segments of 153 chars (Unicode); warn above 306
  IN_APP:   500,    // Our own in-app notification limit
  PUSH:     240,    // Combined title + body limit for most push providers
}

// Minimum output length — anything shorter is almost certainly wrong
const MIN_OUTPUT_CHARS = 10

// CTA signal patterns — look for link-like or action-like content at the end
const CTA_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/,                   // URL in output
  /\b(réserver|احجز|book|réservez)\b/i,
  /\b(commencer|ابدأ|start|get started)\b/i,
  /\b(essayer|جرب|try|try it)\b/i,
  /\b(reply|répondre|رد|respond)\b/i,
  /\b(click|cliquez|اضغط)\b/i,
  /\b(call|appeler|اتصل)\b/i,
]

// Variable placeholder pattern
const VAR_PATTERN = /\{\{(\w+)\}\}/g

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate the raw string output from an AI provider.
 *
 * This function is the contract that any future AI provider adapter must satisfy.
 * It is called AFTER the provider returns a response, NOT before (there is no
 * provider call in this sprint — this function defines what the check will do).
 *
 * Validation order:
 *   1. Non-empty output
 *   2. No unresolved {{variables}} in output
 *   3. Character limit (rule constraint + channel cap)
 *   4. Line limit (rule constraint)
 *   5. Word limit (rule constraint)
 *   6. No forbidden content (from rule constraints)
 *   7. Required tokens present (from rule constraints)
 *   8. Channel-specific format (EMAIL has Subject/Body, PUSH has Title/Body, etc.)
 *   9. CTA signal detected (advisory — does not block)
 *
 * Pure function: no DB access, no side effects, deterministic.
 *
 * @param rawOutput    The raw string returned by the AI provider.
 * @param channel      The delivery channel (determines format rules).
 * @param constraints  Merged constraints from the applied AI rules.
 * @returns            ValidatedOutput with pass/fail per check + overall result.
 */
export function validateOutput(
  rawOutput:   string,
  channel:     Channel,
  constraints: MergedConstraints,
): ValidatedOutput {
  const content       = rawOutput.trim()
  const characterCount = content.length
  const lineCount      = content ? content.split('\n').length : 0
  const wordCount      = content ? content.split(/\s+/).filter(Boolean).length : 0
  const hasUnresolved  = VAR_PATTERN.test(content)
  VAR_PATTERN.lastIndex = 0   // reset global regex
  const hasCTA         = CTA_PATTERNS.some(p => p.test(content))

  const checks:   OutputCheck[] = []
  const failures: string[]      = []

  const run = (check: OutputCheck, blocking = true) => {
    checks.push(check)
    if (!check.passed && blocking) failures.push(check.message)
  }

  run(checkNonEmpty(content))
  run(checkNoUnresolved(content, hasUnresolved))
  run(checkCharacterLimit(characterCount, channel, constraints))
  run(checkLineLimit(lineCount, constraints))
  run(checkWordLimit(wordCount, constraints))
  run(checkForbiddenContent(content, constraints))
  run(checkRequiredTokens(content, constraints))
  run(checkChannelFormat(content, channel))
  run(checkCTA(hasCTA, channel), false)  // advisory — does not block

  return {
    content,
    channel,
    characterCount,
    lineCount,
    wordCount,
    hasCTA,
    hasUnresolved,
    checks,
    passed:   failures.length === 0,
    failures,
  }
}

// ─── Individual output checks ─────────────────────────────────────────────────

function checkNonEmpty(content: string): OutputCheck {
  if (!content || content.length < MIN_OUTPUT_CHARS) {
    return {
      code:    'NON_EMPTY_OUTPUT',
      passed:  false,
      message: `Output is empty or too short (${content.length} chars, minimum ${MIN_OUTPUT_CHARS}).`,
      details: 'The AI provider returned an empty or trivially short response. Retry or investigate the prompt.',
    }
  }
  return pass('NON_EMPTY_OUTPUT', `Output has content (${content.length} chars).`)
}

function checkNoUnresolved(content: string, hasUnresolved: boolean): OutputCheck {
  if (hasUnresolved) {
    const remaining = [...content.matchAll(VAR_PATTERN)].map(m => `{{${m[1]}}}`)
    VAR_PATTERN.lastIndex = 0
    return {
      code:    'NO_UNRESOLVED_VARIABLES',
      passed:  false,
      message: `AI output contains unresolved variable placeholder(s): ${[...new Set(remaining)].join(', ')}.`,
      details: 'The AI echoed back template placeholders without filling them. This indicates the AI did not properly interpolate the base template.',
    }
  }
  return pass('NO_UNRESOLVED_VARIABLES', 'No unresolved variable placeholders in output.')
}

function checkCharacterLimit(
  charCount:   number,
  channel:     Channel,
  constraints: MergedConstraints,
): OutputCheck {
  const channelCap = CHANNEL_CHAR_CAPS[channel]
  const ruleCap    = constraints.maxChars
  const effectiveCap =
    channelCap !== null && ruleCap !== null ? Math.min(channelCap, ruleCap) :
    channelCap !== null                     ? channelCap :
    ruleCap

  if (effectiveCap === null) {
    return pass('CHARACTER_LIMIT', 'No character limit defined.')
  }

  if (charCount > effectiveCap) {
    return {
      code:    'CHARACTER_LIMIT',
      passed:  false,
      message: `Output exceeds character limit: ${charCount} chars, limit is ${effectiveCap}.`,
      details: `${channelCap !== null ? `Channel cap (${channel}): ${channelCap}. ` : ''}${ruleCap !== null ? `Rule cap: ${ruleCap}.` : ''}`,
    }
  }

  return pass('CHARACTER_LIMIT', `Output length OK: ${charCount}/${effectiveCap} chars.`)
}

function checkLineLimit(lineCount: number, constraints: MergedConstraints): OutputCheck {
  if (constraints.maxLines === null) {
    return pass('LINE_LIMIT', 'No line limit defined.')
  }
  if (lineCount > constraints.maxLines) {
    return {
      code:    'LINE_LIMIT',
      passed:  false,
      message: `Output exceeds line limit: ${lineCount} lines, limit is ${constraints.maxLines}.`,
      details: 'Reduce the output to fewer paragraph breaks or shorten the message.',
    }
  }
  return pass('LINE_LIMIT', `Line count OK: ${lineCount}/${constraints.maxLines}.`)
}

function checkWordLimit(wordCount: number, constraints: MergedConstraints): OutputCheck {
  if (constraints.maxWords === null) {
    return pass('WORD_LIMIT', 'No word limit defined.')
  }
  if (wordCount > constraints.maxWords) {
    return {
      code:    'WORD_LIMIT',
      passed:  false,
      message: `Output exceeds word limit: ${wordCount} words, limit is ${constraints.maxWords}.`,
      details: null,
    }
  }
  return pass('WORD_LIMIT', `Word count OK: ${wordCount}/${constraints.maxWords}.`)
}

function checkForbiddenContent(content: string, constraints: MergedConstraints): OutputCheck {
  if (!constraints.forbiddenPatterns.length) {
    return pass('FORBIDDEN_CONTENT', 'No forbidden patterns defined.')
  }
  const lower = content.toLowerCase()
  const found = constraints.forbiddenPatterns.filter(p => lower.includes(p.toLowerCase()))
  if (found.length) {
    return {
      code:    'FORBIDDEN_CONTENT',
      passed:  false,
      message: `Forbidden pattern(s) found in AI output: [${found.map(p => `"${p}"`).join(', ')}].`,
      details: 'The AI included content that was explicitly forbidden by the applied rules. Retry — the AI may produce different output.',
    }
  }
  return pass('FORBIDDEN_CONTENT', `No forbidden patterns found (${constraints.forbiddenPatterns.length} checked).`)
}

function checkRequiredTokens(content: string, constraints: MergedConstraints): OutputCheck {
  if (!constraints.requiredTokens.length) {
    return pass('REQUIRED_TOKENS_PRESENT', 'No required tokens defined.')
  }
  const lower   = content.toLowerCase()
  const missing = constraints.requiredTokens.filter(t => !lower.includes(t.toLowerCase()))
  if (missing.length) {
    return {
      code:    'REQUIRED_TOKENS_PRESENT',
      passed:  false,
      message: `Required token(s) absent from AI output: [${missing.map(t => `"${t}"`).join(', ')}].`,
      details: 'The rules require these tokens to appear in the final message. Retry — the AI may include them in a second attempt.',
    }
  }
  return pass('REQUIRED_TOKENS_PRESENT', `All ${constraints.requiredTokens.length} required token(s) present.`)
}

function checkChannelFormat(content: string, channel: Channel): OutputCheck {
  const checks: string[] = []

  switch (channel) {
    case 'EMAIL': {
      if (!content.toLowerCase().includes('subject:') && !content.toLowerCase().includes('objet:')) {
        checks.push('Missing "Subject:" line — EMAIL output must start with a subject')
      }
      if (!content.toLowerCase().includes('body:') && !content.toLowerCase().includes('corps:')) {
        checks.push('Missing "Body:" separator — EMAIL output must separate subject from body')
      }
      break
    }
    case 'PUSH':
    case 'IN_APP': {
      if (!content.toLowerCase().includes('title:') && !content.toLowerCase().includes('titre:')) {
        checks.push(`Missing "Title:" line — ${channel} output must start with a title`)
      }
      if (!content.toLowerCase().includes('body:') && !content.toLowerCase().includes('corps:')) {
        checks.push(`Missing "Body:" line — ${channel} output must include a body`)
      }
      break
    }
    case 'SMS': {
      if (content.includes('\n\n\n')) {
        checks.push('SMS output has multiple blank lines — single-segment SMS should be compact')
      }
      break
    }
    case 'WHATSAPP':
      // WhatsApp: plain text, no strict format requirement
      break
  }

  if (checks.length) {
    return {
      code:    'CHANNEL_FORMAT_VALID',
      passed:  false,
      message: `${channel} format issue(s): ${checks.join(' | ')}`,
      details: 'The AI did not follow the channel-specific output format defined in the system prompt.',
    }
  }
  return pass('CHANNEL_FORMAT_VALID', `${channel} format is valid.`)
}

function checkCTA(hasCTA: boolean, channel: Channel): OutputCheck {
  const ctaRequiredChannels: Channel[] = ['WHATSAPP', 'EMAIL', 'SMS']

  if (ctaRequiredChannels.includes(channel) && !hasCTA) {
    return {
      code:    'CTA_PRESENT',
      passed:  false,
      message: `No call-to-action detected in ${channel} output.`,
      details: 'Messages should include a clear action (link, reply request, phone number). This is advisory — the AI may have worded the CTA differently.',
    }
  }
  return pass('CTA_PRESENT', hasCTA ? 'CTA signal detected.' : `CTA not required for ${channel}.`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(code: OutputCheckCode, message: string): OutputCheck {
  return { code, passed: true, message, details: null }
}
