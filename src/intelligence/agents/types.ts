// ─── Smart Intelligence Agent Framework — Contracts (K40) ──────────────────
// Extends K30's IntelligenceAgentDefinition (id/name/module/events/handle —
// unchanged) with the framework concerns K30 deliberately left out:
// capabilities, permissions, lifecycle, health. State is in-memory, same
// posture as K30's AgentRegistry itself (resets on process restart) —
// no new persistence for a framework sprint.

import type { PlatformEventName } from '../../core'
import type { AgentEventHandler } from '../types'

// Capability strings are namespaced by the real engine + operation they
// gate access to (Knowledge/Decision/Action — K39/K38/K37) — not arbitrary.
export type AgentCapability =
  | 'knowledge:read' | 'knowledge:write'
  | 'insight:read' | 'insight:create' | 'insight:resolve'
  | 'recommendation:read' | 'recommendation:create'
  | 'decision:evaluate' | 'decision:approve' | 'decision:reject' | 'decision:execute'
  | 'action:enqueue' | 'action:run' | 'action:cancel'

export interface AgentPermission {
  tenantId?:    string               // undefined = platform-wide agent
  capabilities: AgentCapability[]
}

export type AgentStatus = 'REGISTERED' | 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'ERROR'

export interface AgentHealth {
  status:     AgentStatus
  runCount:   number
  errorCount: number
  lastRunAt?: Date
  lastError?: string
}

export interface AgentDefinition {
  id:           string
  name:         string
  module:       string
  events:       PlatformEventName[] | '*'
  capabilities: AgentCapability[]
  permissions:  AgentPermission
  handle:       AgentEventHandler
}

export interface AgentMessage {
  from:      string
  to:        string
  type:      string
  payload:   unknown
  timestamp: Date
}
