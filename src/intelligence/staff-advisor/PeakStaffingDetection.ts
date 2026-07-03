// ─── Smart Intelligence Staff Advisor v1 — Peak Staffing Detection (K64) ───
// Rule-based: compares order volume per hour-of-day against typical shift
// coverage for that hour, across the window. Reuses fetchShiftRecords for
// coverage; the order-by-hour count is a separate, minimal query (order
// timestamps only) distinct from StaffMetrics' per-staff revenue query.

import prisma from '../../prisma'
import { fetchShiftRecords } from './StaffMetrics'
import type { PeakStaffingGap } from './types'

const DEFAULT_WINDOW_DAYS = 30
const GAP_RATIO_THRESHOLD = 10 // orders-per-staff-hour-instance considered understaffed

export async function detectPeakStaffingGaps(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS, limit = 5): Promise<PeakStaffingGap[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const [orders, shiftRecords] = await Promise.all([
    prisma.order.findMany({ where: { cafeId: tenantId, createdAt: { gte: since } }, select: { createdAt: true } }),
    fetchShiftRecords(tenantId, windowDays),
  ])

  const ordersByHour = new Array<number>(24).fill(0)
  for (const order of orders) ordersByHour[order.createdAt.getUTCHours()] += 1

  const coverageByHour = new Array<number>(24).fill(0)
  for (const shift of shiftRecords) {
    const startHour = shift.start.getUTCHours()
    const endHour = shift.end.getUTCHours()
    if (endHour >= startHour) {
      for (let h = startHour; h <= endHour; h++) coverageByHour[h] += 1
    }
  }

  return ordersByHour
    .map((orderCount, hour) => ({
      hour, orderCount, staffOnDuty: coverageByHour[hour]!,
      ordersPerStaff: coverageByHour[hour]! > 0 ? Math.round((orderCount / coverageByHour[hour]!) * 10) / 10 : orderCount,
    }))
    .filter(g => g.orderCount > 0 && g.ordersPerStaff >= GAP_RATIO_THRESHOLD)
    .sort((a, b) => b.ordersPerStaff - a.ordersPerStaff)
    .slice(0, limit)
}
