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

    const user = await prisma.user.findUnique({
      where: { email },
      include: { cafe: { select: { subdomain: true } } }
    })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const subdomain = user.cafe?.subdomain ?? ''
    const token = jwt.sign({ userId: user.id, cafeId: user.cafeId, subdomain }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
    return res.json({ token, userId: user.id, cafeId: user.cafeId, subdomain })
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

    // Seed demo menu in background — gives new accounts a working menu on first QR scan
    seedDemoMenu(cafe.id).catch((e) => logger.warn({ msg: 'Demo menu seed failed', cafeId: cafe.id, err: e.message }))

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

// ─── POST /api/auth/quick-register — WhatsApp 1-click onboarding ─────────────

router.post('/api/auth/quick-register', async (req: Request, res: Response) => {
  try {
    const { phone, country } = req.body as { phone: string; country?: string }
    if (!phone) return res.status(400).json({ error: 'Phone number is required' })

    // Normalise phone: strip spaces, dashes, ensure starts with +
    const normalised = phone.replace(/[\s\-().]/g, '').replace(/^00/, '+')
    if (!/^\+?[0-9]{7,15}$/.test(normalised)) {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    const resolvedCountry = (country ?? 'MA').toUpperCase()
    const currencyMap: Record<string, string> = {
      MA: 'MAD', SA: 'SAR', AE: 'AED', US: 'USD', FR: 'EUR', GB: 'GBP'
    }
    const currency = currencyMap[resolvedCountry] ?? 'MAD'

    // Derive a stable subdomain from the phone digits
    const digits   = normalised.replace(/\D/g, '').slice(-8)
    let subdomain = `resto-${digits}`

    // Ensure uniqueness
    const exists = await prisma.cafe.findUnique({ where: { subdomain } })
    if (exists) subdomain = `${subdomain}-${Date.now().toString(36)}`

    const now        = new Date()
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Temporary password hash — user never uses it (logs in via magic link)
    const { hashPassword } = await import('../auth/hash')
    const tempPass = await hashPassword(Math.random().toString(36) + Date.now())

    const { user, cafe } = await prisma.$transaction(async (tx) => {
      const cafe = await tx.cafe.create({
        data: {
          name: `مطعم ${digits}`,
          businessName: '',
          subdomain,
          country: resolvedCountry,
          currency,
          trialEndsAt,
          billingStatus: 'GRACE_PERIOD',
          isActive: true
        }
      })
      // Use phone as email placeholder so the unique constraint is met
      const email = `${normalised.replace('+', '')}@whatsapp.smartmenu.ma`
      const user = await tx.user.create({
        data: { email, passwordHash: tempPass, cafeId: cafe.id }
      })
      return { user, cafe }
    })

    // Issue a short-lived magic link token (15 min)
    const magicToken = jwt.sign({ userId: user.id, cafeId: cafe.id, magic: true }, JWT_SECRET, { expiresIn: '15m' })
    const magicLink  = `${process.env.FRONTEND_URL || 'https://smartrestau.digima.cloud'}/admin/magic?token=${magicToken}`

    // ── n8n webhook — send WhatsApp magic link ───────────────────────────────
    const n8nWebhook = process.env.N8N_WHATSAPP_WEBHOOK
    if (n8nWebhook) {
      fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalised, magicLink, cafeId: cafe.id, subdomain, country: resolvedCountry })
      }).catch((e) => logger.warn({ msg: 'n8n webhook failed', err: e.message }))
    } else {
      logger.info({ msg: 'Magic link (n8n not configured)', magicLink, phone: normalised })
    }

    // Seed demo menu in background
    seedDemoMenu(cafe.id).catch((e) => logger.warn({ msg: 'Demo menu seed failed (quick-register)', cafeId: cafe.id, err: e.message }))

    return res.status(201).json({
      message: 'Check your WhatsApp for the magic login link',
      subdomain,
      cafeId: cafe.id
    })
  } catch (err) {
    logger.error({ msg: 'quick-register error', err })
    return res.status(500).json({ error: 'Registration failed' })
  }
})

// ─── GET /api/auth/magic — exchange magic token for full session ──────────────

