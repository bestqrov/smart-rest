// ─── Smart Intelligence Agent Framework — Registry (K40) ───────────────────
// Wraps K30's AgentRegistry rather than duplicating event dispatch: every
// framework agent is still registered as a plain IntelligenceAgentDefinition
// via the existing registerAgent/unregisterAgent, so there remains exactly
// one eventBus subscription for the whole Intelligence module
// (IntelligenceEventBus.ts's wildcard). This registry adds the extra state
// K30 doesn't track — capabilities, permissions, lifecycle status, health —
// keyed by the same agent id.

import { registerAgent, unregisterAgent } from '../AgentRegistry'
import { publishStandardEvent } from '../../core'
import type { AgentDefinition, AgentHealth, AgentStatus } from './types'

const definitions = new Map<string, AgentDefinition>()
const health = new Map<string, AgentHealth>()

function initialHealth(): AgentHealth {
  return { status: 'REGISTERED', runCount: 0, errorCount: 0 }
}

export function registerFrameworkAgent(def: AgentDefinition): void {
  if (definitions.has(def.id)) {
    throw new Error(`Intelligence: agent "${def.id}" is already registered`)
  }
  definitions.set(def.id, def)
  health.set(def.id, initialHealth())

  registerAgent({
    id:     def.id,
    name:   def.name,
    module: def.module,
    events: def.events,
    handle: async (event) => {
      const h = health.get(def.id)!
      if (h.status === 'PAUSED' || h.status === 'STOPPED') return // lifecycle gate — no re-registration needed

      try {
        await def.handle(event)
        h.runCount += 1
        h.lastRunAt = new Date()
        if (h.status === 'REGISTERED') setAgentStatus(def.id, 'ACTIVE')
      } catch (err: any) {
        h.errorCount += 1
        h.lastError = err.message ?? 'Unknown error'
        setAgentStatus(def.id, 'ERROR')
        publishStandardEvent('IntelAgentError', {
          tenantId: def.permissions.tenantId ?? 'platform', resourceId: def.id, metadata: { error: h.lastError },
        }, 'agent-framework')
        throw err // preserve K30 dispatch's own error logging
      }
    },
  })

  publishStandardEvent('IntelAgentRegistered', {
    tenantId: def.permissions.tenantId ?? 'platform', resourceId: def.id, metadata: { module: def.module, capabilities: def.capabilities },
  }, 'agent-framework')
}

export function unregisterFrameworkAgent(id: string): boolean {
  unregisterAgent(id)
  health.delete(id)
  return definitions.delete(id)
}

export function getFrameworkAgent(id: string): AgentDefinition | undefined {
  return definitions.get(id)
}

export function getAllFrameworkAgents(): AgentDefinition[] {
  return Array.from(definitions.values())
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────
export function setAgentStatus(id: string, status: AgentStatus): void {
  const h = health.get(id)
  if (!h) throw new Error(`Intelligence: agent "${id}" is not registered`)
  h.status = status
  const def = definitions.get(id)
  publishStandardEvent('IntelAgentStatusChanged', {
    tenantId: def?.permissions.tenantId ?? 'platform', resourceId: id, metadata: { status },
  }, 'agent-framework')
}

export function pauseAgent(id: string): void { setAgentStatus(id, 'PAUSED') }
export function resumeAgent(id: string): void { setAgentStatus(id, 'ACTIVE') }
export function stopAgent(id: string): void { setAgentStatus(id, 'STOPPED') }

// ─── Health/status ──────────────────────────────────────────────────────────
export function getAgentHealth(id: string): AgentHealth | undefined {
  return health.get(id)
}

// ─── Permission model ───────────────────────────────────────────────────────
export function hasCapability(id: string, capability: AgentDefinition['capabilities'][number]): boolean {
  return definitions.get(id)?.capabilities.includes(capability) ?? false
}

// for testing only
export function _resetAgentFrameworkRegistry(): void {
  for (const id of definitions.keys()) unregisterAgent(id)
  definitions.clear()
  health.clear()
}
