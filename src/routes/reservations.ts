/**
 * Reservations API
 *
 * Public (client via QR):
 *   POST /api/reservations  — submit a new reservation (tableToken identifies the cafe)
 *
 * Kitchen / Admin (JWT required):
 *   GET   /api/kitchen/reservations        — list PENDING reservations for today+future
 *   PATCH /api/kitchen/reservations/:id    — accept or cancel a reservation
 */

import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'
import { publishStandardEvent } from '../core'
import { updateReservation, checkInReservation, markNoShow, hasTableConflict } from '../reservations/ReservationService'

const router = express.Router()

// ─── POST /api/reservations ───────────────────────────────────────────────────
// Client submits reservation from the QR menu page.
// tableToken is required to identify which cafe this reservation belongs to.

router.post('/api/reservations', async (req: Request, res: Response) => {
  try {
    const { tableToken, name, phone, guests, date, notes } = req.body as {
      tableToken?: string
      name?:       string
      phone?:      string
      guests?:     number
      date?:       string
      notes?:      string
    }

    if (!tableToken) return res.status(400).json({ error: 'tableToken required' })
    if (!name?.trim()) return res.status(400).json({ error: 'name required' })
    if (!phone?.trim()) return res.status(400).json({ error: 'phone required' })
    if (!guests || guests < 1 || guests > 50) return res.status(400).json({ error: 'guests must be 1–50' })
    if (!date) return res.status(400).json({ error: 'date required' })

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime()) || parsedDate < new Date()) {
      return res.status(400).json({ error: 'date must be a valid future datetime' })
    }

    // Resolve cafeId from tableToken
    const table = await prisma.table.findFirst({
      where:  { qrToken: tableToken, isActive: true },
      select: { cafeId: true }
    })
    if (!table) return res.status(404).json({ error: 'Invalid or expired table token' })

    const reservation = await prisma.reservation.create({
      data: {
        cafeId: table.cafeId,
        name:   name.trim(),
        phone:  phone.trim(),
        guests: Number(guests),
        date:   parsedDate,
        notes:  notes?.trim() ?? '',
        status: 'PENDING',
      }
    })

    // Notify kitchen in real-time
    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`kds_room_${table.cafeId}`).emit('reservation_new', {
        id:        reservation.id,
        name:      reservation.name,
        phone:     reservation.phone,
        guests:    reservation.guests,
        date:      reservation.date.toISOString(),
        notes:     reservation.notes,
        status:    reservation.status,
        createdAt: reservation.createdAt.toISOString(),
      })
    }

    logger.info({ msg: 'New reservation', cafeId: table.cafeId, reservationId: reservation.id })
    publishStandardEvent('ReservationCreated', {
      tenantId: table.cafeId, resourceId: reservation.id, metadata: { guests: reservation.guests, date: reservation.date },
    }, 'reservations')
    return res.status(201).json({ ok: true, reservationId: reservation.id })
  } catch (err) {
    logger.error({ msg: 'POST /api/reservations error', err })
    return res.status(500).json({ error: 'Failed to create reservation' })
  }
})

// ─── GET /api/kitchen/reservations ───────────────────────────────────────────
// Returns PENDING reservations from now onward (today + future).

