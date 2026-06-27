import type { IVariable } from '../models/Variable'

// ─── Result types ─────────────────────────────────────────────────────────────

export interface VariableValidationResult {
  errors:   string[]
  warnings: string[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate resolved variable values against their registry definitions.
 *
 * Errors (blocking):
 *   - Required variable resolved to empty string
 *
 * Warnings (non-blocking):
 *   - Value exceeds maxLength
 *   - Value below minLength
 *   - Value fails pattern check
 *   - Value not in allowedValues list
 *   - Key has no registry definition at all
 */
export function validateVariables(
  resolved:    Record<string, string>,
  variableDefs: IVariable[],
  templateKeys: string[],
): VariableValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  const defMap = new Map(variableDefs.map(v => [v.key, v]))

  for (const key of templateKeys) {
    const def   = defMap.get(key)
    const value = resolved[key] ?? ''

    if (!def) {
      warnings.push(`{{${key}}}: no registry definition — rendering as "${value || ''}"`)
      continue
    }

    if (def.validation.required && !value) {
      errors.push(`{{${key}}}: required (source: ${def.source}) but resolved to empty`)
      continue
    }

    if (!value) continue   // empty optional — no further checks

    if (def.validation.maxLength !== null && value.length > def.validation.maxLength) {
      warnings.push(
        `{{${key}}}: value length ${value.length} exceeds maxLength ${def.validation.maxLength}`,
      )
    }

    if (def.validation.minLength !== null && value.length < def.validation.minLength) {
      warnings.push(
        `{{${key}}}: value length ${value.length} below minLength ${def.validation.minLength}`,
      )
    }

    if (def.validation.min !== null && typeof def.validation.min === 'number') {
      const num = parseFloat(value)
      if (!isNaN(num) && num < def.validation.min) {
        warnings.push(`{{${key}}}: value ${num} below minimum ${def.validation.min}`)
      }
    }

    if (def.validation.max !== null && typeof def.validation.max === 'number') {
      const num = parseFloat(value)
      if (!isNaN(num) && num > def.validation.max) {
        warnings.push(`{{${key}}}: value ${num} exceeds maximum ${def.validation.max}`)
      }
    }

    if (def.validation.pattern) {
      try {
        if (!new RegExp(def.validation.pattern).test(value)) {
          warnings.push(
            `{{${key}}}: value does not match expected pattern (${def.validation.pattern})`,
          )
        }
      } catch {
        // malformed regex in DB — skip the check silently
      }
    }

    if (def.validation.allowedValues.length && !def.validation.allowedValues.includes(value)) {
      warnings.push(
        `{{${key}}}: "${value}" not in allowed list [${def.validation.allowedValues.join(', ')}]`,
      )
    }
  }

  return { errors, warnings }
}

/**
 * Extract keys of required variables from a set of registry definitions.
 * Used to compute the variable completeness score.
 */
export function requiredKeysFromDefs(defs: IVariable[]): string[] {
  return defs.filter(v => v.validation.required).map(v => v.key)
}

/**
 * Check whether all required variables in the template have non-empty values.
 * Returns true = all required vars present, false = some are missing.
 */
export function allRequiredPresent(
  resolved:     Record<string, string>,
  requiredKeys: string[],
): boolean {
  return requiredKeys.every(k => Boolean(resolved[k]))
}

/**
 * Produce a concise report of variable resolution gaps.
 * Useful for debugging and the reasoning trail.
 */
export function summarizeGaps(
  resolved:     Record<string, string>,
  requiredKeys: string[],
  allKeys:      string[],
): { missingRequired: string[]; missingOptional: string[] } {
  const missingRequired = requiredKeys.filter(k => !resolved[k])
  const optionalKeys    = allKeys.filter(k => !requiredKeys.includes(k))
  const missingOptional = optionalKeys.filter(k => !resolved[k])
  return { missingRequired, missingOptional }
}
