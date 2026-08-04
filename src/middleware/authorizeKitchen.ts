/**
 * authorizeKitchen — accepts either:
 *   1. Admin JWT  (owner/manager logged in via email+password)
 *   2. Staff JWT  with staffRole === 'SUPERVISOR' (PIN login via staff portal)
 *
 * In both cases, req.admin is populated with { userId, cafeId } so kitchen
 * routes work without modification.
 */
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import logger from '../logger'
import { JWT_SECRET } from '../config'
import prisma from '../prisma'
import type { AdminTokenPayload } from './authorizeAdmin'

// The order fetched here for the ownership check is reused by kitchen route
// handlers (via req.kitchenOrder) so they don't re-query the same row.
export interface KitchenOrderContext {
  id:      string
  cafeId:  string
  status:  string
  tableId: string | null
}

declare global {
  namespace Express {
    interface Request {
      kitchenOrder?: KitchenOrderContext
    }
  }
}

export async function authorizeKitchen(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.header('authorization')
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

    const token = auth.split(' ')[1]
    let payload: any
    try {
      payload = jwt.verify(token, JWT_SECRET)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // ── Admin token (has userId, no staffRole) ────────────────────────────────
    if (payload.userId && payload.cafeId) {
      req.admin = { userId: payload.userId, cafeId: payload.cafeId } as AdminTokenPayload

      // Validate orderId ownership if present — select the fields kitchen
      // route handlers need too, so they can reuse req.kitchenOrder instead
      // of re-querying the same order right after this middleware runs.
      if (req.params.orderId) {
        const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId
        const order = await prisma.order.findUnique({
          where:  { id: orderId },
          select: { id: true, cafeId: true, status: true, tableId: true },
        })
        if (!order || order.cafeId !== payload.cafeId) {
          return res.status(403).json({ error: 'Order does not belong to your cafe' })
        }
        req.kitchenOrder = order
      }
      return next()
    }

    // ── Staff / POS token — only SUPERVISOR may access kitchen ────────────────
    if (payload.staffId && payload.cafeId && payload.staffRole === 'SUPERVISOR') {
      req.admin = { userId: payload.staffId, cafeId: payload.cafeId } as AdminTokenPayload

      if (req.params.orderId) {
        const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId
        const order = await prisma.order.findUnique({
          where:  { id: orderId },
          select: { id: true, cafeId: true, status: true, tableId: true },
        })
        if (!order || order.cafeId !== payload.cafeId) {
          return res.status(403).json({ error: 'Order does not belong to your cafe' })
        }
        req.kitchenOrder = order
      }
      return next()
    }

    return res.status(403).json({ error: 'Kitchen access requires admin or supervisor role' })
  } catch (err) {
    logger.error({ msg: 'authorizeKitchen error', err })
    return res.status(500).json({ error: 'Authorization check failed' })
  }
}

export default authorizeKitchen
