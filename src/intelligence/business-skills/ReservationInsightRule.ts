// ─── Business Skills Pack v1 — Reservation Insight Rule (K52) ──────────────
// Rule-based only, no LLM. Triggered on ReservationNoShow (K15 Reservation
// Management, existing event) — reads Reservation, no new storage.

import prisma from '../../prisma'
import type { InsightRuleDefinition } from '../insights/types'

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

export const reservationInsightRule: InsightRuleDefinition = {
  id:       'reservation-insight',
  name:     'Reservation No-Show Insight',
  category: 'operations',
  events:   ['ReservationNoShow'],
  async evaluate(event) {
    const tenantId = event.tenantId
    if (!tenantId) return null

    const since = new Date(Date.now() - MONTH_MS)
    const [total, noShows] = await Promise.all([
      prisma.reservation.count({ where: { cafeId: tenantId, date: { gte: since } } }),
      prisma.reservation.count({ where: { cafeId: tenantId, date: { gte: since }, status: 'NO_SHOW' } }),
    ])

    if (total < 10) return null // not enough monthly volume to compare meaningfully

    const noShowRatePct = Math.round((noShows / total) * 100)
    if (noShowRatePct < 20) return null

    return {
      category:    'operations',
      severity:    noShowRatePct >= 35 ? 'CRITICAL' : 'WARNING',
      title:       'High reservation no-show rate',
      description: `${noShowRatePct}% of reservations (${noShows} of ${total}) in the last 30 days were no-shows.`,
      metadata:    { total, noShows, noShowRatePct },
    }
  },
}
