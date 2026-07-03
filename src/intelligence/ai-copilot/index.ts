// ─── Smart Intelligence AI Chat Copilot Foundation — Public API (K67-K69) ──

export type {
  CopilotIntent, CopilotChatTurn, CopilotRequest, CopilotResponse,
  ActionRiskLevel, ActionPreview, ActionProposalResult, ActionConfirmationResult,
} from './types'

export { COPILOT_ADVISOR_ID, getCopilotSessionContext, appendCopilotTurn } from './CopilotSession'
export { classifyIntent, classifyIntents } from './IntentRouting'
export { getGroundingData, getMultiModuleGrounding, type ModuleGrounding } from './AdvisorIntegration'
export { composeGroundingText, attributeSources } from './ResponseComposition'
export { COPILOT_PROMPT_KEY, ensureCopilotPromptTemplate } from './CopilotPromptTemplate'
export { askCopilot } from './CopilotService'

export { isActionRequest } from './ActionIntentDetection'
export { findMatchingExecutor } from './ActionCatalog'
export { assessActionRisk } from './ActionRiskAssessment'
export { proposeCopilotAction } from './ActionProposalService'
export { confirmCopilotAction, rejectCopilotAction, getCopilotActionProposal } from './ActionConfirmationService'
