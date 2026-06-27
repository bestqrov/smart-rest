import type { PromptResult } from '../prompt-builder/PromptResult'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrandCode =
  | 'PRODUCT_NAME_MISSPELLING'
  | 'COMPETITOR_MENTION'
  | 'UNVERIFIED_CLAIM'
  | 'MISLEADING_URGENCY'
  | 'TONE_MISMATCH'

export interface BrandCheck {
  code:    BrandCode
  passed:  boolean
  message: string
  details: string | null
}

export interface BrandResult {
  passed:     boolean
  checks:     BrandCheck[]
  blockers:   string[]    // hard failures — must be fixed
  advisories: string[]    // soft — flag for review
}

// ─── Brand constants ──────────────────────────────────────────────────────────

// Canonical product name and acceptable variants
const CANONICAL_NAME    = 'SmartRestau'
// Misspellings and unapproved variants that should be flagged
const NAME_MISSPELLINGS = [
  'smart restau',
  'smart-restau',
  'smartresto',
  'smart resto',
  'smart-resto',
  'smartrestu',
  'smartrestauf',
  'smartresau',
]

// Competitor brand names — flag if they appear in the template
// (AI should not mention competitors; this defends against accidental inclusions)
const COMPETITOR_NAMES = [
  'appetize',
  'lightspeed',
  'toast pos',
  'toastpos',
  'square pos',
  'squarepos',
  'revel systems',
  'touchbistro',
  'aloha pos',
  'micros',
  'oracle hospitality',
  'foodics',
  'munch', // competitor in MENA
  'tabsquare',
  'dotmenu',
  'orda',
]