router.get('/api/auth/magic', async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token: string }
    if (!token) return res.status(400).json({ error: 'Token required' })

    let payload: any
    try {
      payload = jwt.verify(token, JWT_SECRET)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired magic link' })
    }

    if (!payload.magic) return res.status(401).json({ error: 'Not a magic link token' })

    // Issue a full 8-hour session token
    const sessionToken = jwt.sign({ userId: payload.userId, cafeId: payload.cafeId }, JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token: sessionToken, userId: payload.userId, cafeId: payload.cafeId })
  } catch (err) {
    return res.status(500).json({ error: 'Magic link exchange failed' })
  }
})

// ─── seedDemoMenu — called after every new cafe creation ─────────────────────
// Gives new accounts a ready-to-use menu so the QR scan shows content immediately.

async function seedDemoMenu(cafeId: string): Promise<void> {
  const cats = [
    { nameEn: 'Hot Drinks',   nameAr: 'مشروبات ساخنة',   order: 1 },
    { nameEn: 'Cold Drinks',  nameAr: 'مشروبات باردة',    order: 2 },
    { nameEn: 'Main Dishes',  nameAr: 'الأطباق الرئيسية', order: 3 },
    { nameEn: 'Desserts',     nameAr: 'الحلويات',          order: 4 },
  ]

  type P = { cat: string; nameEn: string; nameAr: string; price: number; desc: string }
  const products: P[] = [
    { cat: 'Hot Drinks',  nameEn: 'Espresso',            nameAr: 'إسبريسو',             price: 18,  desc: 'Strong single-shot espresso' },
    { cat: 'Hot Drinks',  nameEn: 'Cappuccino',          nameAr: 'كابتشينو',             price: 28,  desc: 'Espresso with steamed milk foam' },
    { cat: 'Hot Drinks',  nameEn: 'Moroccan Mint Tea',   nameAr: 'أتاي مغربي',          price: 22,  desc: 'Fresh mint green tea with sugar' },
    { cat: 'Cold Drinks', nameEn: 'Fresh Orange Juice',  nameAr: 'عصير برتقال طازج',    price: 25,  desc: 'Freshly squeezed oranges' },
    { cat: 'Cold Drinks', nameEn: 'Iced Latte',          nameAr: 'آيس لاتيه',           price: 35,  desc: 'Cold espresso over milk and ice' },
    { cat: 'Cold Drinks', nameEn: 'Mineral Water',       nameAr: 'ماء معدني',            price: 12,  desc: 'Still or sparkling' },
    { cat: 'Main Dishes', nameEn: 'Tajine Kefta',        nameAr: 'طاجين كفتة وبيض',     price: 90,  desc: 'Spiced meatballs in tomato sauce with egg' },
    { cat: 'Main Dishes', nameEn: 'Chicken Couscous',    nameAr: 'كسكس بالدجاج',        price: 95,  desc: 'Traditional couscous with 7 vegetables' },
    { cat: 'Main Dishes', nameEn: 'Chicken Burger',      nameAr: 'برغر دجاج',            price: 58,  desc: 'Crispy chicken fillet with coleslaw and fries' },
    { cat: 'Main Dishes', nameEn: 'Harira Soup',         nameAr: 'حريرة',               price: 30,  desc: 'Classic tomato, lentil & chickpea soup' },
    { cat: 'Desserts',    nameEn: 'Chebakia',            nameAr: 'شباكية',               price: 25,  desc: 'Honey sesame pastry with orange blossom' },
    { cat: 'Desserts',    nameEn: 'Chocolate Lava Cake', nameAr: 'كيك الشوكولاتة',      price: 45,  desc: 'Warm dark chocolate cake with molten centre' },
  ]

  const catMap: Record<string, string> = {}
  for (const c of cats) {
    const created = await prisma.category.create({
      data: { cafeId, nameEn: c.nameEn, nameAr: c.nameAr, order: c.order }
    })
    catMap[c.nameEn] = created.id
  }
  for (const p of products) {
    const categoryId = catMap[p.cat]
    if (!categoryId) continue
    await prisma.product.create({
      data: { categoryId, nameEn: p.nameEn, nameAr: p.nameAr, description: p.desc, price: p.price, isAvailable: true }
    })
  }
}

export default router
