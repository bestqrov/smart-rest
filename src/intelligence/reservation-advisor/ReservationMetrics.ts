// ─── Smart Intelligence Reservation Advisor v1 — Shared Metrics (K63) ──────
// One query every detector below reuses — no duplicate Reservation
// aggregation. Same "aggregate in JS, no groupBy on Mongo" convention
// K52/K60/K61/K62 already use.

import prisma from '../../prisma'

export interface ReservationRow {
  status:    string
  date:      Date
  guests:    number
  createdAt: Date
}

const DEFAULT_WINDOW_DAYS = 90

export async function fetchReservations(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<ReservationRow[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  return prisma.reservation.findMany({
    where:  { cafeId: tenantId, date: { gte: since } },
    select: { status: true, date: true, guests: true, createdAt: true },
  })
}

export async function fetchActiveTableCapacity(tenantId: string): Promise<{ activeTableCount: number; totalCapacity: number }> {
  const tables = await prisma.table.findMany({
    where:  { cafeId: tenantId, isActive: true },
    select: { capacity: true },
  })
  return {
    activeTableCount: tables.length,
    totalCapacity: tables.reduce((sum, t) => sum + t.capacity, 0),
  }
}

export function groupByDayOfWeek(rows: ReservationRow[]): Map<number, ReservationRow[]> {
  const grouped = new Map<number, ReservationRow[]>()
  for (const row of rows) {
    const day = row.date.getUTCDay()
    const list = grouped.get(day) ?? []
    list.push(row)
    grouped.set(day, list)
  }
  return grouped
}
