import type { PromptResult } from '../prompt-builder/PromptResult'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SafetyCode =
  | 'PROMPT_INJECTION_DETECTED'
  | 'RAW_PII_IN_VARIABLES'
  | 'UNSAFE_HTML_IN_VARIABLES'
  | 'EXCESSIVE_PROMPT_LENGTH'
  | 'TEMPLATE_BODY_EMPTY'
  | 'INVALID_LANGUAGE_CODE'
  | 'NO_CHANNEL_SPECIFIED'

export interface SafetyCheck {
  code:    SafetyCode
  passed:  boolean
  message: string
  details: string | null
}

export interface SafetyResult {
  passed:   boolean       // false if any blocker found
  checks:   SafetyCheck[]
  blockers: string[]      // hard failures — pipeline must not continue
  warnings: string[]      // soft — pipeline can continue but caller should log
}

// ─── Prompt injection patterns ────────────────────────────────────────────────

// Patterns commonly used in prompt injection attacks embedded via user-controlled data.
// Check variable values (not the trusted system/user prompt templates).
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|all)\s+instructions?/i,
  /disregard\s+(the\s+)?(previous|above|prior)\s+/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /your\s+(new\s+)?(instructions?|role|task)\s+(?:is|are)\s*:/i,
  /system\s*:\s*\n/i,
  /\[system\]/i,
  /forget\s+(everything|all)\s+(you|that)\s+(know|were)/i,
  /act\s+as\s+(if\s+you\s+are|an?)\s+/i,
  /<\|im_start\|>/i,     // ChatML injection
  /\x00/,               // NUL byte injection
]

// PII detection — phone number and email address patterns
// We flag raw values that look like unmasked PII embedded in variable substitutions.
// Context-appropriate variables like ownerPhone are acceptable — we flag e.g.
// full credit card numbers or national ID numbers.
const RAW_EMAIL_RE   = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/
const RAW_PHONE_RE   = /\b(?:\+?[\d\s\-().]{10,16})\b/

// PII-safe variable names: these are expected to contain contact info
const PII_SAFE_KEYS  = new Set(['ownerPhone', 'ownerEmail', 'supportLink', 'trialLink', 'demoBookingLink'])

// Unsafe HTML / script patterns in variable values
const UNSAFE_HTML_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /on\w+\s*=/i,           // onclick=, onload=, onerror= etc.
  /<iframe[\s>]/i,
  /<object[\s>]/i,
]

// ─── Safety thresholds ────────────────────────────────────────────────────────

const MAX_PROMPT_CHARS      = 80_000   // total system + user prompt character cap
const LANGUAGE_CODE_RE      = /^[a-z]{2,5}(?:-[A-Z]{2})?$/  // BCP 47: 'fr', 'ar-MA', etc.

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all pre-flight safety checks on the assembled prompt package.
 *
 * Checks apply to the assembled PromptResult — the output of the PromptBuilder.
 * They do NOT check AI model output (that is OutputValidator's job).
 *
 * Blockers: pipeline halts — do not send to AI.
 * Warnings: pipeline continues — provider adapter should log.
 *
 * Pure function: no DB access, no side effects, deterministic.
 */
export function runSafetyChecks(promptResult: PromptResult): SafetyResult {
  const checks:   SafetyCheck[] = []
  const blockers: string[]      = []
  const warnings: string[]      = []

  const run = (check: SafetyCheck) => {
    checks.push(check)
    if (!check.passed) {
      if (isSafetyBlocker(check.code)) blockers.push(check.message)
      else                              warnings.push(check.message)
    }
  }

  run(checkPromptInjection(promptResult.variables))
  run(checkPII(promptResult.variables))
  run(checkUnsafeHTML(promptResult.variables))
  run(checkPromptLength(promptResult))
  run(checkTemplateBodyContent(promptResult.userPrompt))
  run(checkLanguageCode(promptResult.metadata.languageCode))
  run(checkChannel(promptResult.metadata.channel))

  return {
    passed:   blockers.length === 0,
    checks,
    blockers,
    warnings,
  }
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkPromptInjection(variables: Record<string, string>): SafetyCheck {
  const hits: string[] = []

  for (const [key, value] of Object.entries(variables)) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        hits.push(`{{${key}}}`)
        break
      }
    }
  }

  if (hits.length > 0) {
    return {
      code:    'PROMPT_INJECTION_DETECTED',
      passed:  false,
      message: `Prompt injection pattern detected in variable(s): ${hits.join(', ')}`,
      details: 'Variable values contain instruction-override patterns. This is a security risk — the AI may disregard its system prompt.',
    }
  }

  return pass('PROMPT_INJECTION_DETECTED', 'No prompt injection patterns found in variable values.')
}

