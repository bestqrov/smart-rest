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

// ─── POST /api/pos/shift ──────────────────────────────────────────────────────

router.post('/api/pos/shift', async (req: Request, res: Response) => {
  try {
    const { cafeId: rawCafeId, subdomain, pinCode, action, initialCash, notes } = req.body as {
      cafeId?:      string
      subdomain?:   string   // convenience alias — resolved to cafeId below
      pinCode:      string
      action:       'login' | 'open' | 'close' | 'status'
      initialCash?: number
      notes?:       string
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
      const openShift = await prisma.cashierShift.findFirst({
        where: { staffId: staff.id, cafeId, status: 'OPEN' }
      })
      if (openShift) {
        return res.status(409).json({
          error:  'A shift is already open for this staff member',
          shiftId: openShift.id
        })
      }

      const shift = await prisma.cashierShift.create({
        data: {
          cafeId,
          staffId:            staff.id,
          status:             'OPEN',
          initialCash:        initialCash ?? 0,
          totalCollectedCash: 0,
          notes:              notes ?? null
        }
      })

      const token = issueStaffToken(staff.id, cafeId, staff.role as StaffRole, shift.id)
      logger.info({ msg: 'POS shift opened', shiftId: shift.id, staffId: staff.id })
      return res.status(201).json({ token, shift })
    }

    // ── "close" — close the current open shift ────────────────────────────────
    if (action === 'close') {
      const shift = await prisma.cashierShift.findFirst({
        where: { staffId: staff.id, cafeId, status: 'OPEN' }
      })
      if (!shift) return res.status(404).json({ error: 'No open shift found for this staff member' })

      // Calculate total cash collected: sum of CASH, isPaid orders during this shift
      const cashOrders = await prisma.order.aggregate({
        where: {
          cafeId,
          createdById:   staff.id,
          paymentMethod: 'CASH',
          isPaid:        true,
          createdAt:     { gte: shift.startTime }
        },
        _sum: { totalPrice: true }
      })
      const totalCollectedCash = cashOrders._sum.totalPrice ?? 0

      const closed = await prisma.cashierShift.update({
        where: { id: shift.id },
        data: {
          status:             'CLOSED',
          endTime:            new Date(),
          totalCollectedCash
        }
      })

      logger.info({ msg: 'POS shift closed', shiftId: closed.id, totalCollectedCash })
      return res.json({ shift: closed })
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