router.get('/api/kitchen/reservations', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const reservations = await prisma.reservation.findMany({
      where: {
        cafeId,
        status: 'PENDING',
        date:   { gte: new Date(Date.now() - 60 * 60 * 1000) } // include up to 1h past
      },
      orderBy: { date: 'asc' }
    })

    return res.json(reservations)
  } catch (err) {
    logger.error({ msg: 'GET /api/kitchen/reservations error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PATCH /api/kitchen/reservations/:id ─────────────────────────────────────
// Body: { action: 'accept' | 'cancel' }

router.patch('/api/kitchen/reservations/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id     = req.params['id'] as string
    const { action } = req.body as { action?: string }

    if (action !== 'accept' && action !== 'cancel') {
      return res.status(400).json({ error: 'action must be "accept" or "cancel"' })
    }

    const reservation = await prisma.reservation.findUnique({
      where:  { id },
      select: { id: true, cafeId: true, status: true }
    })
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' })
    if (reservation.cafeId !== cafeId) return res.status(403).json({ error: 'Forbidden' })
    if (reservation.status !== 'PENDING') {
      return res.status(422).json({ error: `Already ${reservation.status.toLowerCase()}` })
    }

    const newStatus = action === 'accept' ? 'ACCEPTED' : 'CANCELLED'

    const updated = await prisma.reservation.update({
      where: { id },
      data:  { status: newStatus }
    })

    // Broadcast update to kitchen room
    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`kds_room_${cafeId}`).emit('reservation_updated', { id, status: newStatus })
    }

    logger.info({ msg: 'Reservation updated', cafeId, id, status: newStatus })
    publishStandardEvent(newStatus === 'ACCEPTED' ? 'ReservationConfirmed' : 'ReservationCancelled', {
      tenantId: cafeId, resourceId: id, metadata: {},
    }, 'reservations')
    return res.json({ ok: true, status: newStatus })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/kitchen/reservations/:id error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/admin/reservations ─────────────────────────────────────────────
// Full admin listing — all statuses, with filters and pagination.
// Query params: status, dateFrom, dateTo, search (name/phone), page, limit

router.get('/api/admin/reservations', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { status, dateFrom, dateTo, search, page = '1', limit = '20' } = req.query as Record<string, string>

    const pageNum  = Math.max(1, parseInt(page)  || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const skip     = (pageNum - 1) * limitNum

    const s = search?.trim()

    const where = {
      cafeId,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(dateFrom || dateTo ? {
        date: {
          ...(dateFrom ? { gte: new Date(dateFrom) }                                                      : {}),
          ...(dateTo   ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
        },
      } : {}),
      ...(s ? {
        OR: [
          { name:  { contains: s, mode: 'insensitive' as const } },
          { phone: { contains: s } },
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.reservation.count({ where }),
    ])

    return res.json({ items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/reservations error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/admin/reservations/counts ──────────────────────────────────────
// Summary counts per status (for stats row and calendar dots).

router.get('/api/admin/reservations/counts', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    // groupBy is not supported on MongoDB — use 4 parallel count queries instead
    const [pending, accepted, completed, cancelled] = await Promise.all([
      prisma.reservation.count({ where: { cafeId, status: 'PENDING'   } }),
      prisma.reservation.count({ where: { cafeId, status: 'ACCEPTED'  } }),
      prisma.reservation.count({ where: { cafeId, status: 'COMPLETED' } }),
      prisma.reservation.count({ where: { cafeId, status: 'CANCELLED' } }),
    ])
    return res.json({ PENDING: pending, ACCEPTED: accepted, COMPLETED: completed, CANCELLED: cancelled })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/reservations/counts error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PATCH /api/admin/reservations/:id ───────────────────────────────────────
// Extended admin patch: action = accept | cancel | complete, optional tableNumber.

router.patch('/api/admin/reservations/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id     = req.params['id'] as string
    const { action, tableNumber } = req.body as { action?: string; tableNumber?: number }

    // check-in / no-show are new K15 transitions — delegate to ReservationService
    // (validation, update, and event emission all happen there).
    if (action === 'check-in' || action === 'no-show') {
      const updated = action === 'check-in'
        ? await checkInReservation(id, cafeId)
        : await markNoShow(id, cafeId)
      const io = req.app.get('io') as import('socket.io').Server | undefined
      if (io) io.to(`kds_room_${cafeId}`).emit('reservation_updated', { id, status: updated.status })
      return res.json({ ok: true, status: updated.status })
    }

    if (action !== 'accept' && action !== 'cancel' && action !== 'complete') {
      return res.status(400).json({ error: 'action must be "accept", "cancel", "complete", "check-in", or "no-show"' })
    }

    const reservation = await prisma.reservation.findUnique({
      where:  { id },
      select: { id: true, cafeId: true, status: true },
    })
    if (!reservation)                       return res.status(404).json({ error: 'Reservation not found' })
    if (reservation.cafeId !== cafeId)      return res.status(403).json({ error: 'Forbidden' })

    // Validate allowed transitions
    const validFrom: Record<string, string[]> = {
      accept:   ['PENDING'],
      cancel:   ['PENDING', 'ACCEPTED'],
      complete: ['ACCEPTED', 'PENDING'],
    }
    if (!validFrom[action]!.includes(reservation.status)) {
      return res.status(422).json({ error: `Cannot ${action} a reservation with status ${reservation.status}` })
    }

    // Prevent booking conflicts when a table is assigned on acceptance.
    if (action === 'accept' && tableNumber != null) {
      const full = await prisma.reservation.findUnique({ where: { id }, select: { date: true } })
      if (full && await hasTableConflict(cafeId, Number(tableNumber), full.date, id)) {
        return res.status(409).json({ error: `Table ${tableNumber} is already booked around that time` })
      }
    }

    const statusMap: Record<string, string> = { accept: 'ACCEPTED', cancel: 'CANCELLED', complete: 'COMPLETED' }
    const newStatus = statusMap[action]!

    const data: { status: string; tableNumber?: number } = { status: newStatus }
    if (tableNumber != null) data.tableNumber = Number(tableNumber)

    await prisma.reservation.update({ where: { id }, data })

    const io = req.app.get('io') as import('socket.io').Server | undefined
    if (io) io.to(`kds_room_${cafeId}`).emit('reservation_updated', { id, status: newStatus })

    logger.info({ msg: 'Admin reservation update', cafeId, id, status: newStatus })
    if (action === 'accept' || action === 'cancel') {
      publishStandardEvent(action === 'accept' ? 'ReservationConfirmed' : 'ReservationCancelled', {
        tenantId: cafeId, resourceId: id, metadata: { tableNumber },
      }, 'reservations')
    }
    return res.json({ ok: true, status: newStatus })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/admin/reservations/:id error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PUT /api/admin/reservations/:id ─────────────────────────────────────────
// Edit reservation details (name/phone/guests/date/notes/tableNumber).
// Separate from the action-based PATCH above, which only handles status
// transitions. New in K15 — reservations had no way to be edited before.

router.put('/api/admin/reservations/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id     = req.params['id'] as string
    const { name, phone, guests, date, notes, tableNumber } = req.body as {
      name?: string; phone?: string; guests?: number; date?: string; notes?: string; tableNumber?: number
    }

    const updated = await updateReservation(id, cafeId, {
      name, phone,
      guests: guests != null ? Number(guests) : undefined,
      date:   date ? new Date(date) : undefined,
      notes,
      tableNumber: tableNumber != null ? Number(tableNumber) : undefined,
    })

    const io = req.app.get('io') as import('socket.io').Server | undefined
    if (io) io.to(`kds_room_${cafeId}`).emit('reservation_updated', { id, status: updated.status })

    logger.info({ msg: 'Admin reservation edited', cafeId, id })
    return res.json({ ok: true, reservation: updated })
  } catch (err: any) {
    logger.error({ msg: 'PUT /api/admin/reservations/:id error', err })
    return res.status(400).json({ error: err.message ?? 'Failed' })
  }
})

export default router
