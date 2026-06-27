import type { PromptResult } from '../prompt-builder/PromptResult'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComplianceCode =
  | 'FORBIDDEN_PATTERN_IN_PROMPT'
  | 'REQUIRED_TOKENS_MISSING'
  | 'SPAM_TRIGGER_WORDS'
  | 'EXCESSIVE_EXCLAMATION'
  | 'EXCESSIVE_CAPS'
  | 'EMAIL_UNSUBSCRIBE_MISSING'
  | 'MISSING_SENDER_IDENTITY'

export interface ComplianceCheck {
  code:    ComplianceCode
  passed:  boolean
  message: string
  details: string | null
}

export interface ComplianceResult {
  passed:     boolean
  checks:     ComplianceCheck[]
  blockers:   string[]    // hard failures — must be fixed before sending
  advisories: string[]    // advisory — caller can decide whether to block
}

// ─── Spam trigger words ───────────────────────────────────────────────────────

// Common words that spam filters flag. Checked against the rendered template body
// (the base template section of the user prompt). Not checked against the system
// prompt because the AI system instructions are not end-user content.
const SPAM_TRIGGERS = [
  'click here', 'act now', 'limited time', 'free!!!', 'buy now', 'order now',
  'no cost', '100% free', 'earn money', 'make money fast', 'risk-free',
  'no obligation', 'winner', 'you\'ve been selected', 'congratulations',
  'dear friend', 'you have won', 'claim your prize', 'bank details',
  'nigerian prince', 'great offer',
]

// Character thresholds
const MAX_CONSECUTIVE_EXCLAMATIONS = 3   // !!!... in template body
const MAX_CAPS_WORD_RUN            = 4   // N or more consecutive ALL-CAPS words

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run compliance checks on the assembled prompt package.
 *
 * Checks run on:
 *   - systemPrompt + userPrompt (combined) — for forbidden patterns, required tokens
 *   - userPrompt base-template section — for spam signals and caps
 *   - metadata — for channel-specific requirements (e.g. unsubscribe for EMAIL)
 *
 * Blockers: hard failures — pipeline must not continue without resolution.
 * Advisories: soft — pipeline may continue; caller should review.
 *
 * Pure function: no DB access, no side effects, deterministic.
 */
