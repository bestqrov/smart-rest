/**
 * POS-scoped customer endpoints — search existing CafeCustomer records or
 * quick-create one, for the mandatory client picker on the Comptoir screen.
 * Requires POS Bearer token (authorizePOS), same as the rest of /api/pos/*.
 */

import express, { Request, Response } from 'express'
import prisma from '../../prisma'
import logger from '../../logger'
import authorizePOS from '../../middleware/authorizePOS'
import requireUnlockedShift from '../../middleware/requireUnlockedShift'
import { searchCustomers } from '../../customers/CustomerService'

const router = express.Router()

// ─── GET /api/pos/customers?search= ────────────────────────────────────────

router.get('/api/pos/customers', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const search = (req.query.search as string) ?? ''
    const result = await searchCustomers(cafeId, { search, limit: 20 })
    return res.json(result)
  } catch (err) {
    logger.error({ msg: 'GET /api/pos/customers error', err })
    return res.status(500).json({ error: 'Failed to search customers' })
  }
})

// ─── POST /api/pos/customers — quick-create a walk-in client ───────────────

router.post('/api/pos/customers', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const { phone, name, customerType, wholesaleDiscountPct } = req.body as {
      phone?: string; name?: string; customerType?: string; wholesaleDiscountPct?: number
    }

    if (!phone) return res.status(400).json({ error: 'phone is required' })

    const normalized = phone.replace(/[\s\-().]/g, '').replace(/^00/, '+')
    if (!/^\+\d{7,15}$/.test(normalized)) {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    const type = customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL'
    const discountPct = type === 'WHOLESALE' && typeof wholesaleDiscountPct === 'number'
      ? Math.min(100, Math.max(0, wholesaleDiscountPct)) : 0

    const customer = await prisma.cafeCustomer.upsert({
      where:  { cafeId_phone: { cafeId, phone: normalized } },
      create: {
        cafeId,
        phone:     normalized,
        name:      name?.trim() || null,
        lastVisit: new Date(),
        visits:    1,
        optIn:     true,
        customerType:         type,
        wholesaleDiscountPct: discountPct,
      },
      update: {
        lastVisit: new Date(),
        visits:    { increment: 1 },
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(customerType !== undefined ? { customerType: type, wholesaleDiscountPct: discountPct } : {}),
      }
    })

    return res.status(201).json({ customer })
  } catch (err) {
    logger.error({ msg: 'POST /api/pos/customers error', err })
    return res.status(500).json({ error: 'Failed to create customer' })
  }
})

// ─── PATCH /api/pos/customers/:id — edit wholesale status/discount ─────────

router.patch('/api/pos/customers/:id', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const id = req.params.id as string

    const existing = await prisma.cafeCustomer.findUnique({ where: { id }, select: { cafeId: true } })
    if (!existing || existing.cafeId !== cafeId) return res.status(404).json({ error: 'Customer not found' })

    const { customerType, wholesaleDiscountPct } = req.body as { customerType?: string; wholesaleDiscountPct?: number }
    const type = customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL'
    const discountPct = type === 'WHOLESALE' && typeof wholesaleDiscountPct === 'number'
      ? Math.min(100, Math.max(0, wholesaleDiscountPct)) : 0

    const customer = await prisma.cafeCustomer.update({
      where: { id },
      data:  { customerType: type, wholesaleDiscountPct: discountPct }
    })
    return res.json({ customer })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/pos/customers/:id error', err })
    return res.status(500).json({ error: 'Failed to update customer' })
  }
})

export default router
