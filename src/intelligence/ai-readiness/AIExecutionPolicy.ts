// ─── Smart Intelligence AI Readiness — Execution Policy (K58) ──────────────
// Pure decision function over the results of the other checks — never
// calls a provider itself.

import type {
  ProviderAvailabilityResult, PromptReadinessResult, ContextCompletenessResult,
  AICapabilityValidationResult, SafetyGuardResult, AIExecutionPolicyDecision,
} from './types'

export function decideAIExecutionPolicy(input: {
  provider:     ProviderAvailabilityResult
  prompt?:      PromptReadinessResult
  context:      ContextCompletenessResult
  capability:   AICapabilityValidationResult
  safetyGuards: SafetyGuardResult[]
}): AIExecutionPolicyDecision {
  const reasons: string[] = [
    ...input.provider.reasons,
    ...(input.prompt?.reasons ?? []),
    ...input.context.reasons,
    ...input.capability.reasons,
    ...input.safetyGuards.filter(g => g.status === 'FAIL').map(g => `safety guard "${g.guardId}" failed: ${g.reason ?? 'no reason given'}`),
  ]

  const allowed =
    input.provider.ready &&
    (input.prompt?.ready ?? true) &&
    input.context.ready &&
    input.capability.ready &&
    !input.safetyGuards.some(g => g.status === 'FAIL')

  return { allowed, reasons }
}
