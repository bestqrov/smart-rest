// ─── Smart Intelligence Agent Runtime — Concurrency Control (K45) ──────────
// Per-agent in-process run counter — same posture as the rest of the
// Intelligence module's runtime state (in-memory, resets on restart).

const DEFAULT_MAX_CONCURRENCY = 3

const active    = new Map<string, number>()
const maxByAgent = new Map<string, number>()

export function setMaxConcurrency(agentId: string, max: number): void {
  maxByAgent.set(agentId, max)
}

export function getActiveCount(agentId: string): number {
  return active.get(agentId) ?? 0
}

export function tryAcquire(agentId: string): boolean {
  const max = maxByAgent.get(agentId) ?? DEFAULT_MAX_CONCURRENCY
  const current = active.get(agentId) ?? 0
  if (current >= max) return false
  active.set(agentId, current + 1)
  return true
}

export function release(agentId: string): void {
  const current = active.get(agentId) ?? 0
  active.set(agentId, Math.max(0, current - 1))
}
