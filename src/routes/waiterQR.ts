/**
 * Waiter QR-Based Authentication & Mobile API
 *
 * GET  /api/admin/waiter-qr-token          — Admin generates a 2-min QR token
 * POST /api/waiters/qr-login               — Waiter scans QR + enters PIN → JWT
 * GET  /api/waiters/me                     — Waiter profile + assigned tables
 * GET  /api/waiters/active-notifications   — Active waiter calls for this cafe
 * GET  /api/waiters/today-stats            — Today's closed orders + revenue
 *
 * Multi-tenancy: cafeId is always sourced from the verified JWT, never from the request body.
 */

import express, { Request, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { authorizePOS } from '../middleware/authorizePOS'
import prisma from '../prisma'
import logger from '../logger'
import { JWT_SECRET } from '../config'
import type { StaffRole } from '../types/staff'

const router = express.Router()

const QR_TOKEN_TTL_MS  = 2 * 60 * 1000   // 2 minutes
const WAITER_JWT_EXPIRY = '10h'

// ─── GET /api/admin/waiter-qr-token ──────────────────────────────────────────
//
// Generates a cryptographically secure single-use token valid for 2 minutes.
// Admin screen polls this every ~90 s to show a fresh QR.

router.get('/api/admin/waiter-qr-token', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    // Purge stale (expired or used) tokens for this cafe to keep the collection clean
    await prisma.waiterQRToken.deleteMany({
      where: {
        cafeId,
        OR: [{ expiresAt: { lte: new Date() } }, { usedAt: { not: null } }],
      },
    })

    const rawToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + QR_TOKEN_TTL_MS)

    await prisma.waiterQRToken.create({
      data: { cafeId, token: rawToken, expiresAt },
    })

    logger.info({ msg: 'waiter QR token generated', cafeId })
    return res.json({ token: rawToken, expiresAt: expiresAt.toISOString(), ttlSeconds: 120 })
  } catch (err) {
    logger.error({ msg: 'waiter-qr-token error', err })
    return res.status(500).json({ error: 'Failed to generate QR token' })
  }
})

// ─── POST /api/waiters/qr-login ───────────────────────────────────────────────
//
// Called when the waiter submits their PIN on the /w/login page.
// Body: { token: string, pinCode: string }

// ─── GET /api/public/qr-token-info ───────────────────────────────────────────
// Returns whether a QR token belongs to the demo cafe (for bypassing PIN in demo)

