import { CHANNELS } from '../models/MessageTemplate'
import type { DecisionContext } from '../decision-engine/DecisionContext'

// ─── Regexes ──────────────────────────────────────────────────────────────────

const LANG_CODE_RE    = /^[a-z]{2}$/
const COUNTRY_CODE_RE = /^[A-Z]{2}$/
const SLUG_RE         = /^[a-z0-9_-]+$/

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate a DecisionContext before the engine processes it.
 *
 * Returns an array of blocking error messages.
 * An empty array means the context is valid enough to proceed.
 *
 * This validator is strict on required fields and lenient on optional ones —
 * missing optional fields result in warnings during resolution, not errors here.
 */
export function validateDecisionContext(input: unknown): string[] {
  const errors: string[] = []

  if (!input || typeof input !== 'object') {
    return ['DecisionContext must be a non-null object']
  }

  const ctx = input as Record<string, unknown>

  // ── Required string fields ──

  if (!isNonEmptyString(ctx.ownerName)) {
    errors.push('ownerName: required non-empty string (contact name for personalisation)')
  }

  if (!isNonEmptyString(ctx.language) || !LANG_CODE_RE.test(ctx.language as string)) {
    errors.push('language: must be a 2-letter ISO 639-1 code (e.g. "ar", "fr", "en")')
  }

  if (!isNonEmptyString(ctx.country) || !COUNTRY_CODE_RE.test(ctx.country as string)) {
    errors.push('country: must be a 2-letter uppercase ISO 3166-1 code (e.g. "MA", "SA")')
  }

  if (!isNonEmptyString(ctx.businessType) || !SLUG_RE.test(ctx.businessType as string)) {
    errors.push('businessType: required slug string (e.g. "restaurant", "cafe")')
  }

  if (!isNonEmptyString(ctx.scenario) || !SLUG_RE.test(ctx.scenario as string)) {
    errors.push(
      'scenario: required trigger slug (e.g. "demo_request_submitted", "trial_day_3"). ' +
      'Must match Scenario.trigger in the database.',
    )
  }

  // ── Optional fields — only validate format when provided ──

  if (ctx.channel !== undefined && !CHANNELS.includes(ctx.channel as any)) {
    errors.push(`channel: must be one of [${CHANNELS.join(', ')}] when provided`)
  }

  if (ctx.persona !== undefined && !isNonEmptyString(ctx.persona)) {
    errors.push('persona: must be a non-empty string slug when provided')
  }

  if (ctx.objection !== undefined && !isNonEmptyString(ctx.objection)) {
    errors.push('objection: must be a non-empty string slug when provided')
  }

  if (ctx.orderCount !== undefined && (typeof ctx.orderCount !== 'number' || ctx.orderCount < 0)) {
    errors.push('orderCount: must be a non-negative number when provided')
  }

  if (ctx.trialDaysLeft !== undefined && (typeof ctx.trialDaysLeft !== 'number' || ctx.trialDaysLeft < 0)) {
    errors.push('trialDaysLeft: must be a non-negative number when provided')
  }

  if (ctx.savedMinutes !== undefined && (typeof ctx.savedMinutes !== 'number' || ctx.savedMinutes < 0)) {
    errors.push('savedMinutes: must be a non-negative number when provided')
  }

  return errors
}

/**
 * Typed assertion variant — throws on invalid input.
 * Use at API entry points where the caller wants an exception, not an error array.
 */
export function assertDecisionContext(input: unknown): asserts input is DecisionContext {
  const errors = validateDecisionContext(input)
  if (errors.length) {
    throw new Error(`Invalid DecisionContext:\n  ${errors.join('\n  ')}`)
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}
