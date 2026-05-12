import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Calculate Haversine distance between two lat/lng points in meters.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Express middleware to verify the user is within 50 meters of the cafe.
 * Expects `subdomain` in `req.params` and `x-user-lat` / `x-user-lng` headers.
 */
export default async function verifyLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const subdomain = req.params.subdomain
    if (!subdomain) {
      return res.status(400).json({ error: 'Missing subdomain param' })
    }

    const cafe = await prisma.cafe.findUnique({
      where: { subdomain },
      select: { lat: true, lng: true }
    })

    if (!cafe) {
      return res.status(404).json({ error: 'Cafe not found' })
    }

    if (cafe.lat == null || cafe.lng == null) {
      return res.status(500).json({ error: 'Cafe coordinates not configured' })
    }

    const userLatHeader = req.header('x-user-lat')
    const userLngHeader = req.header('x-user-lng')

    if (!userLatHeader || !userLngHeader) {
      return res.status(400).json({ error: 'Missing user coordinates in headers' })
    }

    const userLat = parseFloat(userLatHeader)
    const userLng = parseFloat(userLngHeader)

    if (!isFinite(userLat) || !isFinite(userLng)) {
      return res.status(400).json({ error: 'Invalid user coordinates' })
    }

    const distanceMeters = haversineDistance(cafe.lat, cafe.lng, userLat, userLng)

    if (distanceMeters > 50) {
      return res.status(403).json({ error: 'You must be inside the cafe to view the menu' })
    }

    return next()
  } catch (err) {
    return res.status(500).json({ error: 'Location verification failed' })
  }
}
