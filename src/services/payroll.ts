/**
 * Shared payroll calculation — used by both GET /api/admin/payroll (list) and
 * POST /api/admin/payroll/:staffId/approve, so the amount an approval
 * persists is always computed the same way the admin saw it on screen, never
 * trusted from the client.
 */

import prisma from '../prisma'

export interface PayrollLine {
  id:             string
  name:           string
  role:           string
  roles:          string[]
  shiftStatus:    string
  dailyRate:      number
  attendanceDays: number
  absenceDays:    number
  lateDays:       number
  totalHours:     number
  baseSalary:     number
  commissions:    number
  deductions:     number
  netSalary:      number
  workingDays:    number
}

// Working days in period (Mon–Sat, excluding Sunday as rest day) — approximate
function countWorkingDays(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  while (cur <= end) {
    if (cur.getDay() !== 0) count++ // skip Sunday
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export async function computePayroll(
  cafeId:     string,
  from:       Date,
  to:         Date,
  staffId?:   string
): Promise<PayrollLine[]> {
  const workingDays = countWorkingDays(from, to)

  const [allStaff, shifts, orders] = await Promise.all([
    prisma.staff.findMany({
      where:  { cafeId, isActive: true, ...(staffId ? { id: staffId } : {}) },
      select: { id: true, name: true, role: true, roles: true, dailyRate: true, shiftStatus: true },
    }),
    prisma.waiterShift.findMany({
      where: { cafeId, clockIn: { gte: from, lte: to } },
      select: { staffId: true, clockIn: true, clockOut: true },
    }),
    prisma.order.findMany({
      where:  { cafeId, status: 'COMPLETED', assignedWaiterId: { not: null }, createdAt: { gte: from, lte: to } },
      select: { assignedWaiterId: true, totalCommission: true },
    }),
  ])

  return allStaff.map(member => {
    const memberShifts = shifts.filter(s => s.staffId === member.id)

    const attendedDays = new Set(
      memberShifts.map(s => {
        const d = new Date(s.clockIn)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
    )
    const attendanceDays = attendedDays.size
    const absenceDays    = Math.max(0, workingDays - attendanceDays)
    const lateDays        = memberShifts.filter(s => new Date(s.clockIn).getHours() >= 10).length

    const totalHours = memberShifts.reduce((sum, s) => {
      const out = s.clockOut ? new Date(s.clockOut).getTime() : Date.now()
      return sum + (out - new Date(s.clockIn).getTime()) / 3600000
    }, 0)

    const baseSalary  = attendanceDays * member.dailyRate
    const commissions = orders
      .filter(o => o.assignedWaiterId === member.id)
      .reduce((sum, o) => sum + (o.totalCommission ?? 0), 0)

    return {
      id:           member.id,
      name:         member.name,
      role:         member.role,
      roles:        member.roles,
      shiftStatus:  member.shiftStatus,
      dailyRate:    member.dailyRate,
      attendanceDays,
      absenceDays,
      lateDays,
      totalHours:   Math.round(totalHours * 10) / 10,
      baseSalary,
      commissions:  Math.round(commissions * 100) / 100,
      deductions:   0,
      netSalary:    Math.round((baseSalary + commissions) * 100) / 100,
      workingDays,
    }
  })
}
