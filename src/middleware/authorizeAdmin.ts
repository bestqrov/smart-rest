import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import logger from '../logger'
import { JWT_SECRET } from '../config'
import prisma from '../prisma'

export interface AdminTokenPayload {
  userId: string
  cafeId: string
  iat?: number
  exp?: number
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload
    }
  }
}

// Bearer-token verification only (no cafeId/orderId cross-checks). Used by
// routers whose handlers resolve auth inline instead of via the middleware,
// so the token rule itself lives in one place.
export function verifyAdminToken(req: Request): AdminTokenPayload | null {
  const auth = req.header('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  try {
    return jwt.verify(auth.split(' ')[1], JWT_SECRET) as AdminTokenPayload
  } catch {
    return null
  }
}

const SUSPENSION_ALLOW = ['/api/admin/subscription-invoices', '/api/admin/plan-access', '/api/admin/cafe/profile']
const suspendedCache = new Map<string, { v: boolean; at: number }>()
async function isSuspended(cafeId: string): Promise<boolean> {
  const hit = suspendedCache.get(cafeId)
  if (hit && Date.now() - hit.at < 30_000) return hit.v
  const c = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { subscriptionSuspended: true } })
  const v = !!c?.subscriptionSuspended
  suspendedCache.set(cafeId, { v, at: Date.now() })
  return v
}

export async function authorizeAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.header('authorization')
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

    const token = auth.split(' ')[1]
    let payload: AdminTokenPayload
    try {
      payload = jwt.verify(token, JWT_SECRET) as AdminTokenPayload
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.admin = payload

    // Unpaid subscription (14 days overdue): lock the restaurant dashboard API.
    // Guest menu + staff screens use other auth and keep working; billing and
    // plan endpoints stay open so the owner can see and pay the invoice.
    if (!SUSPENSION_ALLOW.some(p => req.path.startsWith(p)) && await isSuspended(payload.cafeId)) {
      return res.status(402).json({ error: 'Subscription suspended — please pay your invoice', code: 'SUBSCRIPTION_SUSPENDED' })
    }

    // If route contains cafeId param, ensure it matches
    if (req.params.cafeId && req.params.cafeId !== payload.cafeId) {
      return res.status(403).json({ error: 'Forbidden: cafe mismatch' })
    }

    // If route contains orderId param, ensure that order belongs to admin cafe
    if (req.params.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId as string },
        select: { cafeId: true }
      })
      if (!order || order.cafeId !== payload.cafeId) {
        return res.status(403).json({ error: 'Forbidden: order does not belong to your cafe' })
      }
    }

    // If body or query contains cafeId, ensure it matches
    if (req.body?.cafeId && req.body.cafeId !== payload.cafeId) {
      return res.status(403).json({ error: 'Forbidden: cafe mismatch' })
    }
    if (req.query?.cafeId && req.query.cafeId !== payload.cafeId) {
      return res.status(403).json({ error: 'Forbidden: cafe mismatch' })
    }

    return next()
  } catch (err) {
    logger.error({ msg: 'authorizeAdmin error', err })
    return res.status(500).json({ error: 'Authorization check failed' })
  }
}

export default authorizeAdmin
