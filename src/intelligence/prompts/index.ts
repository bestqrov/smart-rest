// ─── Smart Intelligence Prompt Engine — Public API (K43) ───────────────────

export type { PromptTemplateInput, RenderedPrompt, PromptValidationResult } from './types'

export {
  defineTemplate, getActiveTemplate, getTemplateHistory, listTemplates,
  type StoredPromptTemplate,
} from './PromptTemplateRegistry'

export { renderPrompt } from './PromptRenderer'
export { validateRenderedPrompt } from './PromptValidator'
export { executePrompt, type ExecutePromptInput } from './PromptExecutionAPI'
