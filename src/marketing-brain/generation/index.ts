// ─── Entry points ─────────────────────────────────────────────────────────────

/**
 * Primary pre-flight entry: run all validation stages on an assembled prompt.
 *
 * Usage:
 *   const pipeline = runPipeline({ promptResult, options })
 *   if (pipeline.status !== 'READY_TO_SEND') { handle blockers }
 *   else { /* hand off to AI provider adapter * / }
 */
export { runPipeline, processOutput } from './GenerationPipeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export type { PipelineContext, PipelineOptions } from './PipelineContext'

export type {
  GenerationResult,
  PipelineStatus,
  PipelineStage,
} from './PipelineResult'

// ── Compliance ────────────────────────────────────────────────────────────────

export type {
  ComplianceResult,
  ComplianceCheck,
  ComplianceCode,
} from './ComplianceValidator'

export { validateCompliance } from './ComplianceValidator'

// ── Brand ─────────────────────────────────────────────────────────────────────

export type {
  BrandResult,
  BrandCheck,
  BrandCode,
} from './BrandValidator'

export { validateBrand } from './BrandValidator'

// ── Safety ────────────────────────────────────────────────────────────────────

export type {
  SafetyResult,
  SafetyCheck,
  SafetyCode,
} from './SafetyChecks'

export { runSafetyChecks } from './SafetyChecks'

// ── Output validation ─────────────────────────────────────────────────────────

export type {
  ValidatedOutput,
  OutputCheck,
  OutputCheckCode,
} from './OutputValidator'

export { validateOutput } from './OutputValidator'

// ── Retry ─────────────────────────────────────────────────────────────────────

export type {
  RetryPolicy,
  RetryReason,
  RetryRecord,
} from './RetryPolicy'

export {
  buildRetryPolicy,
  shouldRetry,
  nextDelayMs,
  buildRetryRecord,
  DEFAULT_RETRY_POLICY,
  AGGRESSIVE_RETRY_POLICY,
  NO_RETRY_POLICY,
  RATE_LIMIT_RETRY_POLICY,
} from './RetryPolicy'
