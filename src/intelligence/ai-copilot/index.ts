// ─── Smart Intelligence AI Chat Copilot Foundation — Public API (K67) ──────

export type { CopilotIntent, CopilotChatTurn, CopilotRequest, CopilotResponse } from './types'

export { COPILOT_ADVISOR_ID, getCopilotSessionContext, appendCopilotTurn } from './CopilotSession'
export { classifyIntent } from './IntentRouting'
export { getGroundingData } from './AdvisorIntegration'
export { COPILOT_PROMPT_KEY, ensureCopilotPromptTemplate } from './CopilotPromptTemplate'
export { askCopilot } from './CopilotService'
