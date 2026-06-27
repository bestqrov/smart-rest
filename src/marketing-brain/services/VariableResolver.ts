import { Variable }   from '../models/Variable'
import type { IVariable }       from '../models/Variable'
import type { IMessageTemplate } from '../models/MessageTemplate'
import type { LeadProfile, VariableResolution } from '../types'
import { validateResolvedVariables } from './Validators'

// ─── Regex ────────────────────────────────────────────────────────────────────

/** Matches every {{camelCaseKey}} placeholder in a template body. */
const PLACEHOLDER_RE = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g

// ─── Profile → variable value map ─────────────────────────────────────────────

/**
 * Maps each known variable key to a function that extracts its value
 * from a LeadProfile.  Returns undefined when the profile doesn't supply it
 * so the resolver can fall back to the registry default.
 */
type Extractor = (p: LeadProfile) => string | number | undefined

const PROFILE_EXTRACTORS: Record<string, Extractor> = {
  ownerName:       p => p.ownerName,
  agentName:       p => p.agentName,
  cafeName:        p => p.cafeName,
  cafeCity:        p => p.cafeCity,
  cafeSubdomain:   p => p.cafeSubdomain,
  ownerPhone:      p => p.phone,
  supportLink:     p => p.supportLink,
  trialLink:       p => p.trialLink,
  demoBookingLink: p => p.demoBookingLink,
  customNote:      p => p.customNote,
  orderCount:      p => p.orderCount,
  savedMinutes:    p => p.savedMinutes,
  trialDaysLeft:   p => p.trialDaysLeft,
  expiryDate:      p => p.expiryDate,
  // System-injected at resolve time
  currentDate:     _p => formatCurrentDate(),
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolves all {{key}} placeholders found in `template.body`.
 *
 * Resolution priority per key:
 *   1. LeadProfile field (direct caller data — most authoritative)
 *   2. template.variables[].defaultValue (template-author intent)
 *   3. Variable registry defaultValue (platform-level default)
 *   4. Empty string + warning (key is unknown / unconfigured)
 *
 * After resolution, validates each value against its Variable definition.
 */
export async function resolve(
  profile:  LeadProfile,
  template: IMessageTemplate,
): Promise<VariableResolution> {
  const warnings: string[] = []
  const errors:   string[] = []

  // 1. Extract unique keys from template body
  const keys = extractKeys(template.body)

  // 2. Build lookup maps for fast access
  const templateVarMap = new Map(
    (template.variables ?? []).map(v => [v.key, v.defaultValue]),
  )

  // 3. Batch-load registry definitions (one DB query for all keys)
  const varDefs = keys.length
    ? await Variable.find({ key: { $in: keys }, isActive: true }).lean<IVariable[]>()
    : []
  const registryMap = new Map(varDefs.map(v => [v.key, v]))

  // 4. Resolve each key
  const resolved: Record<string, string> = {}

  for (const key of keys) {
    const profileValue = resolveFromProfile(key, profile)

    if (profileValue !== undefined && profileValue !== '') {
      resolved[key] = String(profileValue)
      continue
    }

    const templateDefault = templateVarMap.get(key)
    if (templateDefault !== undefined && templateDefault !== '') {
      resolved[key] = templateDefault
      continue
    }

    const registryDef = registryMap.get(key)
    if (registryDef?.defaultValue) {
      resolved[key] = registryDef.defaultValue
      continue
    }

    resolved[key] = ''
    if (!registryDef) {
      warnings.push(`{{${key}}} has no registry entry and no default — will render as empty`)
    }
  }

  // 5. Validate resolved values against registry constraints
  const validation = validateResolvedVariables(resolved, varDefs, keys)
  errors.push(...validation.errors)
  warnings.push(...validation.warnings)

  return { resolved, warnings, errors }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/**
 * Replaces all {{key}} placeholders in a string with resolved values.
 * Keys with no resolved value are replaced with an empty string
 * (they should have generated warnings during resolve()).
 */
export function render(body: string, resolved: Record<string, string>): string {
  return body.replace(PLACEHOLDER_RE, (_, key: string) => resolved[key] ?? '')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract unique placeholder keys from a template body. */
export function extractKeys(body: string): string[] {
  const keys = new Set<string>()
  let match: RegExpExecArray | null
  PLACEHOLDER_RE.lastIndex = 0
  while ((match = PLACEHOLDER_RE.exec(body)) !== null) {
    keys.add(match[1])
  }
  PLACEHOLDER_RE.lastIndex = 0
  return [...keys]
}

function resolveFromProfile(key: string, profile: LeadProfile): string | number | undefined {
  const extractor = PROFILE_EXTRACTORS[key]
  return extractor ? extractor(profile) : undefined
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString('fr-FR', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  })
}
