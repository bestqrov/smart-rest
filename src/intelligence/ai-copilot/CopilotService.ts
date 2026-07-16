// ─── Smart Intelligence AI Chat Copilot Foundation — Service (K67-K68) ─────
// The one entrypoint: askCopilot(). Never calls K37's action executors or
// K38's decision approval/execution — no autonomous actions, only a
// generated reply grounded in already-computed advisor data. The actual
// LLM call goes through K43's executePrompt (which itself goes through
// K42's AI Provider Layer) — never AIProviderManager.generate() directly.
// K68 adds multi-module retrieval, response composition, source
// attribution, and follow-up resolution — all as extensions of the K67
// pipeline, not a second one.

import { checkAICapability, checkProviderAvailability } from '../ai-readiness'
import { executePrompt } from '../prompts'
import { getCopilotSessionContext, appendCopilotTurn } from './CopilotSession'
import { classifyIntents } from './IntentRouting'
import { getMultiModuleGrounding } from './AdvisorIntegration'
import { composeGroundingText, attributeSources } from './ResponseComposition'
import { ensureCopilotPromptTemplate, COPILOT_PROMPT_KEY } from './CopilotPromptTemplate'
import type { CopilotChatTurn, CopilotRequest, CopilotResponse } from './types'

function formatHistory(history: CopilotChatTurn[]): string {
  return history
    .slice(-5)
    .map(turn => `Q: ${turn.question}${turn.content ? `\nA: ${turn.content}` : ''}`)
    .join('\n')
}

export async function askCopilot(request: CopilotRequest): Promise<CopilotResponse> {
  const generatedAt = new Date()

  const capability = await checkAICapability(request.tenantId)
  if (!capability.ready) {
    return {
      sessionId: request.sessionId, intent: 'general', intents: [], sources: [],
      status: 'DENIED', reason: capability.reasons.join('; '), generatedAt,
    }
  }

  const availability = checkProviderAvailability()
  if (!availability.ready) {
    return {
      sessionId: request.sessionId, intent: 'general', intents: [], sources: [],
      status: 'DENIED', reason: availability.reasons.join('; '), generatedAt,
    }
  }

  const session = await getCopilotSessionContext(request.tenantId, request.sessionId)
  const history = session.history as CopilotChatTurn[]
  const lastIntents = history[history.length - 1]?.intents ?? []

  const intents = classifyIntents(request.message, lastIntents)
  const intent  = intents[0] ?? 'general'

  const groundings = await getMultiModuleGrounding(request.tenantId, intents)
  const groundingData = composeGroundingText(groundings)
  const sources = attributeSources(groundings)

  await ensureCopilotPromptTemplate()

  const result = await executePrompt({
    key: COPILOT_PROMPT_KEY, tenantId: request.tenantId, performedBy: request.performedBy,
    variables: { question: request.message, groundingData, conversationHistory: formatHistory(history) },
    includeContext: true,
  })

  const status: 'COMPLETED' | 'FAILED' = result.ok ? 'COMPLETED' : 'FAILED'
  const message: string | undefined = result.ok ? result.response.content : undefined
  const reason: string | undefined  = 'error' in result ? result.error : undefined

  await appendCopilotTurn(request.tenantId, request.sessionId, {
    question: request.message, content: message, status, at: generatedAt.toISOString(), intents,
  })

  return { sessionId: request.sessionId, intent, intents, sources, status, message, reason, generatedAt }
}