// Unverified/superlative claim patterns
// These aren't necessarily false but can't be verified at generation time.
const UNVERIFIED_CLAIM_PATTERNS: RegExp[] = [
  /\b(#1|number\s+one|no\.?\s*1)\s+(platform|solution|app|software|tool)\b/i,
  /\b(best|leading|top|premier|world[- ]class)\s+(platform|solution|app|software|restaurant)\b/i,
  /\bguaranteed?\s+(results?|success|roi|return)\b/i,
  /\b(100%|guaranteed)\s+(satisfaction|money[- ]back|refund)\b/i,
  /\bno\s+(risk|questions?\s+asked)\b/i,
  /\binstant\s+(results?|success|profit|revenue)\b/i,
  /\bdouble[ds]?\s+your\s+(revenue|profit|sales|orders?)\b/i,
]

// Misleading urgency patterns — fake deadlines or artificial scarcity
const MISLEADING_URGENCY_PATTERNS: RegExp[] = [
  /offer\s+expires?\s+(tonight|today|in\s+\d+\s+hours?)/i,
  /only\s+\d+\s+(spots?|seats?|licen[sc]es?)\s+(left|remaining|available)/i,
  /price\s+(goes?\s+up|increasing)\s+(tomorrow|tonight|in\s+\d+)/i,
  /last\s+chance\s+.{0,20}(ever|forever|permanently)/i,
  /\bact\s+before\s+(midnight|today|tonight)\b/i,
]

// Tone signals — words that suggest overly casual tone in formal contexts
const INFORMAL_TONE_MARKERS = [
  'lol', 'omg', 'tbh', 'fyi', 'btw', 'imo', 'asap', 'gonna', 'wanna',
  'gotta', 'kinda', 'sorta', 'y\'all', 'hey hey', 'sup ', 'wassup',
]

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run brand voice and identity checks on the assembled prompt package.
 *
 * Validates:
 *   - SmartRestau product name is spelled correctly in variable values and template
 *   - No competitor product names appear in the template
 *   - No unverifiable superlative claims
 *   - No artificial urgency / false scarcity
 *   - Tone is appropriate (basic signal check)
 *
 * Pure function: no DB access, no side effects, deterministic.
 */
export function validateBrand(promptResult: PromptResult): BrandResult {
  const checks:     BrandCheck[] = []
  const blockers:   string[]      = []
  const advisories: string[]      = []

  const run = (check: BrandCheck, isBlocker = false) => {
    checks.push(check)
    if (!check.passed) {
      if (isBlocker) blockers.push(check.message)
      else            advisories.push(check.message)
    }
  }

  const templateBody = extractTemplateBody(promptResult.userPrompt)
  const variableText = Object.values(promptResult.variables).join(' ')
  const allContent   = `${templateBody} ${variableText}`

  run(checkProductName(allContent, promptResult.variables),  true)
  run(checkCompetitors(allContent),                          true)
  run(checkUnverifiedClaims(templateBody),                   false)
  run(checkMisleadingUrgency(templateBody),                  false)
  run(checkToneConsistency(templateBody, promptResult),      false)

  return {
    passed: blockers.length === 0,
    checks,
    blockers,
    advisories,
  }
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkProductName(
  content:   string,
  variables: Record<string, string>,
): BrandCheck {
  const lower = content.toLowerCase()

  const found = NAME_MISSPELLINGS.filter(mis => lower.includes(mis))

  if (found.length) {
    return {
      code:    'PRODUCT_NAME_MISSPELLING',
      passed:  false,
      message: `Product name misspelling detected: [${found.map(m => `"${m}"`).join(', ')}].`,
      details: `The correct product name is "${CANONICAL_NAME}". Check variable values and the template body.`,
    }
  }

  return pass('PRODUCT_NAME_MISSPELLING', `Product name "${CANONICAL_NAME}" is used correctly.`)
}

function checkCompetitors(content: string): BrandCheck {
  const lower = content.toLowerCase()
  const found = COMPETITOR_NAMES.filter(c => lower.includes(c))

  if (found.length) {
    return {
      code:    'COMPETITOR_MENTION',
      passed:  false,
      message: `Competitor name(s) found in template/variables: [${found.map(c => `"${c}"`).join(', ')}].`,
      details: 'SmartRestau marketing should not name competitors. Remove or replace with generic references (e.g. "other solutions", "traditional POS").',
    }
  }

  return pass('COMPETITOR_MENTION', 'No competitor names found in template or variable values.')
}

function checkUnverifiedClaims(templateBody: string): BrandCheck {
  if (!templateBody.trim()) {
    return pass('UNVERIFIED_CLAIM', 'No template body to check.')
  }

  const matches: string[] = []
  for (const pattern of UNVERIFIED_CLAIM_PATTERNS) {
    const m = templateBody.match(pattern)
    if (m) matches.push(m[0]!)
  }

  if (matches.length) {
    return {
      code:    'UNVERIFIED_CLAIM',
      passed:  false,
      message: `Unverified superlative claim(s) detected: [${matches.map(m => `"${m}"`).join(', ')}].`,
      details: 'Claims like "#1 platform" or "guaranteed results" can expose the business to legal risk and reduce trust. Use quantified, verifiable claims instead.',
    }
  }

  return pass('UNVERIFIED_CLAIM', 'No unverified superlative claims detected.')
}

function checkMisleadingUrgency(templateBody: string): BrandCheck {
  if (!templateBody.trim()) {
    return pass('MISLEADING_URGENCY', 'No template body to check.')
  }

  const matches: string[] = []
  for (const pattern of MISLEADING_URGENCY_PATTERNS) {
    const m = templateBody.match(pattern)
    if (m) matches.push(m[0]!)
  }

  if (matches.length) {
    return {
      code:    'MISLEADING_URGENCY',
      passed:  false,
      message: `Misleading urgency pattern(s) found: [${matches.map(m => `"${m}"`).join(', ')}].`,
      details: 'Artificial scarcity and fake deadlines erode trust and may violate consumer protection laws in MENA/Africa markets. Use real, documented deadlines only.',
    }
  }

  return pass('MISLEADING_URGENCY', 'No misleading urgency patterns detected.')
}

function checkToneConsistency(
  templateBody: string,
  pr:           PromptResult,
): BrandCheck {
  if (!templateBody.trim()) {
    return pass('TONE_MISMATCH', 'No template body to check.')
  }

  // Only run the informal-tone check for channels / scenarios that imply formal context.
  // If no metadata is available, skip the check.
  const channel = pr.metadata.channel

  // SMS, PUSH, IN_APP are inherently casual channels — skip formal check
  if (channel === 'SMS' || channel === 'PUSH' || channel === 'IN_APP') {
    return pass('TONE_MISMATCH', `Tone check skipped for ${channel} (informal channel).`)
  }

  const lower = templateBody.toLowerCase()
  const informalFound = INFORMAL_TONE_MARKERS.filter(m => lower.includes(m))

  if (informalFound.length >= 2) {
    return {
      code:    'TONE_MISMATCH',
      passed:  false,
      message: `${informalFound.length} informal tone marker(s) detected in ${channel} template: [${informalFound.map(m => `"${m}"`).join(', ')}].`,
      details: 'WhatsApp and Email messages to restaurant owners should be professional. Remove casual slang and informal abbreviations.',
    }
  }

  return pass('TONE_MISMATCH', 'Tone appears appropriate for the channel.')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(code: BrandCode, message: string): BrandCheck {
  return { code, passed: true, message, details: null }
}

function extractTemplateBody(userPrompt: string): string {
  const start = userPrompt.indexOf('## Base Template')
  if (start === -1) return userPrompt

  const fenceStart = userPrompt.indexOf('```', start)
  const fenceEnd   = userPrompt.indexOf('```', fenceStart + 3)

  if (fenceStart === -1 || fenceEnd === -1) return ''
  return userPrompt.slice(fenceStart + 3, fenceEnd).trim()
}
