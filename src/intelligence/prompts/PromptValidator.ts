// ─── Smart Intelligence Prompt Engine — Validation (K43) ───────────────────
// Generic structural checks on a RenderedPrompt — distinct from
// marketing-brain's PromptValidator, which checks domain-specific assembled
// sections (decision/strategy/knowledge blocks), not template output.

import type { RenderedPrompt, PromptValidationResult } from './types'

export function validateRenderedPrompt(rendered: RenderedPrompt): PromptValidationResult {
  const errors: string[] = []

  if (!rendered.systemPrompt.trim()) errors.push('systemPrompt is empty')
  if (!rendered.userPrompt.trim())   errors.push('userPrompt is empty')
  if (rendered.unresolvedVariables.length > 0) {
    errors.push(`unresolved variables: ${rendered.unresolvedVariables.join(', ')}`)
  }

  return { valid: errors.length === 0, errors }
}
