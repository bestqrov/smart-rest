import type { PromptContext } from './PromptContext'
import { findUnresolved }    from './VariableInterpolator'

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ValidationResult {
  /** false if any blocking error was found. */
  valid:    boolean
  /** Blocking issues — the build MUST NOT proceed when this is non-empty. */
  errors:   string[]
  /** Observations — the build can proceed but the caller should log these. */
  warnings: string[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate the PromptContext before starting the build.
 *
 * Errors (blocking):
 *   - No template selected (cannot assemble a user prompt without template body)
 *   - Empty language code
 *   - Empty scenario / businessType (needed for system prompt sections)
 *
 * Warnings (non-blocking):
 *   - No AI rules (prompt will have weaker guardrails)
 *   - Missing knowledge objects (prompt will have reduced cultural/persona context)
 *   - Low confidence score (≤ 40)
 *
 * Pure function: no DB access, no side effects.
 */
export function validatePromptContext(ctx: PromptContext): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  const { decisionResult: dr, decisionContext: dc, strategyResult: sr } = ctx

  // ── Blocking checks ────────────────────────────────────────────────────────

  if (!dr.selectedTemplate) {
    errors.push(
      'No template selected by the Decision Engine. ' +
      'The user prompt cannot be assembled without a template body. ' +
      'Ensure the database contains at least one MessageTemplate that matches ' +
      `language='${dc.language}', scenario='${dc.scenario}'.`,
    )
  } else if (!dr.selectedTemplate.body?.trim()) {
    errors.push(
      `Template '${dr.selectedTemplate.slug}' has an empty body. ` +
      'Cannot assemble user prompt from an empty template.',
    )
  }

  if (!dc.language?.trim()) {
    errors.push('decisionContext.language is empty. Language is required for the system prompt.')
  }

  if (!dc.scenario?.trim()) {
    errors.push('decisionContext.scenario is empty. Scenario trigger is required for context.')
  }

  if (!sr.primaryChannel) {
    errors.push('strategyResult.primaryChannel is missing. Channel is required for output instructions.')
  }

  // ── Non-blocking warnings ──────────────────────────────────────────────────

  if (dr.selectedAIRules.length === 0) {
    warnings.push(
      'No AI rules selected. The system prompt will have no tone, format, or content guardrails. ' +
      'Consider seeding AIRule documents for this scenario/persona/language.',
    )
  }

  if (!ctx.countryKnowledge) {
    warnings.push(
      `No CountryKnowledge available for '${dc.country}'. ` +
      'System prompt will omit cultural intelligence section.',
    )
  }

  if (!ctx.personaKnowledge) {
    warnings.push(
      `No PersonaKnowledge available for '${dc.persona ?? 'inferred persona'}'. ` +
      'System prompt will omit audience profile section.',
    )
  }

  if (!ctx.scenarioKnowledge) {
    warnings.push(
      `No ScenarioKnowledge available for trigger '${dc.scenario}'. ` +
      'System prompt will omit key messages and CTA directives.',
    )
  }

  if (!ctx.businessTypeKnowledge) {
    warnings.push(
      `No BusinessTypeKnowledge available for '${dc.businessType}'. ` +
      'System prompt will omit business context section.',
    )
  }

  if (dr.confidenceScore <= 40) {
    warnings.push(
      `Low confidence score: ${dr.confidenceScore}/100. ` +
      'The selected template, rules, or variables may not be a good fit for this context.',
    )
  }

  if (dr.warnings.length > 0) {
    warnings.push(...dr.warnings.map(w => `[DecisionEngine] ${w}`))
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate that all template variables have been resolved.
 * Called on the interpolated template body (after variable substitution).
 *
 * If any {{key}} still appears in the interpolated text, it means the
 * variables map was missing that key. This is a hard error — the build
 * must not proceed with unresolved placeholders.
 *
 * Pure function: no side effects.
 */
export function validateResolvedVariables(
  interpolatedBody: string,
  variables:         Record<string, string>,
): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  const unresolved = findUnresolved(interpolatedBody)

  if (unresolved.length > 0) {
    errors.push(
      `${unresolved.length} unresolved variable(s) remain after interpolation: ` +
      `[${unresolved.map(k => `{{${k}}}`).join(', ')}]. ` +
      'The prompt cannot be sent with placeholder tokens still present. ' +
      'Add these keys to the Variable documents or provide them in DecisionContext.',
    )
  }

  const allKeys    = Object.keys(variables)
  const usedInBody = findUnresolved(interpolatedBody.replace(/\{\{/g, '{{'))

  // Variables that were resolved but never appeared in the template
  const unusedKeys = allKeys.filter(k => !usedInBody.includes(k))
  if (unusedKeys.length > 2) {
    // Warn only on 3+ — 1-2 unused is normal (e.g. contextual variables kept for metadata)
    warnings.push(
      `${unusedKeys.length} variable(s) were resolved but not used in the template body: ` +
      `[${unusedKeys.join(', ')}]. This may indicate a template/variable mismatch.`,
    )
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate the assembled prompt strings are non-trivially short.
 * A system prompt under 50 chars or user prompt under 20 chars is almost certainly wrong.
 */
export function validateAssembledPrompt(
  systemPrompt: string,
  userPrompt:   string,
): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  if (systemPrompt.trim().length < 50) {
    errors.push(
      `System prompt is suspiciously short (${systemPrompt.trim().length} chars). ` +
      'Something went wrong during assembly.',
    )
  }

  if (userPrompt.trim().length < 20) {
    errors.push(
      `User prompt is suspiciously short (${userPrompt.trim().length} chars). ` +
      'The template body may be empty or entirely composed of unresolved variables.',
    )
  }

  return { valid: errors.length === 0, errors, warnings }
}
