import type { PromptResult }      from '../prompt-builder/PromptResult'
import type { ComplianceResult }  from './ComplianceValidator'
import type { BrandResult }       from './BrandValidator'
import type { SafetyResult }      from './SafetyChecks'
import type { ValidatedOutput }   from './OutputValidator'
import type { RetryPolicy, RetryRecord } from './RetryPolicy'

// ─── Pipeline status ──────────────────────────────────────────────────────────

/**
 * Lifecycle status of a GenerationPipeline run.
 *
 * Flow for a successful end-to-end generation:
 *   READY_TO_SEND → (provider adapter call) → OUTPUT_VALID
 *
 * Flow for a blocked pipeline:
 *   BLOCKED_SAFETY | BLOCKED_COMPLIANCE | BLOCKED_BRAND | BLOCKED_VALIDATION
 *   → (caller fixes issue, rebuilds prompt, retries)
 *
 * Flow for a failed AI response:
 *   OUTPUT_INVALID → (retry policy) → retry or FAILED
 */
export type PipelineStatus =
  | 'READY_TO_SEND'        // All pre-flight checks passed. Send to AI.
  | 'BLOCKED_SAFETY'       // Stopped by SafetyChecks (injection, PII, etc.)
  | 'BLOCKED_COMPLIANCE'   // Stopped by ComplianceValidator (forbidden patterns, spam)
  | 'BLOCKED_BRAND'        // Stopped by BrandValidator (competitor mention, misspelling)
  | 'BLOCKED_VALIDATION'   // Stopped by prompt structure validation
  | 'OUTPUT_VALID'         // AI output passed OutputValidator. Ready to deliver.
  | 'OUTPUT_INVALID'       // AI output failed OutputValidator. Check retry policy.
  | 'FAILED'               // Unexpected error in the pipeline itself.

// ─── Pipeline stage audit ─────────────────────────────────────────────────────

/** One recorded stage in the pipeline execution. Ordered by executionOrder. */
export interface PipelineStage {
  /** Human-readable stage name. */
  name:           string
  /** 1-based sequential position in the pipeline execution. */
  executionOrder: number
  status:         'PASSED' | 'FAILED' | 'SKIPPED' | 'WARNING'
  /** Wall-clock time the stage took (ms). Non-deterministic — for monitoring only. */
  durationMs:     number
  details:        string
}

// ─── GenerationResult ─────────────────────────────────────────────────────────

/**
 * The output of one pipeline execution.
 *
 * Pre-flight phase (always populated):
 *   safetyResult, complianceResult, brandResult, retryPolicy, stages
 *
 * Output phase (populated only after a provider adapter calls processOutput):
 *   rawOutput, validatedOutput
 *
 * Provider adapters should:
 *   1. Check status === 'READY_TO_SEND' before invoking the AI.
 *   2. Pass the pipelineResult + rawOutput to `processOutput()` after receiving AI response.
 *   3. Check the returned status === 'OUTPUT_VALID' before delivering the message.
 *   4. On OUTPUT_INVALID, check retryPolicy and retryHistory to decide whether to retry.
 */
export interface GenerationResult {
  /**
   * Unique trace ID for this pipeline run.
   * Derived from: traceId option (if provided) → prompt version hash.
   * Not guaranteed to be globally unique — treat as a correlation hint.
   */
  pipelineId:       string

  /** Current lifecycle status. */
  status:           PipelineStatus

  // ── Input ─────────────────────────────────────────────────────────────────
  promptResult:     PromptResult

  // ── Pre-flight ────────────────────────────────────────────────────────────
  safetyResult:     SafetyResult
  complianceResult: ComplianceResult
  brandResult:      BrandResult

  // ── Retry configuration ───────────────────────────────────────────────────
  /** The resolved retry policy for this pipeline run. */
  retryPolicy:      RetryPolicy
  /** History of retry decisions (populated by provider adapters). */
  retryHistory:     RetryRecord[]

  // ── Output phase (null until provider adapter calls processOutput) ─────────
  /** Raw string returned by the AI provider. null before any AI call. */
  rawOutput:        string | null
  /** Structured, validated output. null if rawOutput is null or invalid. */
  validatedOutput:  ValidatedOutput | null

  // ── Audit trail ───────────────────────────────────────────────────────────
  /** Ordered execution log — one entry per pipeline stage. */
  stages:           PipelineStage[]
  /** Non-blocking observations — caller should log but pipeline continues. */
  warnings:         string[]
  /** Hard failures — one per blocking stage. */
  errors:           string[]
}
