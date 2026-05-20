import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import logger from '../logger'
import { JWT_SECRET } from '../config'

export interface POSTokenPayload {
  staffId:  string
  cafeId:   string
  staffRole: string
  shiftId?: string
  iat?: number
  exp?: number
}

declare global {
  namespace Express {
    interface Request {
      staff?: POSTokenPayload
    }
  }
}

/**
 * Validates the staff JWT issued by POST /api/pos/shift (PIN login).
 * Also accepts an admin JWT so managers can use POS features.
 */
export async function authorizePOS(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.header('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'POS token required' })
    }

    const token = auth.split(' ')[1]
    let payload: POSTokenPayload
    try {
      payload = jwt.verify(token, JWT_SECRET) as POSTokenPayload
    } catch {
      return res.status(401).json({ error: 'Invalid or expired POS token' })
    }

    if (!payload.staffId || !payload.cafeId) {
      return res.status(401).json({ error: 'Token missing required POS fields' })
    }

    req.staff = payload
    return next()
  } catch (err) {
    logger.error({ msg: 'authorizePOS error', err })
    return res.status(500).json({ error: 'POS authorization check failed' })
  }
}

export default authorizePOS
