// ─── Smart Intelligence Staff Advisor v1 — Attendance Insights (K64) ───────
// Reuses fetchShiftRecords — no new query.

import prisma from '../../prisma'
import { fetchShiftRecords } from './StaffMetrics'
import type { AttendanceInsight } from './types'

export async function getAttendanceInsights(tenantId: string, windowDays?: number): Promise<AttendanceInsight[]> {
  const [shiftRecords, staff] = await Promise.all([
    fetchShiftRecords(tenantId, windowDays),
    prisma.staff.findMany({ where: { cafeId: tenantId, isActive: true }, select: { id: true, name: true } }),
  ])

  const nameById = new Map(staff.map(s => [s.id, s.name]))
  const byStaff = new Map<string, { count: number; totalHours: number }>()
  for (const shift of shiftRecords) {
    const entry = byStaff.get(shift.staffId) ?? { count: 0, totalHours: 0 }
    entry.count += 1
    entry.totalHours += (shift.end.getTime() - shift.start.getTime()) / 3_600_000
    byStaff.set(shift.staffId, entry)
  }

  return [...byStaff.entries()]
    .map(([staffId, { count, totalHours }]): AttendanceInsight => ({
      staffId, name: nameById.get(staffId) ?? staffId, shiftsWorked: count,
      avgShiftHours: count > 0 ? Math.round((totalHours / count) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.shiftsWorked - a.shiftsWorked)
}
