/**
 * AI Center — In-memory usage statistics accumulator.
 *
 * Populated by a UsageHook registered at server startup.
 * Resets at midnight (daily) via a setInterval.
 * Month-to-date is kept in a separate accumulator that resets on the 1st.
 *
 * All writes are synchronous and race-free (Node.js single-threaded event loop).
 */

import type { UsageEvent } from '../marketing-brain/providers/UsageTracker'

// ─── Per-provider bucket ───────────────────────────────────────────────────────

export interface ProviderStats {
  providerId:        string
  requestsTotal:     number
  requestsSuccess:   number
  requestsFailed:    number
  tokensTotal:       number
  costUsdTotal:      number
  latencyMsSum:      number   // divide by requestsTotal for avg
  lastSuccessAt:     string | null  // ISO timestamp
  lastFailureReason: string | null
}

// ─── Module-level state ───────────────────────────────────────────────────────

const todayStats  = new Map<string, ProviderStats>()
const monthStats  = new Map<string, ProviderStats>()

let lastReset = new Date().toDateString()          // 'Mon Jun 27 2026'
let lastMonthReset = `${new Date().getFullYear()}-${new Date().getMonth()}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBucket(providerId: string): ProviderStats {
  return {
    providerId,
    requestsTotal:     0,
    requestsSuccess:   0,
    requestsFailed:    0,
    tokensTotal:       0,
    costUsdTotal:      0,
    latencyMsSum:      0,
    lastSuccessAt:     null,
    lastFailureReason: null,
  }
}

function getOrCreate(map: Map<string, ProviderStats>, id: string): ProviderStats {
  if (!map.has(id)) map.set(id, emptyBucket(id))
  return map.get(id)!
}

function maybeDailyReset(): void {
  const today = new Date().toDateString()
  if (today !== lastReset) {
    todayStats.clear()
    lastReset = today
  }
}

function maybeMonthReset(): void {
  const n = new Date()
  const key = `${n.getFullYear()}-${n.getMonth()}`
  if (key !== lastMonthReset) {
    monthStats.clear()
    lastMonthReset = key
  }
}

// ─── Public: record one usage event ─────────────────────────────────────────

export function recordUsageEvent(event: UsageEvent): void {
  maybeDailyReset()
  maybeMonthReset()

  for (const map of [todayStats, monthStats]) {
    const bucket = getOrCreate(map, event.provider)

    bucket.requestsTotal++
    bucket.tokensTotal   += event.totalTokens
    bucket.costUsdTotal  += event.costUsd
    bucket.latencyMsSum  += event.latencyMs

    if (event.success) {
      bucket.requestsSuccess++
      bucket.lastSuccessAt = event.timestamp
    } else {
      bucket.requestsFailed++
      bucket.lastFailureReason = event.error ?? 'unknown'
    }
  }
}

// ─── Public: query ───────────────────────────────────────────────────────────

export interface AggregatedStats {
  providerId:         string
  /** Today */
  requestsToday:      number
  tokensToday:        number
  costUsdToday:       number
  successRateToday:   number   // 0–1
  avgLatencyMsToday:  number
  /** Month-to-date */
  requestsMonth:      number
  tokensMonth:        number
  costUsdMonth:       number
  successRateMonth:   number
  avgLatencyMsMonth:  number
  /** Last events */
  lastSuccessAt:      string | null
  lastFailureReason:  string | null
}

export function getProviderStats(providerId: string): AggregatedStats {
  maybeDailyReset()
  maybeMonthReset()

  const t = todayStats.get(providerId) ?? emptyBucket(providerId)
  const m = monthStats.get(providerId) ?? emptyBucket(providerId)

  return {
    providerId,
    requestsToday:      t.requestsTotal,
    tokensToday:        t.tokensTotal,
    costUsdToday:       t.costUsdTotal,
    successRateToday:   t.requestsTotal === 0 ? 1 : t.requestsSuccess / t.requestsTotal,
    avgLatencyMsToday:  t.requestsTotal === 0 ? 0 : t.latencyMsSum / t.requestsTotal,
    requestsMonth:      m.requestsTotal,
    tokensMonth:        m.tokensTotal,
    costUsdMonth:       m.costUsdTotal,
    successRateMonth:   m.requestsTotal === 0 ? 1 : m.requestsSuccess / m.requestsTotal,
    avgLatencyMsMonth:  m.requestsTotal === 0 ? 0 : m.latencyMsSum / m.requestsTotal,
    lastSuccessAt:      t.lastSuccessAt ?? m.lastSuccessAt,
    lastFailureReason:  t.lastFailureReason ?? m.lastFailureReason,
  }
}

export function getAllProviderStats(): AggregatedStats[] {
  maybeDailyReset()
  maybeMonthReset()

  const ids = new Set([...todayStats.keys(), ...monthStats.keys()])
  return [...ids].map(id => getProviderStats(id))
}

/** Platform-wide totals (all providers combined). */
export function getPlatformTotals(): {
  requestsToday: number
  tokensToday:   number
  costUsdToday:  number
  requestsMonth: number
  tokensMonth:   number
  costUsdMonth:  number
  avgLatencyMs:  number
  failureRate:   number
} {
  maybeDailyReset()
  maybeMonthReset()

  let rToday = 0, tToday = 0, cToday = 0, latSum = 0
  let rMonth = 0, tMonth = 0, cMonth = 0, failCount = 0

  for (const b of todayStats.values()) {
    rToday    += b.requestsTotal
    tToday    += b.tokensTotal
    cToday    += b.costUsdTotal
    latSum    += b.latencyMsSum
    failCount += b.requestsFailed
  }
  for (const b of monthStats.values()) {
    rMonth += b.requestsTotal
    tMonth += b.tokensTotal
    cMonth += b.costUsdTotal
  }

  return {
    requestsToday: rToday,
    tokensToday:   tToday,
    costUsdToday:  cToday,
    requestsMonth: rMonth,
    tokensMonth:   tMonth,
    costUsdMonth:  cMonth,
    avgLatencyMs:  rToday === 0 ? 0 : latSum / rToday,
    failureRate:   rToday === 0 ? 0 : failCount / rToday,
  }
}
