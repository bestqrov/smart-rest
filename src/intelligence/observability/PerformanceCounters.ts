// ─── Smart Intelligence Observability — Performance Counters (K51) ─────────
// Generic named counters/timers, in-memory — same posture as every other
// runtime stats Map in this module (K40 health, K45 stats). Not tied to
// agents specifically, so any Intelligence module can record a counter
// without inventing its own tracker.

import type { TimingStats } from './types'

const counters = new Map<string, number>()
const timings  = new Map<string, { count: number; totalMs: number; maxMs: number }>()

export function incrementCounter(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by)
}

export function getCounter(name: string): number {
  return counters.get(name) ?? 0
}

export function getAllCounters(): Record<string, number> {
  return Object.fromEntries(counters)
}

export function recordTiming(name: string, durationMs: number): void {
  const entry = timings.get(name) ?? { count: 0, totalMs: 0, maxMs: 0 }
  entry.count += 1
  entry.totalMs += durationMs
  entry.maxMs = Math.max(entry.maxMs, durationMs)
  timings.set(name, entry)
}

export function getTimingStats(name: string): TimingStats | undefined {
  const entry = timings.get(name)
  if (!entry) return undefined
  return { count: entry.count, totalMs: entry.totalMs, avgMs: Math.round(entry.totalMs / entry.count), maxMs: entry.maxMs }
}

export function getAllTimingStats(): Record<string, TimingStats> {
  const result: Record<string, TimingStats> = {}
  for (const name of timings.keys()) {
    const stats = getTimingStats(name)
    if (stats) result[name] = stats
  }
  return result
}
