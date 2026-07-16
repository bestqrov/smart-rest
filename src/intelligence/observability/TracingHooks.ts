// ─── Smart Intelligence Observability — Distributed Tracing Hooks (K51) ────
// Same hook-bridge idiom as K42's addUsageHook / K45's
// addRuntimeMonitoringHook — an external tracer (APM, OpenTelemetry
// exporter, etc.) subscribes here instead of this module writing to any
// particular backend itself.

import crypto from 'crypto'
import type { TraceHook, TraceSpan } from './types'

const hooks = new Set<TraceHook>()

export function addTraceHook(hook: TraceHook): () => void {
  hooks.add(hook)
  return () => hooks.delete(hook)
}

function emit(span: TraceSpan): void {
  for (const hook of hooks) {
    try { hook(span) } catch { /* a broken tracing hook must never break the traced call */ }
  }
}

export interface ActiveSpan {
  traceId: string
  end:     (tags?: Record<string, string>) => void
}

export function startSpan(name: string, tags?: Record<string, string>): ActiveSpan {
  const traceId   = crypto.randomUUID()
  const startedAt = Date.now()
  emit({ traceId, name, startedAt, tags })

  return {
    traceId,
    end: (endTags?: Record<string, string>) => {
      emit({ traceId, name, startedAt, durationMs: Date.now() - startedAt, tags: { ...tags, ...endTags } })
    },
  }
}
