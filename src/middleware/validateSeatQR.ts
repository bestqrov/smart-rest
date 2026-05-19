import { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'

// Shape attached to req by this middleware
export interface SeatSession {
  cafeId:      number
  tableId:     number
  tableNumber: number
  seatId:      number
  seatNumber:  number
  // The resolved billing tableId — may differ when this table is merged
  billingTableId: number
  isMerged:    boolean
  mergedIntoTableNumber?: number
}

declare global {
  namespace Express {
    interface Request {
      seatSession?: SeatSession
    }
  }
}

/**
 * Validates the Hybrid Table QR URL pattern:
 *   /t/:tableNumber/s/:seatNumber?token=:qrToken
 *
 * Resolves the cafe from `subdomain` in req.params (set by the outer router).
 * Attaches `req.seatSession` for downstream route handlers.
 */
export async function validateSeatQR(req: Request, res: Response, next: NextFunction) {
  try {
    const subdomain = req.params.subdomain as string
    const tableNumber = Number(req.params.tableNumber)
    const seatNumber  = Number(req.params.seatNumber)
    const qrToken     = (req.query.token ?? req.header('x-seat-token')) as string | undefined

    if (!subdomain || !Number.isFinite(tableNumber) || !Number.isFinite(seatNumber)) {
      return res.status(400).json({ error: 'Invalid table or seat number' })
    }
    if (!qrToken) {
      return res.status(400).json({ error: 'Missing QR token' })
    }

    // 1. Resolve the cafe
    const cafe = await prisma.cafe.findUnique({
      where: { subdomain },
      select: { id: true, isActive: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })
    if (!cafe.isActive) return res.status(403).json({ error: 'This venue is currently unavailable' })

    // 2. Validate the seat — token must match table + seat + cafe
    const seat = await prisma.seat.findFirst({
      where: {
        qrToken,
        seatNumber,
        cafeId: cafe.id,
        table: { tableNumber, cafeId: cafe.id }
      },
      include: {
        table: {
          select: {
            id: true,
            tableNumber: true,
            isActive: true,
            mergedIntoTableId: true,
            mergedIntoTable: { select: { id: true, tableNumber: true } }
          }
        }
      }
    })

    if (!seat) {
      return res.status(403).json({ error: 'Invalid or expired QR code' })
    }
    if (!seat.table.isActive) {
      return res.status(403).json({ error: 'This table is currently inactive' })
    }

    // 3. Resolve billing table — walk up the merge chain to the master
    const masterTable = seat.table.mergedIntoTable ?? seat.table

    req.seatSession = {
      cafeId:       cafe.id,
      tableId:      seat.table.id,
      tableNumber:  seat.table.tableNumber,
      seatId:       seat.id,
      seatNumber:   seat.seatNumber,
      billingTableId: masterTable.id,
      isMerged:     !!seat.table.mergedIntoTableId,
      mergedIntoTableNumber: seat.table.mergedIntoTable?.tableNumber
    }

    logger.debug({
      msg: 'Seat QR validated',
      cafeId: cafe.id,
      tableNumber,
      seatNumber,
      billingTableId: masterTable.id,
      isMerged: req.seatSession.isMerged
    })

    return next()
  } catch (err) {
    logger.error({ msg: 'validateSeatQR error', err })
    return res.status(500).json({ error: 'QR validation failed' })
  }
}
