import type { PipelineContext }                from './PipelineContext'
import type { GenerationResult, PipelineStage, PipelineStatus } from './PipelineResult'
import type { Channel }                        from '../models/MessageTemplate'
import type { ValidatedOutput }                from './OutputValidator'

import { runSafetyChecks }     from './SafetyChecks'
import { validateCompliance }  from './ComplianceValidator'
import { validateBrand }       from './BrandValidator'
import { validateOutput }      from './OutputValidator'
import { buildRetryPolicy, DEFAULT_RETRY_POLICY } from './RetryPolicy'
import type { RetryReason }    from './RetryPolicy'
import { mergeRuleConstraints } from '../decision-engine/RuleEvaluator'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all pre-flight validation stages and return a GenerationResult.
 *
 * The pipeline executes the following stages in order:
 *   1. Safety checks     (prompt injection, PII, unsafe HTML, length)
 *   2. Compliance checks (forbidden patterns, spam signals, required tokens)
 *   3. Brand checks      (product name, competitors, unverified claims)
 *
 * If any stage has blockers → status = 'BLOCKED_*' and the pipeline stops.
 * If all stages pass → status = 'READY_TO_SEND'.
 *
 * At this point the caller (a future AI provider adapter) should:
 *   1. Read pipelineResult.promptResult.systemPrompt and .userPrompt
 *   2. Send them to the chosen AI provider
 *   3. Pass the response to processOutput(pipelineResult, rawOutput)
 *
 * Same PromptResult → same pre-flight outcome. Pure, deterministic logic.
 * Only wall-clock durations (durationMs) are non-deterministic.
 *
 * Never throws — all errors are captured in GenerationResult.errors.
 */
export function runPipeline(ctx: PipelineContext): GenerationResult {
  const startMs      = Date.now()
  const { promptResult, options } = ctx
  const stages:   PipelineStage[] = []
  const warnings: string[]        = []
  const errors:   string[]        = []

  const pipelineId = options?.traceId ?? `pipe-${promptResult.version}`
  const policy     = buildRetryPolicy(options?.retryPolicy)

  // ── Stage 1: Safety ───────────────────────────────────────────────────────
  const safetyStart  = Date.now()
  const safetyResult = runSafetyChecks(promptResult)
  stages.push(makeStage('Safety Checks', 1, safetyResult.passed, Date.now() - safetyStart,
    safetyResult.passed
      ? `${safetyResult.checks.length} check(s) passed.`
      : `${safetyResult.blockers.length} blocker(s): ${safetyResult.blockers.join(' | ')}`,
    safetyResult.warnings.length > 0,
  ))

  warnings.push(...safetyResult.warnings)

  if (!safetyResult.passed) {
    errors.push(...safetyResult.blockers)
    return buildResult({
      pipelineId,
      status:  'BLOCKED_SAFETY',
      promptResult,
      safetyResult,
      complianceResult: emptyCompliance(),
      brandResult:      emptyBrand(),
      policy,
      stages,
      warnings,
      errors,
    })
  }

  // ── Stage 2: Compliance ───────────────────────────────────────────────────
  const complianceStart  = Date.now()
  const complianceResult = validateCompliance(promptResult)
  stages.push(makeStage('Compliance Checks', 2, complianceResult.passed, Date.now() - complianceStart,
    complianceResult.passed
      ? `${complianceResult.checks.length} check(s) passed. ${complianceResult.advisories.length} advisor(y/ies).`
      : `${complianceResult.blockers.length} blocker(s): ${complianceResult.blockers.join(' | ')}`,
    complianceResult.advisories.length > 0,
  ))

  warnings.push(...complianceResult.advisories)

  if (!complianceResult.passed) {
    errors.push(...complianceResult.blockers)
    return buildResult({
      pipelineId,
      status:  'BLOCKED_COMPLIANCE',
      promptResult,
      safetyResult,
      complianceResult,
      brandResult: emptyBrand(),
      policy,
      stages,
      warnings,
      errors,
    })
  }

  // ── Stage 3: Brand ────────────────────────────────────────────────────────
  const brandStart  = Date.now()
  const brandResult = validateBrand(promptResult)
  stages.push(makeStage('Brand Checks', 3, brandResult.passed, Date.now() - brandStart,
    brandResult.passed
      ? `${brandResult.checks.length} check(s) passed. ${brandResult.advisories.length} advisor(y/ies).`
      : `${brandResult.blockers.length} blocker(s): ${brandResult.blockers.join(' | ')}`,
    brandResult.advisories.length > 0,
  ))

  warnings.push(...brandResult.advisories)

  if (!brandResult.passed) {
    errors.push(...brandResult.blockers)
    return buildResult({
      pipelineId,
      status:  'BLOCKED_BRAND',
      promptResult,
      safetyResult,
      complianceResult,
      brandResult,
      policy,
      stages,
      warnings,
      errors,
    })
  }

  // ── All pre-flight passed ─────────────────────────────────────────────────
  stages.push(makeStage('Pre-flight Complete', 4, true, Date.now() - startMs,
    `All ${stages.length} pre-flight stage(s) passed. Ready to send to AI provider.`,
    false,
  ))

  return buildResult({
    pipelineId,
    status:  'READY_TO_SEND',
    promptResult,
    safetyResult,
    complianceResult,
    brandResult,
    policy,
    stages,
    warnings,
    errors,
  })
}

