// ─── Smart Intelligence Business Advisor — Contracts (K46) ─────────────────
// Foundation only: wires the request/response shape and the pipeline that
// will run advisors, but ships zero advisors and never calls the AI
// Provider Layer itself — that happens inside a future business advisor
// agent's own handle(), executed through the K45 Agent Runtime.

// Capability strings are open (not a closed union like K40's
// AgentCapability) because no business domain is defined yet — the
// AdvisorCapabilityRegistry is what makes a given string "real".
export type AdvisorCapability = string

export interface AdvisorDefinition {
  id:           string
  name:         string
  domain:       string             // e.g. "pricing", "inventory" — free text until a business sprint defines the set
  capabilities: AdvisorCapability[]
  agentId:      string             // the K40/K45 framework agent that actually executes requests for this advisor
  promptKey?:   string             // optional K43 template key; only prepared, never executed here
}

export type AdvisorResponseStatus = 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'TIMEOUT'

export interface AdvisorRequest {
  tenantId:    string
  advisorId:   string
  sessionId:   string
  question:    string
  variables?:  Record<string, string>
  performedBy: string
}

export interface AdvisorResponse {
  requestId:  string
  advisorId:  string
  tenantId:   string
  sessionId:  string
  status:     AdvisorResponseStatus
  content?:   string
  error?:     string
  createdAt:  Date
}
