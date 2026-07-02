// ─── Smart Intelligence Agent Runtime — Lifecycle Manager (K45) ────────────
// Composes K40's per-agent status (gates both the reactive dispatch and
// this runtime's pipeline) with this module's scheduler, so callers have
// one place to fully start/stop an agent instead of coordinating two
// systems by hand.

import { pauseAgent, resumeAgent, stopAgent } from '../agents'
import { registerSchedule, unregisterSchedule, isScheduled } from './AgentScheduler'
import type { RunAgentOptions, ScheduleDefinition } from './types'

export function activateAgent(agentId: string, schedule?: ScheduleDefinition, opts?: RunAgentOptions): void {
  resumeAgent(agentId)
  if (schedule) registerSchedule(schedule, opts)
}

export function pauseAgentRuntime(agentId: string): void {
  pauseAgent(agentId)
  if (isScheduled(agentId)) unregisterSchedule(agentId)
}

export function haltAgentRuntime(agentId: string): void {
  stopAgent(agentId)
  if (isScheduled(agentId)) unregisterSchedule(agentId)
}