/**
 * Process raw AI output through the output validation stage.
 *
 * Called by provider adapters AFTER receiving an AI response.
 * Returns a new GenerationResult with:
 *   - status = 'OUTPUT_VALID'   when all output checks pass
 *   - status = 'OUTPUT_INVALID' when any blocking check fails
 *
 * The retryHistory is updated with a RetryRecord for this attempt.
 *
 * This function does NOT make any AI calls. It validates the string you pass.
 *
 * @param pipeline   The READY_TO_SEND result from runPipeline().
 * @param rawOutput  The raw string returned by the AI provider.
 * @param attempt    1-based attempt number (1 = first try, 2 = first retry, …).
 * @param reason     Retry reason if this is a re-attempt (e.g. 'OUTPUT_INVALID').
 */
export function processOutput(
  pipeline:  GenerationResult,
  rawOutput: string,
  attempt    = 1,
  reason:    RetryReason = 'UNKNOWN',
): GenerationResult {
  const { promptResult } = pipeline

  // Rebuild constraints from the selected AI rules in the decision result
  // We can't access DecisionResult here directly (it's not in PipelineResult),
  // but we can derive an empty constraint set — the OutputValidator handles null gracefully.
  const constraints = deriveConstraintsFromPrompt(promptResult.systemPrompt)

  const validateStart    = Date.now()
  const validatedOutput  = validateOutput(rawOutput, promptResult.metadata.channel as Channel, constraints)
  const validateDuration = Date.now() - validateStart

  const status: PipelineStatus = validatedOutput.passed ? 'OUTPUT_VALID' : 'OUTPUT_INVALID'

  const retryRecord = {
    attempt,
    reason,
    delayMs:   0,   // actual delay is managed by the provider adapter, not the pipeline
    willRetry: !validatedOutput.passed,
  }

  const newStages: PipelineStage[] = [
    ...pipeline.stages,
    makeStage(
      `Output Validation (attempt ${attempt})`,
      pipeline.stages.length + 1,
      validatedOutput.passed,
      validateDuration,
      validatedOutput.passed
        ? `All ${validatedOutput.checks.length} output check(s) passed. ${validatedOutput.characterCount} chars.`
        : `${validatedOutput.failures.length} failure(s): ${validatedOutput.failures.join(' | ')}`,
      false,
    ),
  ]

  const newErrors   = validatedOutput.passed ? pipeline.errors : [...pipeline.errors, ...validatedOutput.failures]
  const newWarnings = [...pipeline.warnings]

  // Advisory: CTA not found is a warning, not a failure
  const ctaCheck = validatedOutput.checks.find(c => c.code === 'CTA_PRESENT')
  if (ctaCheck && !ctaCheck.passed) {
    newWarnings.push(ctaCheck.message)
  }

  return {
    ...pipeline,
    status,
    rawOutput,
    validatedOutput,
    stages:       newStages,
    retryHistory: [...pipeline.retryHistory, retryRecord],
    warnings:     newWarnings,
    errors:       newErrors,
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface BuildArgs {
  pipelineId:       string
  status:           PipelineStatus
  promptResult:     import('../prompt-builder/PromptResult').PromptResult
  safetyResult:     import('./SafetyChecks').SafetyResult
  complianceResult: import('./ComplianceValidator').ComplianceResult
  brandResult:      import('./BrandValidator').BrandResult
  policy:           import('./RetryPolicy').RetryPolicy
  stages:           PipelineStage[]
  warnings:         string[]
  errors:           string[]
}

function buildResult(args: BuildArgs): GenerationResult {
  return {
    pipelineId:       args.pipelineId,
    status:           args.status,
    promptResult:     args.promptResult,
    safetyResult:     args.safetyResult,
    complianceResult: args.complianceResult,
    brandResult:      args.brandResult,
    retryPolicy:      args.policy,
    retryHistory:     [],
    rawOutput:        null,
    validatedOutput:  null,
    stages:           args.stages,
    warnings:         args.warnings,
    errors:           args.errors,
  }
}

function makeStage(
  name:       string,
  order:      number,
  passed:     boolean,
  durationMs: number,
  details:    string,
  hasWarning: boolean,
): PipelineStage {
  const status = !passed     ? 'FAILED'  :
                 hasWarning  ? 'WARNING' : 'PASSED'
  return { name, executionOrder: order, status, durationMs, details }
}

function emptyCompliance(): import('./ComplianceValidator').ComplianceResult {
  return { passed: true, checks: [], blockers: [], advisories: [] }
}

function emptyBrand(): import('./BrandValidator').BrandResult {
  return { passed: true, checks: [], blockers: [], advisories: [] }
}

/**
 * Derive MergedConstraints by scanning the system prompt for the constraint
 * values that SystemPromptBuilder embedded in "## Hard Constraints".
 * This avoids coupling GenerationPipeline to the DecisionResult/AIRule models.
 */
function deriveConstraintsFromPrompt(
  systemPrompt: string,
): import('../decision-engine/RuleEvaluator').MergedConstraints {
  let maxChars:  number | null = null
  let maxLines:  number | null = null
  let maxWords:  number | null = null
  const forbidden: string[] = []
  const required:  string[] = []

  const charsMatch   = systemPrompt.match(/Maximum characters:\s*\*{0,2}(\d+)/i)
  const linesMatch   = systemPrompt.match(/Maximum lines:\s*\*{0,2}(\d+)/i)
  const wordsMatch   = systemPrompt.match(/Maximum words:\s*\*{0,2}(\d+)/i)
  const forbidMatch  = systemPrompt.match(/Forbidden[^:]*:\s*(.+)/i)
  const requiredMatch= systemPrompt.match(/Required tokens[^:]*:\s*(.+)/i)

  if (charsMatch?.[1])  maxChars = parseInt(charsMatch[1]!, 10)
  if (linesMatch?.[1])  maxLines = parseInt(linesMatch[1]!, 10)
  if (wordsMatch?.[1])  maxWords = parseInt(wordsMatch[1]!, 10)

  if (forbidMatch?.[1]) {
    for (const m of forbidMatch[1].matchAll(/"([^"]+)"/g)) forbidden.push(m[1]!)
  }
  if (requiredMatch?.[1]) {
    for (const m of requiredMatch[1].matchAll(/"([^"]+)"/g)) required.push(m[1]!)
  }

  return {
    maxChars,
    maxLines,
    maxWords,
    forbiddenPatterns: [...new Set(forbidden)].sort(),
    requiredTokens:    [...new Set(required)].sort(),
  }
}
