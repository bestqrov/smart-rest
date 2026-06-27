import { Variable }   from '../models/Variable'
import type { IVariable }        from '../models/Variable'
import type { IMessageTemplate } from '../models/MessageTemplate'
import type { DecisionContext }  from '../decision-engine/DecisionContext'
import type { DecisionStep }     from '../decision-engine/DecisionResult'
import { scoreVariables, failedStep, successStep } from '../decision-engine/ConfidenceScore'

// ─── Placeholder regex ────────────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g

// ─── Result type ──────────────────────────────────────────────────────────────

export interface VariableSelectorResult {
  resolved:     Record<string, string>   // {{key}} → final string value
  requiredKeys: string[]                 // keys marked required in Variable registry
  step:         DecisionStep
  warnings:     string[]
  errors:       string[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolves all {{key}} placeholders found in the template body.
 *
 * Resolution priority per key:
 *   1. DecisionContext field (direct caller data — most authoritative)
 *   2. template.variables[].defaultValue (template-author intent)
 *   3. Variable registry defaultValue (platform-level fallback)
 *   4. Empty string + warning (unconfigured key)
 *
 * After resolution: validates each value against its Variable definition.
 * Required-variable failures are errors; length/pattern issues are warnings.
 *
 * When template is null (no template found), returns empty resolution.
 */
export async function selectVariables(
  ctx:      DecisionContext,
  template: IMessageTemplate | null,
): Promise<VariableSelectorResult> {
  if (!template) {
    return {
      resolved:     {},
      requiredKeys: [],
      warnings:     [],
      errors:       [],
      step: failedStep(
        'VARIABLES',
        'No template — variable resolution skipped.',
      ),
    }
  }

  const warnings: string[] = []
  const errors:   string[] = []

  // 1. Extract unique placeholder keys from template body
  const keys = extractKeys(template.body)

  // 2. Template-level defaults (author intent)
  const templateDefMap = new Map(
    (template.variables ?? []).map(v => [v.key, v.defaultValue]),
  )

  // 3. Registry definitions (one DB round-trip for all keys)
  const varDefs = keys.length
    ? await Variable.find({ key: { $in: keys }, isActive: true }).lean<IVariable[]>()
    : []
  const registryMap   = new Map(varDefs.map(v => [v.key, v]))
  const requiredKeys  = varDefs.filter(v => v.validation.required).map(v => v.key)

  // 4. Resolve each key
  const resolved: Record<string, string> = {}

  for (const key of keys) {
    const fromCtx = extractFromContext(key, ctx)

    if (fromCtx !== undefined && fromCtx !== '') {
      resolved[key] = String(fromCtx)
      continue
    }

    const templateDefault = templateDefMap.get(key)
    if (templateDefault) {
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
      warnings.push(`{{${key}}} has no registry entry and no default — will render empty`)
    }
  }

  // 5. Validate against registry constraints
  for (const key of keys) {
    const def   = registryMap.get(key)
    const value = resolved[key] ?? ''

    if (!def) continue   // already warned above

    if (def.validation.required && !value) {
      errors.push(`{{${key}}} is required (source: ${def.source}) but resolved to empty`)
      continue
    }
    if (!value) continue

    if (def.validation.maxLength !== null && value.length > def.validation.maxLength) {
      warnings.push(`{{${key}}} exceeds maxLength (${def.validation.maxLength}) — will be truncated`)
    }
    if (def.validation.minLength !== null && value.length < def.validation.minLength) {
      warnings.push(`{{${key}}} is shorter than minLength (${def.validation.minLength})`)
    }
    if (def.validation.pattern) {
      try {
        if (!new RegExp(def.validation.pattern).test(value)) {
          warnings.push(`{{${key}}} does not match expected pattern (${def.validation.pattern})`)
        }
      } catch {
        // malformed regex in DB — skip pattern check
      }
    }
    if (def.validation.allowedValues.length && !def.validation.allowedValues.includes(value)) {
      warnings.push(
        `{{${key}}} value "${value}" not in allowed list: [${def.validation.allowedValues.join(', ')}]`,
      )
    }
  }

  const dimScore    = scoreVariables(resolved, requiredKeys)
  const filledCount = requiredKeys.filter(k => Boolean(resolved[k])).length

  const step = successStep(
    'VARIABLES',
    `${Object.keys(resolved).length} var(s)`,
    `Resolved ${keys.length} placeholder(s). ` +
    `Required: ${filledCount}/${requiredKeys.length} filled. ` +
    (errors.length   ? `Errors: ${errors.length}. ` : '') +
    (warnings.length ? `Warnings: ${warnings.length}. ` : '') +
    `Confidence contribution: ${dimScore}/25.`,
    dimScore,
    0,
    [],
  )

  return { resolved, requiredKeys, step, warnings, errors }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/** Replace all {{key}} placeholders with resolved values. */
export function renderTemplate(
  body:     string,
  resolved: Record<string, string>,
): string {
  return body.replace(PLACEHOLDER_RE, (_, key: string) => resolved[key] ?? '')
}

/** Extract the unique placeholder keys from a template body string. */
export function extractKeys(body: string): string[] {
  const keys = new Set<string>()
  let match: RegExpExecArray | null
  PLACEHOLDER_RE.lastIndex = 0
  while ((match = PLACEHOLDER_RE.exec(body)) !== null) keys.add(match[1])
  PLACEHOLDER_RE.lastIndex = 0
  return [...keys]
}

// ─── Context extractor ────────────────────────────────────────────────────────

type ContextExtractor = (ctx: DecisionContext) => string | number | undefined

/** Maps placeholder keys to their source fields in DecisionContext. */
const CONTEXT_EXTRACTORS: Record<string, ContextExtractor> = {
  ownerName:       c => c.ownerName,
  ownerPhone:      c => c.ownerPhone,
  agentName:       c => c.agentName,
  cafeName:        c => c.cafeName,
  cafeCity:        c => c.cafeCity,
  cafeSubdomain:   c => c.cafeSubdomain,
  supportLink:     c => c.supportLink,
  trialLink:       c => c.trialLink,
  demoBookingLink: c => c.demoBookingLink,
  customNote:      c => c.customNote,
  orderCount:      c => c.orderCount,
  savedMinutes:    c => c.savedMinutes,
  trialDaysLeft:   c => c.trialDaysLeft,
  expiryDate:      c => c.expiryDate,
  // System-injected
  currentDate:     _ => formatCurrentDate(),
}

function extractFromContext(key: string, ctx: DecisionContext): string | number | undefined {
  const extractor = CONTEXT_EXTRACTORS[key]
  return extractor ? extractor(ctx) : undefined
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}
