// ─── Smart Intelligence Prompt Engine — Execution API (K43) ────────────────
// Ties rendering + validation to K42's AI Provider Layer. Never calls a
// provider with an unvalidated prompt. Every execution is audited (same
// pattern as K38's Decision Engine) and published as IntelPromptExecuted.

import { publishStandardEvent, AuditService } from '../../core'
import { getDefaultManager, type ManagerResult, type GenerateOptions } from '../ai'
import { renderPrompt } from './PromptRenderer'
import { validateRenderedPrompt } from './PromptValidator'

export interface ExecutePromptInput {
  key:         string
  tenantId:    string
  performedBy: string
  variables?:  Record<string, string>
  includeContext?: boolean
  options?:    GenerateOptions
}

export async function executePrompt(input: ExecutePromptInput): Promise<ManagerResult> {
  const rendered = await renderPrompt(input.key, input.tenantId, input.variables ?? {}, input.includeContext ?? true)

  const validation = validateRenderedPrompt(rendered)
  if (!validation.valid) {
    return { ok: false, error: `Invalid prompt: ${validation.errors.join('; ')}`, errorCode: 'INVALID_PROMPT', provider: null, attempts: [] }
  }

  const manager = getDefaultManager()
  const result  = await manager.generate({ systemPrompt: rendered.systemPrompt, userPrompt: rendered.userPrompt }, input.options)

  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'PromptExecution', entityId: input.key, action: 'EXECUTE',
    performedBy: input.performedBy,
    metadata: { tenantId: input.tenantId, version: rendered.version, ok: result.ok, provider: result.provider },
  }).catch(() => undefined)

  publishStandardEvent('IntelPromptExecuted', {
    tenantId: input.tenantId, resourceId: input.key,
    metadata: { version: rendered.version, ok: result.ok, provider: result.provider },
  }, 'prompt-engine')

  return result
}
