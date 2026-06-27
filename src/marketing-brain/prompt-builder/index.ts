// ─── Entry points ─────────────────────────────────────────────────────────────

/**
 * Primary entry: assemble a validated, provider-agnostic prompt.
 * Returns a discriminated union — check `result.ok` before using.
 *
 * Usage:
 *   const result = buildPrompt(ctx)
 *   if (result.ok) { // use result.result.systemPrompt, result.result.userPrompt }
 *   else            { // handle result.errors }
 */
export { build as buildPrompt, buildOrThrow } from './PromptBuilder'

// ─── Types ────────────────────────────────────────────────────────────────────

export type { PromptContext }  from './PromptContext'

export type {
  PromptResult,
  PromptBuildResult,
  PromptMetadata,
  PromptTokenEstimate,
} from './PromptResult'

// ─── Individual utilities (for testing and composition) ───────────────────────

/** Validation: call before `build()` to get error/warning lists early. */
export {
  validatePromptContext,
  validateResolvedVariables,
  validateAssembledPrompt,
} from './PromptValidator'

export type { ValidationResult } from './PromptValidator'

/** Variable interpolation utilities. */
export {
  interpolate,
  extractKeys    as extractPromptKeys,
  findUnresolved,
  formatVariableList,
} from './VariableInterpolator'

/** Version fingerprinting. */
export { generateVersion, isSameSchema, schemaOf } from './PromptVersion'

/** System / user prompt section builders (for debugging and testing). */
export { buildSystemPrompt } from './SystemPromptBuilder'
export { buildUserPrompt }   from './UserPromptBuilder'
