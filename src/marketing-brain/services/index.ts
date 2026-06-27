export { decide }                                           from './DecisionEngine'
export { select }                                           from './TemplateSelector'
export { resolve as resolveAIRules, mergeConstraints }      from './AIRuleResolver'
export { resolve as resolveVariables, render, extractKeys } from './VariableResolver'
export { plan as planFollowup }                             from './FollowupPlanner'
export { build as buildPrompt }                             from './PromptBuilder'

export {
  validateLeadProfile,
  validateResolvedVariables,
  validateBuiltPrompt,
  assertLeadProfile,
} from './Validators'

export type { PromptBuildArgs } from './PromptBuilder'
