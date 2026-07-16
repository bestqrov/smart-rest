// ─── Smart Intelligence Reservation Advisor v1 — Table Utilization (K63) ───
// Reuses fetchReservations + fetchActiveTableCapacity — no new query.
// Reservations with status CANCELLED/NO_SHOW never occupied a table, so
// they're excluded from guest demand.

import { fetchReservations, fetchActiveTableCapacity } from './ReservationMetrics'
import type { TableUtilization } from './types'

export async function getTableUtilization(tenantId: string, windowDays = 30): Promise<TableUtilization> {
  const [rows, capacity] = await Promise.all([
    fetchReservations(tenantId, windowDays),
    fetchActiveTableCapacity(tenantId),
  ])

  const seatedRows = rows.filter(r => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW')
  const totalGuestsReserved = seatedRows.reduce((sum, r) => sum + r.guests, 0)

  const dailyCapacity = capacity.totalCapacity * windowDays
  const utilizationPct = dailyCapacity > 0 ? Math.round((totalGuestsReserved / dailyCapacity) * 1000) / 10 : 0

  return { ...capacity, totalGuestsReserved, utilizationPct }
}
