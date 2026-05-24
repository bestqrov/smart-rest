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
    return res.json({ ok: true, status: newStatus })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/kitchen/reservations/:id error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

export default router