export function validateCompliance(promptResult: PromptResult): ComplianceResult {
  const checks:     ComplianceCheck[] = []
  const blockers:   string[]           = []
  const advisories: string[]           = []

  const run = (check: ComplianceCheck, isBlocker = false) => {
    checks.push(check)
    if (!check.passed) {
      if (isBlocker) blockers.push(check.message)
      else            advisories.push(check.message)
    }
  }

  // The full prompt text (system + user) for instruction-level checks
  const fullPrompt     = `${promptResult.systemPrompt}\n${promptResult.userPrompt}`
  const templateBody   = extractTemplateBody(promptResult.userPrompt)
  const { metadata }   = promptResult

  // Rebuild constraints from the rules metadata — extract from the system prompt
  // only (not fullPrompt), so we read the Hard Constraints section cleanly.
  const constraints    = extractConstraintsFromPrompt(promptResult.systemPrompt)

  // Check template body only: the system prompt intentionally lists forbidden
  // words as examples of what NOT to do — scanning it would always self-trigger.
  run(checkForbiddenPatterns(templateBody, constraints.forbidden), true)
  run(checkRequiredTokens(fullPrompt, constraints.required), false)
  run(checkSpamTriggers(templateBody), false)
  run(checkExcessiveExclamation(templateBody), false)
  run(checkExcessiveCaps(templateBody), false)

  if (metadata.channel === 'EMAIL') {
    run(checkEmailUnsubscribe(promptResult.systemPrompt), false)
    run(checkSenderIdentity(fullPrompt), false)
  }

  return {
    passed: blockers.length === 0,
    checks,
    blockers,
    advisories,
  }
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkForbiddenPatterns(
  text:     string,
  patterns: string[],
): ComplianceCheck {
  if (!patterns.length) {
    return pass('FORBIDDEN_PATTERN_IN_PROMPT', 'No forbidden patterns defined in rules.')
  }

  const found = patterns.filter(p =>
    text.toLowerCase().includes(p.toLowerCase()),
  )

  if (found.length) {
    return {
      code:    'FORBIDDEN_PATTERN_IN_PROMPT',
      passed:  false,
      message: `Forbidden pattern(s) found in assembled prompt: [${found.map(p => `"${p}"`).join(', ')}].`,
      details: 'These patterns are explicitly forbidden by the applied AI rules. Remove them from the template or variable values.',
    }
  }

  return pass('FORBIDDEN_PATTERN_IN_PROMPT', `No forbidden patterns found (${patterns.length} pattern(s) checked).`)
}

function checkRequiredTokens(
  text:   string,
  tokens: string[],
): ComplianceCheck {
  if (!tokens.length) {
    return pass('REQUIRED_TOKENS_MISSING', 'No required tokens defined in rules.')
  }

  const missing = tokens.filter(t =>
    !text.toLowerCase().includes(t.toLowerCase()),
  )

  if (missing.length) {
    return {
      code:    'REQUIRED_TOKENS_MISSING',
      passed:  false,
      message: `Required token(s) absent from prompt: [${missing.map(t => `"${t}"`).join(', ')}].`,
      details: 'The applied AI rules require these tokens to appear somewhere in the system or user prompt. Update the template or prompt builder sections to include them.',
    }
  }

  return pass('REQUIRED_TOKENS_MISSING', `All ${tokens.length} required token(s) present.`)
}

function checkSpamTriggers(templateBody: string): ComplianceCheck {
  if (!templateBody.trim()) {
    return pass('SPAM_TRIGGER_WORDS', 'No template body to check.')
  }

  const lower = templateBody.toLowerCase()
  const found = SPAM_TRIGGERS.filter(t => lower.includes(t))

  if (found.length) {
    return {
      code:    'SPAM_TRIGGER_WORDS',
      passed:  false,
      message: `Spam-trigger word(s) detected in template: [${found.map(t => `"${t}"`).join(', ')}].`,
      details: 'These phrases commonly trigger spam filters, reducing deliverability. Replace with more natural phrasing.',
    }
  }

  return pass('SPAM_TRIGGER_WORDS', 'No spam trigger words found in template body.')
}

function checkExcessiveExclamation(templateBody: string): ComplianceCheck {
  // Count sequences of 2+ consecutive exclamation marks
  const matches: string[] = templateBody.match(/!{2,}/g) ?? []
  const worst: number     = matches.reduce((max: number, m: string) => Math.max(max, m.length), 0)

  if (worst >= MAX_CONSECUTIVE_EXCLAMATIONS) {
    return {
      code:    'EXCESSIVE_EXCLAMATION',
      passed:  false,
      message: `Excessive exclamation marks detected (up to ${worst} in a row). Spam filters flag this.`,
      details: 'Use at most one exclamation mark per sentence. Replace multi-exclamation clusters with natural punctuation.',
    }
  }

  return pass('EXCESSIVE_EXCLAMATION', 'Exclamation mark usage within acceptable limits.')
}

function checkExcessiveCaps(templateBody: string): ComplianceCheck {
  // Look for runs of N+ consecutive ALL-CAPS words (non-trivial length)
  const words       = templateBody.split(/\s+/)
  let capsRun       = 0
  let maxCapsRun    = 0

  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z]/g, '')
    if (clean.length >= 3 && clean === clean.toUpperCase() && /[A-Z]/.test(clean)) {
      capsRun++
      maxCapsRun = Math.max(maxCapsRun, capsRun)
    } else {
      capsRun = 0
    }
  }

  if (maxCapsRun >= MAX_CAPS_WORD_RUN) {
    return {
      code:    'EXCESSIVE_CAPS',
      passed:  false,
      message: `${maxCapsRun} consecutive ALL-CAPS words detected. Spam filters and tone guidelines flag this.`,
      details: 'Use title case or sentence case instead of ALL CAPS for emphasis. ALL CAPS reads as aggressive and is a spam signal.',
    }
  }

  return pass('EXCESSIVE_CAPS', 'No excessive ALL-CAPS runs detected.')
}

