// ─── Smart Intelligence Capability Engine — Integrations (K49) ─────────────
// Ties the new catalog to the two prior modules whose permission checks
// already reference capability strings without a shared source of truth.

import { getSkillMetadata } from '../skills'
import { hasCapabilityRegistered, registerCapability } from './CapabilityRegistry'
import type { CapabilityValidationResult } from './types'

// K40's AgentCapability is a closed string union — these are the same
// literal values, seeded here as infrastructure capabilities (not
// business ones) so the Agent Framework's permission vocabulary is
// discoverable through this registry instead of only living in a type.
const AGENT_FRAMEWORK_CAPABILITIES: { id: string; name: string; description: string }[] = [
  { id: 'knowledge:read',          name: 'Read Knowledge',          description: 'Read entries from the Knowledge Engine (K39)' },
  { id: 'knowledge:write',         name: 'Write Knowledge',         description: 'Record entries into the Knowledge Engine (K39)' },
  { id: 'insight:read',            name: 'Read Insights',           description: 'Read insights from the Insight Engine (K36)' },
  { id: 'insight:create',          name: 'Create Insights',         description: 'Create insights via the Insight Engine (K36)' },
  { id: 'insight:resolve',         name: 'Resolve Insights',        description: 'Resolve insights via the Insight Engine (K36)' },
  { id: 'recommendation:read',     name: 'Read Recommendations',    description: 'Read recommendations from the Recommendation Engine (K35)' },
  { id: 'recommendation:create',   name: 'Create Recommendations',  description: 'Create recommendations via the Recommendation Engine (K35)' },
  { id: 'decision:evaluate',       name: 'Evaluate Decisions',      description: 'Run decision rule evaluation (K38)' },
  { id: 'decision:approve',        name: 'Approve Decisions',       description: 'Approve a pending decision (K38)' },
  { id: 'decision:reject',         name: 'Reject Decisions',        description: 'Reject a pending decision (K38)' },
  { id: 'decision:execute',        name: 'Execute Decisions',       description: 'Queue the action linked to an approved decision (K38)' },
  { id: 'action:enqueue',          name: 'Enqueue Actions',         description: 'Queue an action for later execution (K37)' },
  { id: 'action:run',              name: 'Run Actions',             description: 'Execute a queued action (K37)' },
  { id: 'action:cancel',           name: 'Cancel Actions',          description: 'Cancel a queued action (K37)' },
]

export function registerBuiltinAgentFrameworkCapabilities(): void {
  for (const c of AGENT_FRAMEWORK_CAPABILITIES) {
    if (!hasCapabilityRegistered(c.id)) {
      registerCapability({ id: c.id, name: c.name, description: c.description, module: 'agent-framework' })
    }
  }
}

// Validates a K47 skill's declared requiredCapabilities against this
// registry — SkillRegistry itself is left untouched (no refactor).
export function validateSkillRequiredCapabilities(skillId: string, version?: string): CapabilityValidationResult {
  const meta = getSkillMetadata(skillId, version)
  if (!meta) return { valid: false, errors: [`skill "${skillId}" is not registered`] }

  const missing = meta.permission.requiredCapabilities.filter(c => !hasCapabilityRegistered(c))
  if (missing.length > 0) {
    return { valid: false, errors: missing.map(c => `skill "${skillId}" requires unregistered capability "${c}"`) }
  }
  return { valid: true, errors: [] }
}
