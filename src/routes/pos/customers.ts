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
    const { phone, name } = req.body as { phone?: string; name?: string }

    if (!phone) return res.status(400).json({ error: 'phone is required' })

    const normalized = phone.replace(/[\s\-().]/g, '').replace(/^00/, '+')
    if (!/^\+\d{7,15}$/.test(normalized)) {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    const customer = await prisma.cafeCustomer.upsert({
      where:  { cafeId_phone: { cafeId, phone: normalized } },
      create: {
        cafeId,
        phone:     normalized,
        name:      name?.trim() || null,
        lastVisit: new Date(),
        visits:    1,
        optIn:     true,
      },
      update: {
        lastVisit: new Date(),
        visits:    { increment: 1 },
        ...(name?.trim() ? { name: name.trim() } : {}),
      }
    })

    return res.status(201).json({ customer })
  } catch (err) {
    logger.error({ msg: 'POST /api/pos/customers error', err })
    return res.status(500).json({ error: 'Failed to create customer' })
  }
})

export default router
