// ─── Smart Intelligence AI Chat Copilot Foundation — Service (K67) ─────────
// The one entrypoint: askCopilot(). Never calls K37's action executors or
// K38's decision approval/execution — no autonomous actions, only a
// generated reply grounded in already-computed advisor data. The actual
// LLM call goes through K43's executePrompt (which itself goes through
// K42's AI Provider Layer) — never AIProviderManager.generate() directly.

import { checkAICapability, checkProviderAvailability } from '../ai-readiness'
import { executePrompt } from '../prompts'
import { getCopilotSessionContext, appendCopilotTurn } from './CopilotSession'
import { classifyIntent } from './IntentRouting'
import { getGroundingData } from './AdvisorIntegration'
import { ensureCopilotPromptTemplate, COPILOT_PROMPT_KEY } from './CopilotPromptTemplate'
import type { CopilotRequest, CopilotResponse } from './types'

function formatHistory(history: { question: string; content?: string }[]): string {
  return history
    .slice(-5)
    .map(turn => `Q: ${turn.question}${turn.content ? `\nA: ${turn.content}` : ''}`)
    .join('\n')
}

export async function askCopilot(request: CopilotRequest): Promise<CopilotResponse> {
  const generatedAt = new Date()
  const intent = classifyIntent(request.message)

  const capability = await checkAICapability(request.tenantId)
  if (!capability.ready) {
    return { sessionId: request.sessionId, intent, status: 'DENIED', reason: capability.reasons.join('; '), generatedAt }
  }

  const availability = checkProviderAvailability()
  if (!availability.ready) {
    return { sessionId: request.sessionId, intent, status: 'DENIED', reason: availability.reasons.join('; '), generatedAt }
  }

  const [groundingData, session] = await Promise.all([
    getGroundingData(request.tenantId, intent),
    getCopilotSessionContext(request.tenantId, request.sessionId),
  ])

  await ensureCopilotPromptTemplate()

  const result = await executePrompt({
    key: COPILOT_PROMPT_KEY, tenantId: request.tenantId, performedBy: request.performedBy,
    variables: { question: request.message, groundingData, conversationHistory: formatHistory(session.history) },
    includeContext: true,
  })

  const status: 'COMPLETED' | 'FAILED' = result.ok ? 'COMPLETED' : 'FAILED'
  const message: string | undefined = result.ok ? result.response.content : undefined
  const reason: string | undefined  = 'error' in result ? result.error : undefined

  await appendCopilotTurn(request.tenantId, request.sessionId, {
    question: request.message, content: message, status, at: generatedAt.toISOString(),
  })

  return { sessionId: request.sessionId, intent, status, message, reason, generatedAt }
}
