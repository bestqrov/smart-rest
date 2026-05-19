import express, { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { hashPassword, verifyPassword } from '../auth/hash'
import logger from '../logger'
import { JWT_SECRET } from '../config'
import prisma from '../prisma'

const router = express.Router()
const TOKEN_EXPIRY = '8h'

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string }
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ userId: user.id, cafeId: user.cafeId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
    return res.json({ token, userId: user.id, cafeId: user.cafeId })
  } catch (err) {
    logger.error({ msg: 'Login error', err })
    return res.status(500).json({ error: 'Login failed' })
  }
})

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, cafeName, subdomain, businessName, country } = req.body as {
      email: string
      password: string
      cafeName: string
      subdomain: string
      businessName?: string
      country?: string   // ISO-2: MA | SA | AE | FR | US …
    }

    if (!email || !password || !cafeName || !subdomain) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({ error: 'Subdomain must contain only lowercase letters, numbers, and hyphens' })
    }

    const resolvedCountry = (country ?? 'MA').toUpperCase()
    const currencyMap: Record<string, string> = {
      MA: 'MAD', SA: 'SAR', AE: 'AED', US: 'USD', FR: 'EUR', GB: 'GBP', DE: 'EUR'
    }
    const currency = currencyMap[resolvedCountry] ?? 'MAD'

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) return res.status(409).json({ error: 'An account with this email already exists' })

    const existingCafe = await prisma.cafe.findUnique({ where: { subdomain } })
    if (existingCafe) return res.status(409).json({ error: 'This subdomain is already taken' })

    const passwordHash = await hashPassword(password)

    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 days

    const { user, cafe } = await prisma.$transaction(async (tx) => {
      const cafe = await tx.cafe.create({
        data: {
          name: cafeName,
          businessName: businessName || cafeName,
          subdomain,
          country: resolvedCountry,
          currency,
          trialEndsAt,
          billingStatus: 'GRACE_PERIOD',
          isActive: true
        }
      })
      const user = await tx.user.create({
        data: { email, passwordHash, cafeId: cafe.id }
      })
      return { user, cafe }
    })

    const token = jwt.sign({ userId: user.id, cafeId: cafe.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })

    return res.status(201).json({
      token,
      userId: user.id,
      cafeId: cafe.id,
      trialEndsAt,
      country: resolvedCountry,
      currency
    })
  } catch (err) {
    logger.error({ msg: 'Register error', err })
    return res.status(500).json({ error: 'Registration failed' })
  }
})

export default router