function checkPII(variables: Record<string, string>): SafetyCheck {
  const hits: string[] = []

  for (const [key, value] of Object.entries(variables)) {
    if (PII_SAFE_KEYS.has(key)) continue
    // Flag values that look like embedded raw email addresses or phone numbers
    // in variables that aren't expected to contain contact info
    if (RAW_EMAIL_RE.test(value) || RAW_PHONE_RE.test(value)) {
      hits.push(`{{${key}}}`)
    }
  }

  if (hits.length > 0) {
    return {
      code:    'RAW_PII_IN_VARIABLES',
      passed:  false,
      message: `Possible raw PII (phone/email) in non-contact variable(s): ${hits.join(', ')}`,
      details: 'PII should be masked or placed only in designated contact variables (ownerPhone, ownerEmail).',
    }
  }

  return pass('RAW_PII_IN_VARIABLES', 'No unexpected PII patterns found in variable values.')
}

function checkUnsafeHTML(variables: Record<string, string>): SafetyCheck {
  const hits: string[] = []

  for (const [key, value] of Object.entries(variables)) {
    for (const pattern of UNSAFE_HTML_PATTERNS) {
      if (pattern.test(value)) {
        hits.push(`{{${key}}}`)
        break
      }
    }
  }

  if (hits.length > 0) {
    return {
      code:    'UNSAFE_HTML_IN_VARIABLES',
      passed:  false,
      message: `Unsafe HTML/script pattern in variable(s): ${hits.join(', ')}`,
      details: 'Variable values contain patterns that could be interpreted as executable content (script tags, JS handlers).',
    }
  }

  return pass('UNSAFE_HTML_IN_VARIABLES', 'No unsafe HTML patterns found in variable values.')
}

function checkPromptLength(pr: PromptResult): SafetyCheck {
  const total = pr.systemPrompt.length + pr.userPrompt.length

  if (total > MAX_PROMPT_CHARS) {
    return {
      code:    'EXCESSIVE_PROMPT_LENGTH',
      passed:  false,
      message: `Total prompt length (${total.toLocaleString()} chars) exceeds safety cap of ${MAX_PROMPT_CHARS.toLocaleString()}.`,
      details: 'Excessively long prompts may exceed provider context windows, inflate costs, and reduce model focus. Trim knowledge sections or reduce rule count.',
    }
  }

  if (total > MAX_PROMPT_CHARS * 0.8) {
    // Warn at 80% — still passes but logged
    return {
      code:    'EXCESSIVE_PROMPT_LENGTH',
      passed:  true,
      message: `Total prompt length (${total.toLocaleString()} chars) is approaching the safety cap (${MAX_PROMPT_CHARS.toLocaleString()}).`,
      details: 'Consider trimming knowledge sections to reduce token costs.',
    }
  }

  return pass('EXCESSIVE_PROMPT_LENGTH', `Prompt length OK: ${total.toLocaleString()} chars.`)
}

function checkTemplateBodyContent(userPrompt: string): SafetyCheck {
  // The user prompt starts with "## Task" — we look for "## Base Template" section
  const baseTemplateIdx = userPrompt.indexOf('## Base Template')
  const content = baseTemplateIdx !== -1
    ? userPrompt.slice(baseTemplateIdx + '## Base Template'.length).trim()
    : userPrompt.trim()

  if (!content || content === '```\n\n```' || content.length < 5) {
    return {
      code:    'TEMPLATE_BODY_EMPTY',
      passed:  false,
      message: 'The rendered template body is empty or too short.',
      details: 'After variable interpolation, the template body contained no meaningful content. Check the MessageTemplate record in the database.',
    }
  }

  return pass('TEMPLATE_BODY_EMPTY', 'Template body has content.')
}

function checkLanguageCode(languageCode: string): SafetyCheck {
  if (!languageCode?.trim()) {
    return {
      code:    'INVALID_LANGUAGE_CODE',
      passed:  false,
      message: 'Language code is empty.',
      details: 'A valid BCP 47 language code (e.g. "ar", "fr", "ar-MA") is required to generate a prompt.',
    }
  }

  if (!LANGUAGE_CODE_RE.test(languageCode)) {
    return {
      code:    'INVALID_LANGUAGE_CODE',
      passed:  false,
      message: `Language code '${languageCode}' does not match BCP 47 format (e.g. 'ar', 'fr', 'ar-MA').`,
      details: null,
    }
  }

  return pass('INVALID_LANGUAGE_CODE', `Language code '${languageCode}' is valid.`)
}

function checkChannel(channel: string): SafetyCheck {
  const VALID_CHANNELS = ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH']

  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return {
      code:    'NO_CHANNEL_SPECIFIED',
      passed:  false,
      message: `Invalid or missing channel: '${channel ?? 'undefined'}'.`,
      details: `Channel must be one of: ${VALID_CHANNELS.join(', ')}.`,
    }
  }

  return pass('NO_CHANNEL_SPECIFIED', `Channel '${channel}' is valid.`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(code: SafetyCode, message: string): SafetyCheck {
  return { code, passed: true, message, details: null }
}

function isSafetyBlocker(code: SafetyCode): boolean {
  // These are always blockers — they represent security risks
  const ALWAYS_BLOCK: SafetyCode[] = [
    'PROMPT_INJECTION_DETECTED',
    'UNSAFE_HTML_IN_VARIABLES',
    'TEMPLATE_BODY_EMPTY',
    'INVALID_LANGUAGE_CODE',
    'NO_CHANNEL_SPECIFIED',
  ]
  return ALWAYS_BLOCK.includes(code)
}
