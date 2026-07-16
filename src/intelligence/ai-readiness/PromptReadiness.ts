// ─── Smart Intelligence AI Readiness — Prompt Readiness (K58) ──────────────
// Reuses K43's getActiveTemplate/renderPrompt/validateRenderedPrompt
// directly — rendering only, never executed, same boundary K43 itself
// already enforces.

import { getActiveTemplate, renderPrompt, validateRenderedPrompt } from '../prompts'
import type { PromptReadinessResult } from './types'

export async function checkPromptReadiness(
  tenantId: string, promptKey: string, variables: Record<string, string> = {},
): Promise<PromptReadinessResult> {
  const template = await getActiveTemplate(promptKey)
  if (!template) {
    return { ready: false, templateExists: false, unresolvedVariables: [], reasons: [`prompt template "${promptKey}" is not defined`] }
  }

  const rendered = await renderPrompt(promptKey, tenantId, variables, true)
  const validation = validateRenderedPrompt(rendered)

  return {
    ready: validation.valid, templateExists: true,
    unresolvedVariables: rendered.unresolvedVariables, reasons: validation.errors,
  }
}
