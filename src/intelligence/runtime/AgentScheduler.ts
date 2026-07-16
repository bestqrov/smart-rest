// ─── Smart Intelligence Agent Runtime — Scheduler (K45) ────────────────────
// Periodic (non-event-triggered) agent invocation. Synthesizes a
// NormalizedIntelligenceEvent per tick — same shape every agent already
// handles — and runs it through the one runtime execution pipeline, so
// scheduled agents are not a second kind of "handle" contract.

import crypto from 'crypto'
import { categorizeEvent } from '../EventCategoryRegistry'
import type { NormalizedIntelligenceEvent } from '../types'
import { runAgentNow } from './AgentExecutionPipeline'
import type { RunAgentOptions, ScheduleDefinition } from './types'

const timers = new Map<string, NodeJS.Timeout>()

function scheduledEvent(def: ScheduleDefinition): NormalizedIntelligenceEvent {
  return {
    eventId:    crypto.randomUUID(),
    eventName:  'IntelAgentScheduledRun',
    module:     categorizeEvent('IntelAgentScheduledRun'),
    tenantId:   def.tenantId ?? null,
    actor:      'agent-scheduler',
    resourceId: def.agentId,
    source:     'agent-scheduler',
    timestamp:  new Date(),
    metadata:   { intervalMs: def.intervalMs },
    raw:        null,
  }
}

export function registerSchedule(def: ScheduleDefinition, opts: RunAgentOptions = {}): void {
  if (timers.has(def.agentId)) unregisterSchedule(def.agentId)

  const timer = setInterval(() => {
    void runAgentNow(def.agentId, scheduledEvent(def), opts)
  }, def.intervalMs)
  timer.unref?.()
  timers.set(def.agentId, timer)
}

export function unregisterSchedule(agentId: string): boolean {
  const timer = timers.get(agentId)
  if (!timer) return false
  clearInterval(timer)
  return timers.delete(agentId)
}

export function isScheduled(agentId: string): boolean {
  return timers.has(agentId)
}

export function getScheduledAgentIds(): string[] {
  return [...timers.keys()]
}
