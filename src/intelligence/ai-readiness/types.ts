// ─── Smart Intelligence AI Readiness Layer — Contracts (K58) ───────────────
// Validation and orchestration only — nothing here ever calls
// AIProviderManager.generate() or any LLM. This is the pre-flight gate a
// future business-content sprint would call before actually generating.

export interface ProviderAvailabilityResult {
  ready:      boolean
  hasActiveProvider: boolean
  activeCount: number
  totalCount:  number
  requestedProviderOk?: boolean
  requestedModelOk?:    boolean
  reasons:    string[]
}

export interface PromptReadinessResult {
  ready:               boolean
  templateExists:      boolean
  unresolvedVariables: string[]
  reasons:             string[]
}

export interface ContextCompletenessResult {
  ready:           boolean
  missingFields:   string[]
  completenessPct: number
  reasons:         string[]
}

export interface AICapabilityValidationResult {
  ready:   boolean
  reasons: string[]
}

export type SafetyGuardStatus = 'PASS' | 'FAIL' | 'WARN'

export interface SafetyGuardResult {
  guardId: string
  status:  SafetyGuardStatus
  reason?: string
}

export interface SafetyGuardInput {
  tenantId:  string
  promptKey?: string
  text?:     string
}

export type SafetyGuardCheck = (input: SafetyGuardInput) => SafetyGuardResult | Promise<SafetyGuardResult>

export interface SafetyGuardDefinition {
  id:    string
  name:  string
  check: SafetyGuardCheck
}

export interface AIExecutionPolicyDecision {
  allowed: boolean
  reasons: string[]
}

export interface AIReadinessOptions {
  promptKey?:  string
  variables?:  Record<string, string>
  providerId?: string
  modelId?:    string
}

export interface AIReadinessReport {
  tenantId:     string
  provider:     ProviderAvailabilityResult
  prompt?:      PromptReadinessResult
  context:      ContextCompletenessResult
  capability:   AICapabilityValidationResult
  safetyGuards: SafetyGuardResult[]
  policy:       AIExecutionPolicyDecision
  generatedAt:  Date
}
