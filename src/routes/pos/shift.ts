/**
 * POST /api/pos/shift
 *
 * Three actions in one route (action field in body):
 *   "login"  — verify PIN → return staffToken (no shift opened yet)
 *   "open"   — verify PIN + open a new shift
 *   "close"  — close the current open shift and calculate cash totals
 *   "status" — return current open shift for the authenticated staff (requires Bearer token)
 */

import express, { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../../prisma'
import logger from '../../logger'
import { JWT_SECRET } from '../../config'
import authorizePOS from '../../middleware/authorizePOS'
import type { StaffRole } from '../../types/staff'

const router = express.Router()

const SHIFT_TOKEN_EXPIRY = '12h'

// ─── helpers ─────────────────────────────────────────────────────────────────

function issueStaffToken(staffId: string, cafeId: string, staffRole: StaffRole, shiftId?: string) {
  return jwt.sign({ staffId, cafeId, staffRole, shiftId }, JWT_SECRET, { expiresIn: SHIFT_TOKEN_EXPIRY })
}

async function validatePin(cafeId: string, pinCode: string) {
  const staff = await prisma.staff.findFirst({
    where: { cafeId, isActive: true }
  })
  // iterate over all active staff for this cafe (PIN uniqueness per cafe is enforced at creation)
  const allStaff = await prisma.staff.findMany({
    where: { cafeId, isActive: true },
    select: { id: true, name: true, role: true, pinCode: true }
  })
  for (const s of allStaff) {
    const match = await bcrypt.compare(pinCode, s.pinCode)
    if (match) return s
  }
  return null
}

// ─── shift helpers — shared by the PIN branch and the demo-mode branch ───────

async function openShiftFor(
  staffId: string,
  cafeId: string,
  initialCash: number,
  plannedEndTime?: string,
  notes?: string
) {
  const openShift = await prisma.cashierShift.findFirst({
    where: { staffId, cafeId, status: 'OPEN' }
  })
  if (openShift) {
    const err: any = new Error('A shift is already open for this staff member')
    err.status = 409
    err.shiftId = openShift.id
    throw err
  }

  let parsedPlannedEndTime: Date | undefined
  if (plannedEndTime) {
    parsedPlannedEndTime = new Date(plannedEndTime)
    if (isNaN(parsedPlannedEndTime.getTime())) {
      const err: any = new Error('plannedEndTime is not a valid date')
      err.status = 400
      throw err
    }
  }

  return prisma.cashierShift.create({
    data: {
      cafeId,
      staffId,
      status:             'OPEN',
      initialCash:        initialCash ?? 0,
      totalCollectedCash: 0,
      plannedEndTime:     parsedPlannedEndTime ?? null,
      notes:              notes ?? null
    }
  })
}

async function closeShiftFor(staffId: string, cafeId: string, countedCash?: number) {
  const shift = await prisma.cashierShift.findFirst({
    where: { staffId, cafeId, status: 'OPEN' }
  })
  if (!shift) {
    const err: any = new Error('No open shift found for this staff member')
    err.status = 404
    throw err
  }

  const cashOrders = await prisma.order.aggregate({
    where: {
      cafeId,
      createdById:   staffId,
      paymentMethod: 'CASH',
      isPaid:        true,
      createdAt:     { gte: shift.startTime }
    },
    _sum: { totalPrice: true }
  })
  const totalCollectedCash = cashOrders._sum.totalPrice ?? 0

  let discrepancy: number | null = null
  if (typeof countedCash === 'number' && !isNaN(countedCash)) {
    discrepancy = countedCash - (shift.initialCash + totalCollectedCash)
  }

  return prisma.cashierShift.update({
    where: { id: shift.id },
    data: {
      status:             'CLOSED',
      endTime:            new Date(),
      totalCollectedCash,
      countedCash:        typeof countedCash === 'number' ? countedCash : null,
      discrepancy
    }
  })
}

// ─── POST /api/pos/shift ──────────────────────────────────────────────────────

router.post('/api/pos/shift', async (req: Request, res: Response) => {
  try {
    const { cafeId: rawCafeId, subdomain, pinCode, action, initialCash, notes, plannedEndTime, countedCash } = req.body as {
      cafeId?:         string
      subdomain?:      string   // convenience alias — resolved to cafeId below
      pinCode:         string
      action:          'login' | 'open' | 'close' | 'status'
      initialCash?:    number
      notes?:          string
      plannedEndTime?: string   // ISO datetime — staff's declared "sortie prévue"
      countedCash?:    number   // staff-entered cash count at clôture
    }

    if (!action) {
      return res.status(400).json({ error: 'action is required' })
    }

    // Resolve cafeId: accept either the ObjectID or a human-readable subdomain
    let cafeId = rawCafeId ?? ''
    if (!cafeId && subdomain) {
      const cafe = await prisma.cafe.findUnique({
        where:  { subdomain: subdomain.trim().toLowerCase() },
        select: { id: true }
      })
      if (!cafe) return res.status(404).json({ error: 'Cafe not found for this subdomain' })
      cafeId = cafe.id
    }

    if (!cafeId) {
      return res.status(400).json({ error: 'cafeId or subdomain is required' })
    }

    // ── "status" — authenticated staff checks their current shift ─────────────
    if (action === 'status') {
      const auth = req.header('authorization')
      if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token required for status check' })
      let payload: any
      try { payload = jwt.verify(auth.split(' ')[1], JWT_SECRET) } catch {
        return res.status(401).json({ error: 'Invalid token' })
      }
      if (!payload.staffId) return res.status(401).json({ error: 'Not a POS token' })

      const shift = await prisma.cashierShift.findFirst({
        where: { staffId: payload.staffId, cafeId, status: 'OPEN' },
        include: { staff: { select: { id: true, name: true, role: true } } }
      })
      return res.json({ shift: shift ?? null })
    }

    // ── Demo mode: bypass PIN if subdomain is DEMO_SUBDOMAIN and demoStaffId provided ──
    const DEMO_SUB = (process.env.DEMO_SUBDOMAIN ?? 'welcome').toLowerCase()
    if (subdomain?.trim().toLowerCase() === DEMO_SUB && req.body.demoStaffId) {
      const demoStaff = await prisma.staff.findFirst({
        where: { id: req.body.demoStaffId, cafeId, isActive: true },
        select: { id: true, name: true, role: true },
      })
      if (!demoStaff) return res.status(404).json({ error: 'Staff not found' })

      if (action === 'open') {
        try {
          const shift = await openShiftFor(demoStaff.id, cafeId, initialCash ?? 0, plannedEndTime, notes)
          const token = issueStaffToken(demoStaff.id, cafeId, demoStaff.role as StaffRole, shift.id)
          return res.status(201).json({ token, staff: demoStaff, shift })
        } catch (err: any) {
          return res.status(err.status ?? 500).json({ error: err.message, shiftId: err.shiftId })
        }
      }

      if (action === 'close') {
        try {
          const closed = await closeShiftFor(demoStaff.id, cafeId, countedCash)
          return res.json({ shift: closed })
        } catch (err: any) {
          return res.status(err.status ?? 500).json({ error: err.message })
        }
      }

      // default (login / anything else): same behavior as before — return
      // a token plus whatever shift is currently open, without creating one.
      const existingShift = await prisma.cashierShift.findFirst({
        where: { staffId: demoStaff.id, cafeId, status: 'OPEN' }
      })
      const token = issueStaffToken(demoStaff.id, cafeId, demoStaff.role as StaffRole, existingShift?.id)
      return res.json({
        token,
        staff: { id: demoStaff.id, name: demoStaff.name, role: demoStaff.role },
        shift: existingShift ?? null
      })
    }

    // ── PIN is required for login / open / close ──────────────────────────────
    if (!pinCode) return res.status(400).json({ error: 'pinCode is required' })

    const staff = await validatePin(cafeId, pinCode)
    if (!staff) return res.status(401).json({ error: 'Invalid PIN' })

    // ── "login" — just return a token, no shift created ──────────────────────
    if (action === 'login') {
      const existingShift = await prisma.cashierShift.findFirst({
        where: { staffId: staff.id, cafeId, status: 'OPEN' }
      })
      const token = issueStaffToken(staff.id, cafeId, staff.role as StaffRole, existingShift?.id)
      return res.json({
        token,
        staff: { id: staff.id, name: staff.name, role: staff.role },
        shift: existingShift ?? null
      })
    }

    // ── "open" — open a new shift ─────────────────────────────────────────────
    if (action === 'open') {
      try {
        const shift = await openShiftFor(staff.id, cafeId, initialCash ?? 0, plannedEndTime, notes)
        const token = issueStaffToken(staff.id, cafeId, staff.role as StaffRole, shift.id)
        logger.info({ msg: 'POS shift opened', shiftId: shift.id, staffId: staff.id })
        return res.status(201).json({ token, shift })
      } catch (err: any) {
        return res.status(err.status ?? 500).json({ error: err.message, shiftId: err.shiftId })
      }
    }

    // ── "close" — close the current open shift ────────────────────────────────
    if (action === 'close') {
      try {
        const closed = await closeShiftFor(staff.id, cafeId, countedCash)
        logger.info({ msg: 'POS shift closed', shiftId: closed.id, totalCollectedCash: closed.totalCollectedCash, discrepancy: closed.discrepancy })
        return res.json({ shift: closed })
      } catch (err: any) {
        return res.status(err.status ?? 500).json({ error: err.message })
      }
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    logger.error({ msg: 'POST /api/pos/shift error', err })
    return res.status(500).json({ error: 'Shift operation failed' })
  }
})

// ─── GET /api/pos/shift/current — active shift for authenticated staff ────────

router.get('/api/pos/shift/current', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!
    const shift = await prisma.cashierShift.findFirst({
      where: { staffId, cafeId, status: 'OPEN' },
      include: { staff: { select: { id: true, name: true, role: true } } }
    })
    return res.json({ shift: shift ?? null })
  } catch (err) {
    logger.error({ msg: 'GET /api/pos/shift/current error', err })
    return res.status(500).json({ error: 'Failed to fetch shift' })
  }
})

export default router
