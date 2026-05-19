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

    // If body contains cafeId, ensure it matches
    if (req.body?.cafeId && req.body.cafeId !== payload.cafeId) {
      return res.status(403).json({ error: 'Forbidden: cafe mismatch' })
    }

    return next()
  } catch (err) {
    logger.error({ msg: 'authorizeAdmin error', err })
    return res.status(500).json({ error: 'Authorization check failed' })
  }
}

export default authorizeAdmin
