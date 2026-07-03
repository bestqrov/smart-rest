// ─── Smart Intelligence Marketing Advisor v1 — Best Posting Time (K62) ─────
// Rule-based: buckets this tenant's own EmailMessage opens by hour-of-day
// (UTC) — the only channel with a real per-send engagement timestamp.
// Distinct from TimingPlanner.planTiming() (static country/business-type
// knowledge, not measured); see types.ts header for the reuse note.

import prisma from '../../prisma'
import type { BestPostingHour } from './types'

const DEFAULT_WINDOW_DAYS = 90

export async function detectBestPostingHours(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS, limit = 3): Promise<BestPostingHour[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const opens = await prisma.emailMessage.findMany({
    where:  { cafeId: tenantId, openedAt: { not: null }, sentAt: { gte: since } },
    select: { sentAt: true },
  })

  const counts = new Array<number>(24).fill(0)
  for (const row of opens) {
    if (!row.sentAt) continue
    counts[row.sentAt.getUTCHours()] += 1
  }

  return counts
    .map((count, hour) => ({ hour, opens: count }))
    .filter(h => h.opens > 0)
    .sort((a, b) => b.opens - a.opens)
    .slice(0, limit)
}