router.get('/api/public/qr-token-info', async (req: Request, res: Response) => {
  try {
    const token = (req.query.token as string ?? '').trim()
    if (!token) return res.status(400).json({ error: 'token required' })

    const qrRecord = await prisma.waiterQRToken.findUnique({
      where: { token },
      select: { cafeId: true, expiresAt: true, usedAt: true },
    })
    if (!qrRecord || qrRecord.usedAt || qrRecord.expiresAt < new Date()) {
      return res.json({ isDemo: false, valid: false })
    }

    const DEMO_SUB = (process.env.DEMO_SUBDOMAIN ?? 'welcome').toLowerCase()
    const cafe = await prisma.cafe.findUnique({
      where: { id: qrRecord.cafeId },
      select: { subdomain: true },
    })
    const isDemo = cafe?.subdomain?.toLowerCase() === DEMO_SUB

    if (isDemo) {
      const staff = await prisma.staff.findMany({
        where: { cafeId: qrRecord.cafeId, isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { createdAt: 'asc' },
      })
      return res.json({ isDemo: true, valid: true, staff })
    }

    return res.json({ isDemo: false, valid: true })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.post('/api/waiters/qr-login', async (req: Request, res: Response) => {
  try {
    const { token, pinCode, demoStaffId } = req.body as { token?: string; pinCode?: string; demoStaffId?: string }

    if (!token) return res.status(400).json({ error: 'token is required' })

    // ── Validate QR token ─────────────────────────────────────────────────────
    const qrRecord = await prisma.waiterQRToken.findUnique({
      where: { token },
      select: { id: true, cafeId: true, expiresAt: true, usedAt: true },
    })

    if (!qrRecord) {
      return res.status(401).json({ error: 'Invalid QR token' })
    }
    if (qrRecord.usedAt) {
      return res.status(401).json({ error: 'QR token already used — ask the manager to generate a new one' })
    }
    if (qrRecord.expiresAt < new Date()) {
      return res.status(401).json({ error: 'QR token has expired — ask the manager to generate a new one' })
    }

    const { cafeId } = qrRecord

    // ── Demo bypass: skip PIN if demo cafe + demoStaffId provided ─────────────
    const DEMO_SUB = (process.env.DEMO_SUBDOMAIN ?? 'welcome').toLowerCase()
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { subdomain: true } })
    if (cafe?.subdomain?.toLowerCase() === DEMO_SUB && demoStaffId) {
      const demoStaff = await prisma.staff.findFirst({
        where: { id: demoStaffId, cafeId, isActive: true },
        select: { id: true, name: true, role: true, shiftStatus: true },
      })
      if (demoStaff) {
        const now = new Date()
        if ((demoStaff.role === 'WAITER' || demoStaff.role === 'SUPERVISOR') && demoStaff.shiftStatus !== 'ACTIVE') {
          await prisma.$transaction([
            prisma.staff.update({ where: { id: demoStaff.id }, data: { shiftStatus: 'ACTIVE', clockInTime: now } }),
            prisma.waiterShift.create({ data: { cafeId, staffId: demoStaff.id, clockIn: now } }),
          ])
        }
        await prisma.waiterQRToken.update({ where: { id: qrRecord.id }, data: { usedAt: now } })
        const waiterToken = jwt.sign(
          { staffId: demoStaff.id, cafeId, staffRole: demoStaff.role as StaffRole },
          JWT_SECRET,
          { expiresIn: WAITER_JWT_EXPIRY },
        )
        return res.json({ token: waiterToken, staff: { id: demoStaff.id, name: demoStaff.name, role: demoStaff.role }, cafeId })
      }
    }

    if (!pinCode || !/^\d{4}$/.test(pinCode)) {
      return res.status(400).json({ error: 'pinCode must be exactly 4 digits' })
    }

    // ── Match PIN against active staff in this cafe ───────────────────────────
    const allStaff = await prisma.staff.findMany({
      where: { cafeId, isActive: true },
      select: { id: true, name: true, role: true, pinCode: true, shiftStatus: true },
    })

    let matched: { id: string; name: string; role: string } | null = null
    for (const s of allStaff) {
      if (await bcrypt.compare(pinCode, s.pinCode)) {
        matched = s
        break
      }
    }

    if (!matched) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    // ── Mark QR token as used (single-use) ───────────────────────────────────
    await prisma.waiterQRToken.update({
      where: { id: qrRecord.id },
      data:  { usedAt: new Date() },
    })

    // ── Clock-in: update shiftStatus + create WaiterShift ────────────────────
    const now = new Date()
    if (matched.role === 'WAITER' || matched.role === 'SUPERVISOR') {
      // Only clock in if not already active to avoid double-shift records
      const staff = allStaff.find(s => s.id === matched!.id)!
      if (staff.shiftStatus !== 'ACTIVE') {
        await prisma.$transaction([
          prisma.staff.update({
            where: { id: matched.id },
            data:  { shiftStatus: 'ACTIVE', clockInTime: now },
          }),
          prisma.waiterShift.create({
            data: { cafeId, staffId: matched.id, clockIn: now },
          }),
        ])
      }
    }

    // ── Issue waiter JWT (same format as POS JWT — authorizePOS accepts it) ───
    const waiterToken = jwt.sign(
      { staffId: matched.id, cafeId, staffRole: matched.role as StaffRole },
      JWT_SECRET,
      { expiresIn: WAITER_JWT_EXPIRY },
    )

    logger.info({ msg: 'waiter QR login success', staffId: matched.id, cafeId })
    return res.json({
      token: waiterToken,
      staff: { id: matched.id, name: matched.name, role: matched.role },
      cafeId,
    })
  } catch (err) {
    logger.error({ msg: 'qr-login error', err })
    return res.status(500).json({ error: 'Login failed' })
  }
})

// ─── GET /api/waiters/me ──────────────────────────────────────────────────────

router.get('/api/waiters/me', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true, name: true, role: true, shiftStatus: true, clockInTime: true,
        assignedTables: {
          select: { id: true, tableNumber: true, zone: true },
        },
      },
    })

    if (!staff || (await prisma.staff.findUnique({ where: { id: staffId }, select: { cafeId: true } }))?.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Staff not found' })
    }

    // Derive primary zone from first assigned table
    const zone = staff.assignedTables[0]?.zone ?? null

    return res.json({ ...staff, zone })
  } catch (err) {
    logger.error({ msg: 'GET /waiters/me error', err })
    return res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// ─── GET /api/waiters/active-notifications ────────────────────────────────────
//
// Returns all orders with active waiterNotification for this cafe.
// The frontend filters by zone / assignedWaiterId.

router.get('/api/waiters/active-notifications', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!

    const orders = await prisma.order.findMany({
      where: {
        cafeId,
        billStatus: { in: ['OPENED', 'BILL_REQUESTED'] },
        status:     { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      select: {
        id: true,
        createdAt: true,
        totalPrice: true,
        waiterNotification: true,
        assignedWaiterId: true,
        table: {
          select: {
            id: true, tableNumber: true, zone: true,
            assignedWaiterId: true,
            assignedWaiter: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter to only orders with an active notification
    const active = orders.filter(o => o.waiterNotification?.isActive === true)

    return res.json({ notifications: active })
  } catch (err) {
    logger.error({ msg: 'GET active-notifications error', err })
    return res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// ─── GET /api/waiters/today-stats ─────────────────────────────────────────────

router.get('/api/waiters/today-stats', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const result = await prisma.order.aggregate({
      where: {
        cafeId,
        assignedWaiterId: staffId,
        billStatus: { in: ['CLOSED_PRINTED', 'CLOSED_VIRTUAL'] },
        createdAt:  { gte: startOfDay },
      },
      _count: { id: true },
      _sum:   { totalPrice: true },
    })

    return res.json({
      closedOrders:  result._count.id,
      totalRevenue:  parseFloat((result._sum.totalPrice ?? 0).toFixed(2)),
    })
  } catch (err) {
    logger.error({ msg: 'GET today-stats error', err })
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
