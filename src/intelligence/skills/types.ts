// ─── Smart Intelligence Skill System — Contracts (K47) ─────────────────────
// A skill is a versioned, permissioned, directly-invokable unit of code —
// distinct from a K40 agent (event-reactive) and a K46 advisor (session-
// oriented request handler). requiredCapabilities is plain string[] (not
// K40's closed AgentCapability union) because a caller may be either an
// agent (AgentCapability values) or an advisor (open AdvisorCapability
// strings) — both are just strings at the point of comparison.

export type SkillStatus = 'REGISTERED' | 'ACTIVE' | 'DISABLED' | 'ERROR'

export interface SkillHealth {
  status:          SkillStatus
  invocationCount: number
  errorCount:      number
  lastInvokedAt?:  Date
  lastError?:      string
}

export interface SkillPermission {
  requiredCapabilities: string[]   // caller must hold every one of these (resolved from K40 agent or K46 advisor)
  tenantScoped:         boolean    // true = invocation context must carry a tenantId
}

export interface SkillMetadata {
  id:          string
  name:        string
  version:     string     // e.g. "1.0.0" — informational, does not gate compatibility
  description: string
  module:      string      // domain grouping, mirrors AgentDefinition.module
  permission:  SkillPermission
}

export type SkillHandler<TInput = unknown, TOutput = unknown> =
  (input: TInput, ctx: SkillInvocationContext) => Promise<TOutput>

export interface SkillDefinition<TInput = unknown, TOutput = unknown> extends SkillMetadata {
  handle: SkillHandler<TInput, TOutput>
}

export interface SkillInvocationContext {
  tenantId?: string
  callerId:  string   // an agent id (K40) or advisor id (K46) — capabilities are resolved from whichever is registered
}

export type SkillInvocationStatus = 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'DENIED'

export interface SkillInvocationResult<T = unknown> {
  skillId:    string
  version:    string
  status:     SkillInvocationStatus
  output?:    T
  error?:     string
  durationMs: number
}

export interface InvokeSkillOptions {
  version?:   string    // defaults to the skill's current version
  timeoutMs?: number    // default 30_000
}
