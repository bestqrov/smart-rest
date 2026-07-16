// ─── Smart Intelligence Capability Engine — Contracts (K49) ────────────────
// A capability is a named, platform-level unit of "what the system can
// do" — the vocabulary that Agent permissions (K40), Skill permissions
// (K47), and Advisor capabilities (K46) already reference by plain
// strings. This module is the one place those strings become real,
// discoverable, versioned-by-lifecycle entries. No business capability
// ships here.

export type CapabilityLifecycleStatus = 'REGISTERED' | 'ACTIVE' | 'DEPRECATED' | 'DISABLED'

export interface CapabilityScope {
  tenantIds?: string[]   // undefined = platform-wide; otherwise restricted to these tenants
}

export interface CapabilityDefinition {
  id:                string
  name:              string
  description:       string
  module:            string             // domain grouping — mirrors AgentDefinition.module / SkillMetadata.module
  dependsOn?:        string[]           // other capability ids required alongside this one
  conflictsWith?:    string[]           // capability ids that cannot be active at the same time as this one
  requiresProvider?: string             // optional K42 AI provider id this capability needs active
  scope?:            CapabilityScope
}

export interface CapabilityMetadata extends CapabilityDefinition {
  status: CapabilityLifecycleStatus
}

export interface CapabilityValidationResult {
  valid:  boolean
  errors: string[]
}
