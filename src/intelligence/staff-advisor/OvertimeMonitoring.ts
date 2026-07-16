// ─── Smart Intelligence Staff Advisor v1 — Overtime Monitoring (K64) ───────
// Rule-based: flags staff whose average weekly hours (over the window)
// exceed a threshold. Reuses fetchShiftRecords — no new query.

import prisma from '../../prisma'
import { fetchShiftRecords } from './StaffMetrics'
import type { OvertimeAlert } from './types'

const WEEKLY_HOURS_THRESHOLD = 48
const DEFAULT_WINDOW_DAYS = 30

export async function detectOvertimeAlerts(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<OvertimeAlert[]> {
  const [shiftRecords, staff] = await Promise.all([
    fetchShiftRecords(tenantId, windowDays),
    prisma.staff.findMany({ where: { cafeId: tenantId, isActive: true }, select: { id: true, name: true } }),
  ])

  const nameById = new Map(staff.map(s => [s.id, s.name]))
  const hoursByStaff = new Map<string, number>()
  for (const shift of shiftRecords) {
    hoursByStaff.set(shift.staffId, (hoursByStaff.get(shift.staffId) ?? 0) + (shift.end.getTime() - shift.start.getTime()) / 3_600_000)
  }

  const weeks = windowDays / 7
  const alerts: OvertimeAlert[] = []
  for (const [staffId, totalHours] of hoursByStaff) {
    const weekHours = Math.round((totalHours / weeks) * 10) / 10
    if (weekHours >= WEEKLY_HOURS_THRESHOLD) {
      alerts.push({ staffId, name: nameById.get(staffId) ?? staffId, weekHours })
    }
  }

  return alerts.sort((a, b) => b.weekHours - a.weekHours)
}
