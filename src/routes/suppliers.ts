/**
 * Premium B2B Supplier Finder
 *
 * Restricted to restaurants where smartWifiEnabled === true.
 * Monthly quota: max 3 searches per calendar month.
 * Uses Google Places API (New) Text Search → falls back to DuckDuckGo HTML scrape.
 */

import express, { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import prisma from '../prisma'
import logger from '../logger'
import { JWT_SECRET } from '../config'

const router = express.Router()

// ─── Auth helpers ─────────────────────────────────────────────────────────────

interface AdminPayload {
  userId: string
  cafeId: string
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' })
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AdminPayload
    ;(req as any).adminPayload = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHLY_QUOTA = 3

// Keywords that must appear in a valid supplier query
const SUPPLIER_KEYWORDS = ['supplier', 'grossiste', 'distributeur', 'fournisseur', 'wholesaler', 'wholesale']

// Block competitor restaurant keywords to prevent misuse
const BLOCKED_KEYWORDS = [
  'restaurant', 'cafe', 'coffee', 'pizzeria', 'burger', 'sushi',
  'brasserie', 'bistro', 'pizz', 'mcdo', 'kfc', 'takeaway', 'delivery'
]

function isSafeQuery(query: string): boolean {
  const lower = query.toLowerCase()
  if (BLOCKED_KEYWORDS.some(kw => lower.includes(kw))) return false
  return SUPPLIER_KEYWORDS.some(kw => lower.includes(kw))
}

// ─── Quota helpers ────────────────────────────────────────────────────────────

function isNewMonth(lastReset: Date | null): boolean {
  if (!lastReset) return true
  const now = new Date()
  return now.getFullYear() !== lastReset.getFullYear() ||
    now.getMonth() !== lastReset.getMonth()
}

async function checkAndIncrementQuota(cafeId: string): Promise<{ allowed: boolean; remaining: number }> {
  const cafe = await prisma.cafe.findUnique({
    where:  { id: cafeId },
    select: { supplierSearchesUsed: true, lastCreditReset: true }
  })
  if (!cafe) return { allowed: false, remaining: 0 }

  let used = cafe.supplierSearchesUsed ?? 0

  if (isNewMonth(cafe.lastCreditReset)) {
    used = 0
    await prisma.cafe.update({
      where: { id: cafeId },
      data:  { supplierSearchesUsed: 0, lastCreditReset: new Date() }
    })
  }

  if (used >= MONTHLY_QUOTA) {
    return { allowed: false, remaining: 0 }
  }

  await prisma.cafe.update({
    where: { id: cafeId },
    data:  { supplierSearchesUsed: { increment: 1 } }
  })

  return { allowed: true, remaining: MONTHLY_QUOTA - used - 1 }
}

// ─── Google Places API (New) ──────────────────────────────────────────────────

interface PlaceResult {
  name: string
  address: string
  phone: string
  rating: number
  website: string
}

async function searchGooglePlaces(query: string, city: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return []

  const textQuery = `${query} ${city}`
  const url = 'https://places.googleapis.com/v1/places:searchText'

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.websiteUri'
      },
      body: JSON.stringify({ textQuery, maxResultCount: 10 })
    })

    if (!resp.ok) return []
    const data = await resp.json() as { places?: any[] }
    const places = data.places ?? []

    return places.map((p: any) => ({
      name:    p.displayName?.text ?? '',
      address: p.formattedAddress  ?? '',
      phone:   p.nationalPhoneNumber ?? '',
      rating:  p.rating ?? 0,
      website: p.websiteUri ?? ''
    })).filter(p => p.name)
  } catch (err) {
    logger.warn({ msg: 'Google Places supplier search failed', err })
    return []
  }
}

// ─── DuckDuckGo HTML fallback ─────────────────────────────────────────────────

async function searchDDGFallback(query: string, city: string): Promise<PlaceResult[]> {
  try {
    const q = encodeURIComponent(`${query} ${city} contact phone`)
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartRestoBot/1.0)' }
    })
    if (!resp.ok) return []

    const html = await resp.text()
    const snippets = [...html.matchAll(/<a[^>]+class="result__snippet"[^>]*>([^<]{10,200})<\/a>/g)]
      .map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim())
      .slice(0, 5)

    return snippets.map(s => ({
      name:    s.substring(0, 80),
      address: city,
      phone:   '',
      rating:  0,
      website: ''
    }))
  } catch {
    return []
  }
}

// ─── POST /api/restaurant/suppliers/search ───────────────────────────────────

router.post('/api/restaurant/suppliers/search', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = (req as any).adminPayload as AdminPayload
    const { query, city } = req.body as { query?: string; city?: string }

    if (!query || !city) {
      return res.status(400).json({ error: 'query and city are required' })
    }

    // Safety check first — fail fast before any DB lookup
    if (!isSafeQuery(query)) {
      return res.status(400).json({
        error: 'Query must contain a supplier keyword (supplier, grossiste, distributeur…) and must not target competitor restaurants.'
      })
    }

    // Premium gate
    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { smartWifiEnabled: true, supplierSearchesUsed: true, lastCreditReset: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    if (!cafe.smartWifiEnabled) {
      return res.status(403).json({
        error: 'Supplier finder is a premium feature. Enable Smart WiFi or upgrade your plan.'
      })
    }

    // Quota check
    const quota = await checkAndIncrementQuota(cafeId)
    if (!quota.allowed) {
      return res.status(429).json({
        error: `Monthly supplier search quota exhausted (${MONTHLY_QUOTA}/month). Resets next month.`,
        remaining: 0
      })
    }

    // Search
    let results = await searchGooglePlaces(query, city)
    if (results.length === 0) {
      results = await searchDDGFallback(query, city)
    }

    logger.info({ msg: 'Supplier search', cafeId, query, city, resultsCount: results.length, remaining: quota.remaining })

    return res.json({
      results,
      quota: { used: MONTHLY_QUOTA - quota.remaining, total: MONTHLY_QUOTA, remaining: quota.remaining }
    })
  } catch (err) {
    logger.error({ msg: 'supplier search error', err })
    return res.status(500).json({ error: 'Search failed' })
  }
})

// ─── GET /api/restaurant/suppliers/quota ─────────────────────────────────────

router.get('/api/restaurant/suppliers/quota', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = (req as any).adminPayload as AdminPayload
    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { smartWifiEnabled: true, supplierSearchesUsed: true, lastCreditReset: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Not found' })

    let used = cafe.supplierSearchesUsed ?? 0
    if (isNewMonth(cafe.lastCreditReset)) used = 0

    return res.json({
      premium:   cafe.smartWifiEnabled,
      used,
      total:     MONTHLY_QUOTA,
      remaining: Math.max(0, MONTHLY_QUOTA - used),
      resetsAt:  cafe.lastCreditReset
        ? new Date(new Date(cafe.lastCreditReset).getFullYear(), new Date(cafe.lastCreditReset).getMonth() + 1, 1)
        : null
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

export default router
