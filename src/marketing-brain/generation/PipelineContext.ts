import type { PromptResult } from '../prompt-builder/PromptResult'
import type { RetryPolicy }  from './RetryPolicy'

/**
 * Options that tune pipeline behaviour.
 * All fields are optional — the pipeline has sensible defaults for each.
 */
export interface PipelineOptions {
  /**
   * Override any fields of the default RetryPolicy.
   * Omitted fields keep their default value from DEFAULT_RETRY_POLICY.
   */
  retryPolicy?: Partial<RetryPolicy>

  /**
   * Maximum milliseconds a single AI provider call may take before the pipeline
   * considers it a PROVIDER_TIMEOUT and applies the retry policy.
   * Not enforced by the pipeline itself — passed through to provider adapters.
   */
  timeoutMs?: number

  /**
   * When true, checks that produce only advisories (no blockers) are treated as
   * passing. This lets slightly imperfect prompts still reach the AI in a degraded
   * mode. Default: false — any advisory causes the pipeline to log a warning,
   * but does NOT block it.
   */
  allowDegradation?: boolean

  /**
   * Correlation ID for distributed tracing and log aggregation.
   * If provided, used as the pipelineId prefix instead of the prompt version.
   */
  traceId?: string
}

/**
 * Input to the Generation Pipeline.
 *
 * A PipelineContext is assembled after the Prompt Builder succeeds:
 *   const buildResult = buildPrompt(promptCtx)
 *   if (!buildResult.ok) throw ...
 *   const pipelineCtx: PipelineContext = {
 *     promptResult: buildResult.result,
 *     options: { traceId: 'req-abc123' }
 *   }
 *   const pipelineResult = runPipeline(pipelineCtx)
 *
 * The pipeline is the last gate before handing off to an AI provider adapter.
 */
export interface PipelineContext {
  /** The fully assembled and validated prompt from the Prompt Builder (Sprint 5). */
  promptResult: PromptResult

  /** Optional pipeline tuning. Defaults apply when omitted. */
  options?: PipelineOptions
}
