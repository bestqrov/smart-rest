import { Router, Request, Response } from 'express'
import { NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'
import {
  generate as marketingGenerate,
  mapBusinessType,
  inferLanguage,
} from '../marketing-brain/MarketingGenerationService'

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const secret         = req.header('x-superadmin-secret')
  const email          = req.header('x-superadmin-email')
  const expectedSecret = process.env.SUPERADMIN_SECRET
  const expectedEmail  = process.env.SUPERADMIN_EMAIL
  if (!expectedSecret || secret !== expectedSecret) return res.status(401).json({ error: 'Unauthorized' })
  if (expectedEmail && email !== expectedEmail)     return res.status(401).json({ error: 'Unauthorized' })
  return next()
}

const router = Router()

const VALID_TYPES = ['RESTAURANT', 'CAFE', 'TRAITEUR', 'PASTRY', 'FOOD_TRUCK', 'HOTEL']
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ── POST /api/public/demo-request — public, no auth ──────────────────────────
router.post('/api/public/demo-request', async (req: Request, res: Response) => {
  try {
    const { ownerName, businessName, businessType, phone, email, city, country = 'MA', notes = '' } = req.body

    if (!ownerName?.trim() || !businessName?.trim() || !phone?.trim() || !email?.trim() || !city?.trim()) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' })
    }
    if (!EMAIL_RE.test(email.trim().toLowerCase())) {
      return res.status(422).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' })
    }

    // Prevent duplicate requests from same email within 24h
    const recent = await prisma.demoRequest.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        status: 'pending',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    if (recent) {
      return res.status(429).json({ error: 'تم إرسال طلبك مسبقاً — سنتواصل معك قريباً 🙏' })
    }

    const demo = await prisma.demoRequest.create({
      data: {
        ownerName:    ownerName.trim(),
        businessName: businessName.trim(),
        businessType: VALID_TYPES.includes(businessType) ? businessType : 'RESTAURANT',
        phone:        phone.trim(),
        email:        email.trim().toLowerCase(),
        city:         city.trim(),
        country:      (country as string).toUpperCase(),
        notes:        (notes ?? '').trim(),
      },
    })

    logger.info({ msg: '[demo-request] New lead', businessName, phone, email })

    // Fire-and-forget: never awaited, never crashes the response
    const countryCode = (country as string).toUpperCase()
    marketingGenerate({
      leadId:       demo.id,
      ownerName:    demo.ownerName,
      cafeName:     demo.businessName,
      cafeCity:     demo.city,
      language:     inferLanguage(countryCode),
      country:      countryCode,
      businessType: mapBusinessType(demo.businessType),
      scenario:     'demo_request_submitted',
      ownerPhone:   demo.phone,
    }).catch((err: unknown) => {
      logger.error({ msg: '[MarketingBrain] unexpected uncaught error in generate()', err })
    })

    return res.json({ success: true, id: demo.id })
  } catch (err: any) {
    logger.error({ msg: '[demo-request] failed', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/superadmin/demo-requests — list all ──────────────────────────────
router.get('/api/superadmin/demo-requests', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { status = 'pending' } = req.query
    const requests = await prisma.demoRequest.findMany({
      where: { status: String(status) },
      orderBy: { createdAt: 'desc' },
    })
    return res.json(requests)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /api/superadmin/demo-requests/:id/activate — create trial account ────
router.post('/api/superadmin/demo-requests/:id/activate', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const demo = await prisma.demoRequest.findUnique({ where: { id } })
    if (!demo) return res.status(404).json({ error: 'Not found' })
    if (demo.status === 'activated') return res.status(409).json({ error: 'Already activated' })

    // Build a clean subdomain from business name
    const baseSlug = demo.businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'demo'

    // Ensure subdomain uniqueness
    let subdomain = baseSlug
    let suffix = 0
    while (await prisma.cafe.findUnique({ where: { subdomain }, select: { id: true } })) {
      suffix++
      subdomain = `${baseSlug}-${suffix}`
    }

    const currency = ['MA', 'DZ', 'TN', 'LY'].includes(demo.country) ? 'MAD'
      : ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'].includes(demo.country) ? 'SAR'
      : 'EUR'

    // 7-day trial
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const { cafe } = await prisma.$transaction(async (tx) => {
      const cafe = await tx.cafe.create({
        data: {
          name:         demo.businessName,
          businessName: demo.businessName,
          subdomain,
          country:      demo.country,
          currency,
          accountMode:  demo.businessType === 'TRAITEUR' ? 'TRAITEUR' : 'RESTAURANT',
          trialEndsAt,
          billingStatus: 'GRACE_PERIOD',
          isActive:     true,
          // Carry the lead's WhatsApp/email over so superadmin can reach the
          // owner (reminders, retargeting) without re-asking for contact info.
          ownerPhone:   demo.phone,
          ownerEmail:   demo.email,
        },
      })

      await tx.demoRequest.update({
        where: { id },
        data: { status: 'activated', cafeId: cafe.id, activatedAt: new Date() },
      })

      return { cafe }
    })

    // Send magic link to the owner's email so they can set up their account
    try {
      const { sendMagicLink } = await import('../services/email')
      const crypto = await import('crypto')
      const rawToken  = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 min

      await prisma.verificationToken.create({
        data: {
          email:    demo.email,
          token:    rawToken,
          expiresAt,
          cafeData: {
            cafeName:     demo.businessName,
            subdomain,
            country:      demo.country,
            currency,
            businessType: demo.businessType,
            lang:         'ar',
            existingCafeId: cafe.id,
          },
        },
      })

      const base      = process.env.FRONTEND_URL ?? 'https://smartrestau.com'
      const magicLink = `${base}/api/auth/magic-verify?token=${rawToken}&lang=ar`
      await sendMagicLink({ to: demo.email, magicLink, lang: 'ar', cafeName: demo.businessName })
    } catch (emailErr) {
      logger.warn({ msg: '[demo-activate] email send failed', emailErr })
      // Don't fail the whole activation if email fails
    }

    return res.json({ success: true, cafeId: cafe.id, subdomain })
  } catch (err: any) {
    logger.error({ msg: '[demo-activate] failed', err })
    return res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/superadmin/demo-requests/:id/reject ────────────────────────────
router.patch('/api/superadmin/demo-requests/:id/reject', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await prisma.demoRequest.update({
      where: { id },
      data: { status: 'rejected', rejectedAt: new Date() },
    })
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
