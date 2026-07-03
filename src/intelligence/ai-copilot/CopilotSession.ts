// ─── Smart Intelligence AI Chat Copilot Foundation — Session (K67) ─────────
// Reuses K46's getAdvisorSessionContext/appendAdvisorSessionTurn directly
// — the copilot is registered as a fixed advisorId under that same
// "advisor-session" Memory Engine namespace, not a second session store.
// K46 left SessionTurn.content always undefined ("until a future sprint
// extends that contract") — this sprint is that extension: the copilot
// actually populates content with the generated reply.

import { getAdvisorSessionContext, appendAdvisorSessionTurn, type AdvisorSessionContext } from '../advisor'
import type { CopilotChatTurn } from './types'

export const COPILOT_ADVISOR_ID = 'ai-copilot'

export async function getCopilotSessionContext(tenantId: string, sessionId: string): Promise<AdvisorSessionContext> {
  return getAdvisorSessionContext(tenantId, COPILOT_ADVISOR_ID, sessionId)
}

export async function appendCopilotTurn(tenantId: string, sessionId: string, turn: CopilotChatTurn): Promise<void> {
  await appendAdvisorSessionTurn(tenantId, COPILOT_ADVISOR_ID, sessionId, turn)
}