function checkEmailUnsubscribe(systemPrompt: string): ComplianceCheck {
  const lower = systemPrompt.toLowerCase()
  const hasUnsubscribeInstruction =
    lower.includes('unsubscribe') ||
    lower.includes('opt-out')     ||
    lower.includes('opt out')     ||
    lower.includes('désabonner')  ||   // French
    lower.includes('إلغاء الاشتراك')  // Arabic

  if (!hasUnsubscribeInstruction) {
    return {
      code:    'EMAIL_UNSUBSCRIBE_MISSING',
      passed:  false,
      message: 'System prompt does not instruct the AI to include an unsubscribe link/notice in the EMAIL.',
      details: 'CAN-SPAM, CASL, and GDPR require commercial emails to include an unsubscribe mechanism. The SystemPromptBuilder should include this in the Output Instructions section for EMAIL channel.',
    }
  }

  return pass('EMAIL_UNSUBSCRIBE_MISSING', 'System prompt includes unsubscribe instruction for EMAIL channel.')
}

function checkSenderIdentity(fullPrompt: string): ComplianceCheck {
  const lower = fullPrompt.toLowerCase()
  const hasSenderSignal =
    lower.includes('smartrestau') ||
    lower.includes('sender') ||
    lower.includes('from:')

  if (!hasSenderSignal) {
    return {
      code:    'MISSING_SENDER_IDENTITY',
      passed:  false,
      message: 'No sender identity reference found in the assembled prompt.',
      details: 'Commercial messages must identify the sender. Ensure the template or system prompt references "SmartRestau" as the sender.',
    }
  }

  return pass('MISSING_SENDER_IDENTITY', 'Sender identity (SmartRestau) referenced in prompt.')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(code: ComplianceCode, message: string): ComplianceCheck {
  return { code, passed: true, message, details: null }
}

/**
 * Extract forbidden patterns and required tokens by scanning the system prompt
 * for the ## Hard Constraints section that SystemPromptBuilder generates.
 */
function extractConstraintsFromPrompt(prompt: string): {
  forbidden: string[]
  required:  string[]
} {
  const forbidden: string[] = []
  const required:  string[] = []

  // SystemPromptBuilder emits:
  //   - Forbidden words/patterns: "word1", "word2"
  //   - Required tokens (must appear in output): "token1"
  const forbiddenMatch = prompt.match(/Forbidden[^:]*:\s*(.+)/i)
  if (forbiddenMatch?.[1]) {
    const raw = forbiddenMatch[1]
    const matches = raw.matchAll(/"([^"]+)"/g)
    for (const m of matches) forbidden.push(m[1]!)
  }

  const requiredMatch = prompt.match(/Required tokens[^:]*:\s*(.+)/i)
  if (requiredMatch?.[1]) {
    const raw = requiredMatch[1]
    const matches = raw.matchAll(/"([^"]+)"/g)
    for (const m of matches) required.push(m[1]!)
  }

  return { forbidden, required }
}

/**
 * Extract the base template body from the user prompt.
 * SystemPromptBuilder wraps it in ``` code fences after "## Base Template".
 */
function extractTemplateBody(userPrompt: string): string {
  const start = userPrompt.indexOf('## Base Template')
  if (start === -1) return userPrompt

  const fenceStart = userPrompt.indexOf('```', start)
  const fenceEnd   = userPrompt.indexOf('```', fenceStart + 3)

  if (fenceStart === -1 || fenceEnd === -1) return ''

  return userPrompt.slice(fenceStart + 3, fenceEnd).trim()
}
