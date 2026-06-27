import type { PromptContext }     from './PromptContext'
import type { PromptBuildResult, PromptTokenEstimate } from './PromptResult'

import { validatePromptContext, validateResolvedVariables, validateAssembledPrompt } from './PromptValidator'
import { interpolate }           from './VariableInterpolator'
import { buildSystemPrompt }     from './SystemPromptBuilder'
import { buildUserPrompt }       from './UserPromptBuilder'
import { generateVersion }       from './PromptVersion'

// ─── Token estimation ─────────────────────────────────────────────────────────

// 1 token ≈ 4 characters (conservative GPT-4 approximation).
// Arabic and multi-byte text may cost more; this is a floor estimate.
const CHARS_PER_TOKEN = 4

function estimateTokens(systemPrompt: string, userPrompt: string): PromptTokenEstimate {
  const systemTokens = Math.ceil(systemPrompt.length / CHARS_PER_TOKEN)
  const userTokens   = Math.ceil(userPrompt.length   / CHARS_PER_TOKEN)
  return {
    systemTokens,
    userTokens,
    totalTokens: systemTokens + userTokens,
    method:      'CHAR_RATIO',
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assemble a complete, validated, provider-agnostic prompt from a PromptContext.
 *
 * Returns a discriminated union — check `result.ok` before using the prompt:
 *   if (result.ok) { sendToAI(result.result.systemPrompt, result.result.userPrompt) }
 *   else           { logErrors(result.errors) }
 *
 * Pipeline:
 *   1. Validate PromptContext (template present, language set, channel set)
 *   2. Interpolate template body (replace {{key}} → value)
 *   3. Validate resolved variables (reject any remaining {{key}})
 *   4. Build system prompt (deterministic, from all knowledge + rules)
 *   5. Build user prompt (task instruction + rendered template + strategy notes)
 *   6. Validate assembled lengths
 *   7. Estimate token counts
 *   8. Generate deterministic version fingerprint
 *   9. Return PromptResult
 *
 * Guarantees:
 *   - Same PromptContext → same systemPrompt, userPrompt, version
 *   - No AI calls, no DB access, no side effects
 *   - Never throws — all errors surface through `result.ok = false`
 *
 * @param ctx  The assembled PromptContext (DecisionResult + StrategyResult + knowledge).
 * @returns    PromptBuildResult — ok:true with PromptResult, or ok:false with errors.
 */
export function build(ctx: PromptContext): PromptBuildResult {
  const allWarnings: string[] = []

  // ── Step 1: Validate PromptContext ────────────────────────────────────────
  const ctxValidation = validatePromptContext(ctx)
  allWarnings.push(...ctxValidation.warnings)

  if (!ctxValidation.valid) {
    return { ok: false, errors: ctxValidation.errors, warnings: allWarnings }
  }

  // Step 1 passing guarantees selectedTemplate and its body are non-null/non-empty
  const template  = ctx.decisionResult.selectedTemplate!
  const variables = ctx.decisionResult.selectedVariables

  // ── Step 2: Interpolate template body ─────────────────────────────────────
  const renderedBody = interpolate(template.body, variables)

  // ── Step 3: Validate resolved variables ───────────────────────────────────
  const varValidation = validateResolvedVariables(renderedBody, variables)
  allWarnings.push(...varValidation.warnings)

  if (!varValidation.valid) {
    return { ok: false, errors: varValidation.errors, warnings: allWarnings }
  }

  // ── Step 4 & 5: Build prompts ─────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(ctx)
  const userPrompt   = buildUserPrompt(ctx, renderedBody)

  // ── Step 6: Validate assembled lengths ────────────────────────────────────
  const lengthValidation = validateAssembledPrompt(systemPrompt, userPrompt)
  allWarnings.push(...lengthValidation.warnings)

  if (!lengthValidation.valid) {
    return { ok: false, errors: lengthValidation.errors, warnings: allWarnings }
  }

  // ── Step 7: Token estimation ──────────────────────────────────────────────
  const estimatedTokens = estimateTokens(systemPrompt, userPrompt)

  // ── Step 8: Version fingerprint ───────────────────────────────────────────
  const version = generateVersion(systemPrompt, userPrompt)

  // ── Step 9: Build metadata ────────────────────────────────────────────────
  const { decisionResult: dr, decisionContext: dc, strategyResult: sr } = ctx
  const sk = ctx.scenarioKnowledge

  const metadata = {
    templateSlug:    template.slug,
    personaSlug:     ctx.personaKnowledge?.slug ?? dc.persona ?? null,
    scenarioTrigger: dr.selectedScenario?.trigger ?? dc.scenario,
    scenarioStage:   dr.selectedScenario?.stage   ?? sk?.stage ?? null,
    languageCode:    dc.language,
    channel:         sr.primaryChannel,
    rulesApplied:    dr.selectedAIRules.length,
    hardRulesCount:  dr.selectedAIRules.filter(r => r.isHard).length,
    primaryGoal:     sk?.primaryGoal ?? null,
    urgency:         sk?.urgency     ?? null,
    createdAt:       new Date().toISOString(),
  }

  return {
    ok: true,
    result: {
      systemPrompt,
      userPrompt,
      variables,
      metadata,
      version,
      estimatedTokens,
    },
    warnings: allWarnings,
  }
}

/**
 * Assert variant — throws on validation failure instead of returning ok:false.
 * Useful in trusted, test-controlled contexts where you know the input is valid.
 * Do NOT use in production paths — use `build()` and check `ok` instead.
 */
export function buildOrThrow(ctx: PromptContext): import('./PromptResult').PromptResult {
  const result = build(ctx)
  if (result.ok) return result.result
  // Type assertion: we know result.ok is false here but TS can't narrow cross-module
  const errors = (result as { ok: false; errors: string[]; warnings: string[] }).errors
  throw new Error(`PromptBuilder.buildOrThrow failed:\n${errors.map(e => `  • ${e}`).join('\n')}`)
}
