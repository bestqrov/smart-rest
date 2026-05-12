import express, { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const router = express.Router()

function toNumber(v: string | undefined): number | null {
  if (!v) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000 // Earth radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Middleware: verifyLocation
 * - Reads `subdomain` from params
 * - Reads `x-user-lat` and `x-user-lng` headers
 * - Checks distance <= 70 meters
 */
async function verifyLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const subdomain = Array.isArray(req.params.subdomain) ? req.params.subdomain[0] : req.params.subdomain
    if (!subdomain) return res.status(400).json({ error: 'Missing subdomain param' })

    const cafe = await prisma.cafe.findUnique({
      where: { subdomain },
      select: { id: true, lat: true, lng: true, name: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    if (cafe.lat == null || cafe.lng == null) {
      return res.status(500).json({ error: 'Cafe coordinates not configured' })
    }

    const userLat = toNumber(req.header('x-user-lat') || undefined)
    const userLng = toNumber(req.header('x-user-lng') || undefined)

    if (userLat == null || userLng == null) {
      // Handle desktop or refused GPS gracefully
      return res.status(400).json({ error: 'GPS access is required to verify you are at the cafe' })
    }

    const distance = haversineDistance(cafe.lat, cafe.lng, userLat, userLng)
    const MAX_DISTANCE_METERS = 70

    if (distance > MAX_DISTANCE_METERS) {
      return res.status(403).json({ error: 'You must be inside the cafe to view the menu' })
    }

    // Attach cafe to request for downstream handlers
    ;(req as any).cafe = cafe
    return next()
  } catch (err) {
    return res.status(500).json({ error: 'Location verification failed' })
  }
}

/**
 * Controller: getMenu
 * - Expects `x-table-token` header or `tableToken` query param
 * - Returns categories with products and includes cafeId and tableId
 */
async function getMenu(req: Request, res: Response) {
  try {
    const cafe = (req as any).cafe
    if (!cafe) {
      return res.status(500).json({ error: 'Cafe not attached to request' })
    }

    const tableToken = (req.header('x-table-token') as string) || (req.query.tableToken as string)
    if (!tableToken) return res.status(400).json({ error: 'Missing table token' })

    const table = await prisma.table.findUnique({ where: { qrToken: tableToken } })
    if (!table || table.cafeId !== cafe.id) {
      return res.status(404).json({ error: 'Table not found for this cafe' })
    }

    const categories = await prisma.category.findMany({
      where: { cafeId: cafe.id },
      orderBy: { order: 'asc' },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: { nameEn: 'asc' }
        }
      }
    })

    return res.json({ cafeId: cafe.id, tableId: table.id, cafe: { id: cafe.id, name: cafe.name }, categories })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch menu' })
  }
}

router.get('/:subdomain/menu', verifyLocation, getMenu)

export default router
