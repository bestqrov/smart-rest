/**
 * Custom Cake Pre-Orders — for pastry shops taking made-to-order cakes
 * (birthday, wedding...) days ahead, with a pickup date and cake specs.
 * Not a multi-guest Event (that's SmartTraiteur) — a single order.
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

const VALID_STATUS = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED']

// ─── GET /api/cake-orders — list, optional ?status= filter ───────────────────

router.get('/api/cake-orders', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const status = req.query.status as string | undefined

    const orders = await prisma.cakeOrder.findMany({
      where:   { cafeId, ...(status && VALID_STATUS.includes(status) ? { status } : {}) },
      orderBy: { pickupDate: 'asc' },
    })
    return res.json(orders)
  } catch (err) {
    logger.error({ msg: 'GET /api/cake-orders error', err })
    return res.status(500).json({ error: 'Failed to fetch cake orders' })
  }
})

// ─── POST /api/cake-orders — create ───────────────────────────────────────────

router.post('/api/cake-orders', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const {
      clientName, clientPhone, description, writingText, referenceImageUrl,
      pickupDate, price, depositPaid, notes,
    } = req.body as {
      clientName:  string
      clientPhone?: string
      description: string
      writingText?: string
      referenceImageUrl?: string
      pickupDate:  string
      price?:      number
      depositPaid?: number
      notes?:      string
    }

    if (!clientName?.trim())   return res.status(400).json({ error: 'clientName is required' })
    if (!description?.trim()) return res.status(400).json({ error: 'description is required' })
    if (!pickupDate)           return res.status(400).json({ error: 'pickupDate is required' })

    const order = await prisma.cakeOrder.create({
      data: {
        cafeId,
        clientName:  clientName.trim(),
        clientPhone: clientPhone ?? '',
        description: description.trim(),
        writingText: writingText ?? '',
        referenceImageUrl: referenceImageUrl || null,
        pickupDate:  new Date(pickupDate),
        price:       price ?? null,
        depositPaid: depositPaid ?? null,
        notes:       notes ?? '',
      }
    })
    return res.status(201).json(order)
  } catch (err) {
    logger.error({ msg: 'POST /api/cake-orders error', err })
    return res.status(500).json({ error: 'Failed to create cake order' })
  }
})

// ─── PATCH /api/cake-orders/:id — edit / change status ────────────────────────

router.patch('/api/cake-orders/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const id = req.params.id as string

    const existing = await prisma.cakeOrder.findUnique({ where: { id }, select: { cafeId: true } })
    if (!existing || existing.cafeId !== cafeId) return res.status(404).json({ error: 'Cake order not found' })

    const {
      clientName, clientPhone, description, writingText, referenceImageUrl,
      pickupDate, status, price, depositPaid, notes,
    } = req.body as {
      clientName?:  string
      clientPhone?: string
      description?: string
      writingText?: string
      referenceImageUrl?: string | null
      pickupDate?:  string
      status?:      string
      price?:       number | null
      depositPaid?: number | null
      notes?:       string
    }

    const order = await prisma.cakeOrder.update({
      where: { id },
      data: {
        ...(clientName        !== undefined ? { clientName: clientName.trim() } : {}),
        ...(clientPhone       !== undefined ? { clientPhone } : {}),
        ...(description       !== undefined ? { description: description.trim() } : {}),
        ...(writingText       !== undefined ? { writingText } : {}),
        ...(referenceImageUrl !== undefined ? { referenceImageUrl } : {}),
        ...(pickupDate        !== undefined ? { pickupDate: new Date(pickupDate) } : {}),
        ...(status            !== undefined && VALID_STATUS.includes(status) ? { status } : {}),
        ...(price             !== undefined ? { price } : {}),
        ...(depositPaid       !== undefined ? { depositPaid } : {}),
        ...(notes             !== undefined ? { notes } : {}),
      }
    })
    return res.json(order)
  } catch (err) {
    logger.error({ msg: 'PATCH /api/cake-orders/:id error', err })
    return res.status(500).json({ error: 'Failed to update cake order' })
  }
})

// ─── DELETE /api/cake-orders/:id ───────────────────────────────────────────────

router.delete('/api/cake-orders/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const id = req.params.id as string

    const existing = await prisma.cakeOrder.findUnique({ where: { id }, select: { cafeId: true } })
    if (!existing || existing.cafeId !== cafeId) return res.status(404).json({ error: 'Cake order not found' })

    await prisma.cakeOrder.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE /api/cake-orders/:id error', err })
    return res.status(500).json({ error: 'Failed to delete cake order' })
  }
})

export default router
