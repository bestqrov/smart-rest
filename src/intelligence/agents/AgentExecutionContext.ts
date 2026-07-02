// ─── Smart Intelligence Agent Framework — Execution Context (K40) ──────────
// Bundles K33's IntelligenceContext with the agent's own permission/health
// state — no new context resolution logic, pure composition.

import { getContextForTenant } from '../context'
import type { IntelligenceContext } from '../context/types'
import { getFrameworkAgent, getAgentHealth } from './AgentFrameworkRegistry'
import type { AgentPermission, AgentHealth } from './types'

export interface AgentExecutionContext {
  agentId:     string
  context:     IntelligenceContext
  permissions: AgentPermission
  health:      AgentHealth
}

export async function getAgentExecutionContext(agentId: string, tenantId: string): Promise<AgentExecutionContext> {
  const def = getFrameworkAgent(agentId)
  if (!def) throw new Error(`Intelligence: agent "${agentId}" is not registered`)

  const health = getAgentHealth(agentId)
  if (!health) throw new Error(`Intelligence: no health record for agent "${agentId}"`)

  return {
    agentId,
    context: await getContextForTenant(tenantId),
    permissions: def.permissions,
    health,
  }
}
