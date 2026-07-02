// ─── Smart Intelligence Prompt Engine — Contracts (K43) ────────────────────
// Generic, tenant-agnostic templates — distinct from marketing-brain's
// MessageTemplate/PromptContext, which are tightly coupled to campaign
// generation (decisionResult/strategyResult/knowledge objects). This module
// reuses marketing-brain's generic string primitives (VariableInterpolator,
// PromptVersion) directly rather than re-implementing them.

export interface PromptTemplateInput {
  key:          string
  name:         string
  category:     string
  systemPrompt: string   // may contain {{variables}}
  userPrompt:   string   // may contain {{variables}}
}

export interface RenderedPrompt {
  systemPrompt:        string
  userPrompt:          string
  version:             string     // from marketing-brain's generateVersion
  unresolvedVariables: string[]   // from marketing-brain's findUnresolved
}

export interface PromptValidationResult {
  valid:  boolean
  errors: string[]
}
