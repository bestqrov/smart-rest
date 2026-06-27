import { CHANNELS } from '../models/MessageTemplate'
import type { IVariable }  from '../models/Variable'
import type { LeadProfile } from '../types'

// ─── Lead Profile ─────────────────────────────────────────────────────────────

const LANG_CODE_RE    = /^[a-z]{2}$/
const COUNTRY_CODE_RE = /^[A-Z]{2}$/

/**
 * Returns a list of blocking error messages.
 * An empty array means the profile is valid enough to proceed.
 */
export function validateLeadProfile(profile: unknown): string[] {
  const errors: string[] = []

  if (!profile || typeof profile !== 'object') {
    return ['LeadProfile must be a non-null object']
  }

  const p = profile as Record<string, unknown>

  if (!p.ownerName || typeof p.ownerName !== 'string' || !p.ownerName.trim()) {
    errors.push('ownerName is required and must be a non-empty string')
  }

  if (!p.languageCode || typeof p.languageCode !== 'string' || !LANG_CODE_RE.test(p.languageCode)) {
    errors.push('languageCode must be a 2-letter ISO 639-1 code (e.g. "ar", "fr", "en")')
  }

  if (!p.countryCode || typeof p.countryCode !== 'string' || !COUNTRY_CODE_RE.test(p.countryCode)) {
    errors.push('countryCode must be a 2-letter uppercase ISO 3166-1 alpha-2 code (e.g. "MA", "SA")')
  }

  if (!p.businessTypeSlug || typeof p.businessTypeSlug !== 'string' || !p.businessTypeSlug.trim()) {
    errors.push('businessTypeSlug is required (e.g. "restaurant", "cafe")')
  }

  if (!p.trigger || typeof p.trigger !== 'string' || !p.trigger.trim()) {
    errors.push('trigger is required (e.g. "demo_request_submitted")')
  }

  if (p.channel !== undefined && !CHANNELS.includes(p.channel as any)) {
    errors.push(`channel must be one of: ${CHANNELS.join(', ')}`)
  }

  return errors
}

// ─── Resolved variables ───────────────────────────────────────────────────────

/**
 * After VariableResolver fills in values, validate each one
 * against its Variable definition from the registry.
 *
 * Returns errors (blocking) and warnings (non-blocking).
 */
export function validateResolvedVariables(
  resolved:    Record<string, string>,
  variableDefs: IVariable[],
  templateKeys: string[],
): { errors: string[]; warnings: string[] } {
  const errors:   string[] = []
  const warnings: string[] = []

  const defMap = new Map(variableDefs.map(v => [v.key, v]))

  for (const key of templateKeys) {
    const def   = defMap.get(key)
    const value = resolved[key] ?? ''

    if (!def) {
      warnings.push(`{{${key}}} has no registry definition — value will be "${value || ''}"`)
      continue
    }

    if (def.validation.required && !value) {
      errors.push(`{{${key}}} is required (source: ${def.source}) but resolved to empty`)
      continue
    }

    if (!value) continue   // no further checks on empty optional

    if (def.validation.minLength !== null && value.length < def.validation.minLength) {
      warnings.push(`{{${key}}} is shorter than minimum (${def.validation.minLength} chars)`)
    }

    if (def.validation.maxLength !== null && value.length > def.validation.maxLength) {
      warnings.push(`{{${key}}} exceeds maximum length (${def.validation.maxLength} chars) — will be truncated`)
    }

    if (def.validation.pattern) {
      try {
        if (!new RegExp(def.validation.pattern).test(value)) {
          warnings.push(`{{${key}}} value does not match expected pattern (${def.validation.pattern})`)
        }
      } catch {
        // regex in DB is malformed — ignore pattern check
      }
    }

    if (def.validation.allowedValues.length && !def.validation.allowedValues.includes(value)) {
      warnings.push(
        `{{${key}}} value "${value}" is not in the allowed list: [${def.validation.allowedValues.join(', ')}]`,
      )
    }
  }

  return { errors, warnings }
}

// ─── Built prompt sanity ──────────────────────────────────────────────────────

/**
 * Quick sanity checks on the assembled prompt before returning.
 * Not exhaustive — just catches obvious issues.
 */
export function validateBuiltPrompt(
  system: string,
  user:   string,
): string[] {
  const warnings: string[] = []

  if (!system.trim()) warnings.push('Prompt system block is empty')
  if (!user.trim())   warnings.push('Prompt user block is empty')
  if (user.length > 16_000) warnings.push('Prompt user block exceeds 16k chars — may hit provider token limits')

  const unresolvedVars = user.match(/\{\{[a-zA-Z][a-zA-Z0-9]*\}\}/g)
  if (unresolvedVars?.length) {
    warnings.push(`Prompt contains unresolved variables: ${[...new Set(unresolvedVars)].join(', ')}`)
  }

  return warnings
}

// ─── Typed guard (used by DecisionEngine) ─────────────────────────────────────

export function assertLeadProfile(value: unknown): asserts value is LeadProfile {
  const errors = validateLeadProfile(value)
  if (errors.length) throw new Error(`Invalid LeadProfile: ${errors.join('; ')}`)
}
