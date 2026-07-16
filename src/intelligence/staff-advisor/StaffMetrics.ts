// ─── Smart Intelligence Staff Advisor v1 — Shared Metrics (K64) ────────────
// Two shared queries every detector below reuses — no duplicate
// Staff/Order/Shift aggregation across the module's bullets. Aggregated
// in JS, same "no groupBy on Mongo" convention K52/K60/K61/K62/K63 use
// (routes/adminWaitersPerf.ts uses prisma.order.groupBy directly — kept
// as-is, untouched; this module follows the Intelligence module's own
// established convention instead).

import prisma from '../../prisma'
import type { ShiftRecord, StaffPerformance } from './types'

const DEFAULT_WINDOW_DAYS = 30

function since(windowDays: number): Date {
  return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
}

// Mirrors routes/adminWaitersPerf.ts's fields/formula (closedOrders,
// totalRevenue, totalHours, avgOrdersPerHour) — that route isn't exported
// for reuse, so this is the same computation made reusable.
export async function computeStaffPerformance(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<StaffPerformance[]> {
  const from = since(windowDays)

  const [staff, orders, shifts] = await Promise.all([
    prisma.staff.findMany({ where: { cafeId: tenantId, isActive: true }, select: { id: true, name: true, role: true } }),
    prisma.order.findMany({
      where:  { cafeId: tenantId, assignedWaiterId: { not: null }, billStatus: { in: ['CLOSED_PRINTED', 'CLOSED_VIRTUAL'] }, createdAt: { gte: from } },
      select: { assignedWaiterId: true, totalPrice: true },
    }),
    prisma.waiterShift.findMany({ where: { cafeId: tenantId, clockIn: { gte: from } }, select: { staffId: true, clockIn: true, clockOut: true } }),
  ])

  const statsByStaff = new Map<string, { count: number; revenue: number }>()
  for (const order of orders) {
    const staffId = order.assignedWaiterId!
    const entry = statsByStaff.get(staffId) ?? { count: 0, revenue: 0 }
    entry.count += 1
    entry.revenue += order.totalPrice
    statsByStaff.set(staffId, entry)
  }

  const hoursByStaff = new Map<string, number>()
  const now = Date.now()
  for (const shift of shifts) {
    const end = shift.clockOut ?? new Date(now)
    hoursByStaff.set(shift.staffId, (hoursByStaff.get(shift.staffId) ?? 0) + (end.getTime() - shift.clockIn.getTime()) / 3_600_000)
  }

  return staff.map((member): StaffPerformance => {
    const stats = statsByStaff.get(member.id) ?? { count: 0, revenue: 0 }
    const totalHours = Math.round((hoursByStaff.get(member.id) ?? 0) * 100) / 100
    return {
      staffId: member.id, name: member.name, role: member.role,
      closedOrders: stats.count, totalRevenue: Math.round(stats.revenue * 100) / 100,
      totalHours, avgOrdersPerHour: totalHours > 0 ? Math.round((stats.count / totalHours) * 100) / 100 : null,
    }
  })
}

// WaiterShift + CashierShift normalized into one shift-record set — the
// only source for attendance/overtime/peak-staffing detectors below.
export async function fetchShiftRecords(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<ShiftRecord[]> {
  const from = since(windowDays)
  const now = new Date()

  const [waiterShifts, cashierShifts] = await Promise.all([
    prisma.waiterShift.findMany({ where: { cafeId: tenantId, clockIn: { gte: from } }, select: { staffId: true, clockIn: true, clockOut: true } }),
    prisma.cashierShift.findMany({ where: { cafeId: tenantId, startTime: { gte: from } }, select: { staffId: true, startTime: true, endTime: true } }),
  ])

  return [
    ...waiterShifts.map((s): ShiftRecord => ({ staffId: s.staffId, start: s.clockIn, end: s.clockOut ?? now })),
    ...cashierShifts.map((s): ShiftRecord => ({ staffId: s.staffId, start: s.startTime, end: s.endTime ?? now })),
  ]
}
