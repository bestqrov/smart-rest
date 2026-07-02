// ─── Smart Intelligence Agent Runtime — Execution Pipeline (K45) ───────────
// The single execution path for runtime-triggered agent runs (manual and
// scheduled). Does not touch K30/K40's reactive eventBus dispatch — that
// remains the only pipeline for event-triggered runs, this is the only
// pipeline for everything else, so there is exactly one of each and never
// two for the same trigger kind. Reuses K40's AgentFrameworkRegistry for
// the agent definition and lifecycle gate (PAUSED/STOPPED), and the K30
// event shape (NormalizedIntelligenceEvent) so def.handle is identical
// either way.

import { publishStandardEvent } from '../../core'
import { getFrameworkAgent, getAgentHealth } from '../agents'
import type { NormalizedIntelligenceEvent } from '../types'
import { tryAcquire, release } from './ConcurrencyController'
import { emitRuntimeEvent } from './RuntimeMonitoring'
import type { RunAgentOptions, RuntimeRunResult } from './types'

const DEFAULT_TIMEOUT_MS = 30_000

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Agent run timed out after ${timeoutMs}ms`)), timeoutMs)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

export async function runAgentNow(
  agentId: string, event: NormalizedIntelligenceEvent, opts: RunAgentOptions = {},
): Promise<RuntimeRunResult> {
  const start = Date.now()
  const def = getFrameworkAgent(agentId)
  if (!def) {
    return { agentId, status: 'SKIPPED', attempts: 0, durationMs: 0, reason: 'agent not registered' }
  }

  const health = getAgentHealth(agentId)
  if (health?.status === 'PAUSED' || health?.status === 'STOPPED') {
    emitRuntimeEvent({ agentId, phase: 'SKIPPED' })
    return { agentId, status: 'SKIPPED', attempts: 0, durationMs: 0, reason: `agent is ${health.status}` }
  }

  if (!tryAcquire(agentId)) {
    emitRuntimeEvent({ agentId, phase: 'SKIPPED' })
    return { agentId, status: 'SKIPPED', attempts: 0, durationMs: 0, reason: 'concurrency limit reached' }
  }

  const timeoutMs  = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = opts.maxRetries ?? 0
  let attempt = 0
  let lastError: string | undefined

  try {
    while (attempt <= maxRetries) {
      attempt += 1
      emitRuntimeEvent({ agentId, phase: 'START', attempt })
      try {
        await withTimeout(Promise.resolve(def.handle(event)), timeoutMs)
        const durationMs = Date.now() - start
        emitRuntimeEvent({ agentId, phase: 'SUCCESS', attempt, durationMs })
        return { agentId, status: 'COMPLETED', attempts: attempt, durationMs }
      } catch (err: any) {
        lastError = err?.message ?? 'Unknown error'
        const isTimeout = lastError?.startsWith('Agent run timed out')
        if (attempt <= maxRetries) {
          emitRuntimeEvent({ agentId, phase: 'RETRY', attempt, error: lastError })
          continue
        }
        const durationMs = Date.now() - start
        emitRuntimeEvent({ agentId, phase: isTimeout ? 'TIMEOUT' : 'ERROR', attempt, durationMs, error: lastError })
        publishStandardEvent('IntelAgentError', {
          tenantId: event.tenantId ?? 'platform', resourceId: agentId, metadata: { error: lastError, attempts: attempt },
        }, 'agent-runtime')
        return { agentId, status: isTimeout ? 'TIMEOUT' : 'FAILED', attempts: attempt, durationMs, error: lastError }
      }
    }
    // unreachable, satisfies TS control-flow analysis
    return { agentId, status: 'FAILED', attempts: attempt, durationMs: Date.now() - start, error: lastError }
  } finally {
    release(agentId)
  }
}
