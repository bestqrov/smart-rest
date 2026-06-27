import express, { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { hashPassword, verifyPassword } from '../auth/hash'
import logger from '../logger'
import { JWT_SECRET } from '../config'
import prisma from '../prisma'
import { sendMagicLink } from '../services/email'
import { t, resolveLang, type Lang } from '../lib/i18n'

const router = express.Router()
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY ?? '30m'
const REFRESH_TOKEN_DAYS  = parseInt(process.env.REFRESH_TOKEN_DAYS ?? '30', 10)
const MAGIC_EXPIRES_MS    = 15 * 60 * 1000         // 15 minutes
const EMAIL_WHITELIST    = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.fr', 'hotmail.fr', 'live.com', 'icloud.com']
// Resend test address allowed in all environments for QA
const EMAIL_EXCEPTIONS   = ['onboarding@resend.dev']

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract domain from email, lowercase. */
function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase().trim() ?? ''
}

/** Return true when the email provider is on our whitelist. */
function isWhitelistedEmail(email: string): boolean {
  if (EMAIL_EXCEPTIONS.includes(email)) return true
  const domain = emailDomain(email)
  if (!domain) return false
  return EMAIL_WHITELIST.includes(domain)
}

/** Basic RFC-5322 sanity check (not a full regex — combined with whitelist). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase())
}

/** Generate a cryptographically secure URL-safe token (32 bytes → 64 hex chars). */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** SHA-256 hash of a raw token — only the hash is stored in DB. */
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/** Issue an access token + refresh token pair; stores refresh token hash in DB. */
async function issueTokenPair(
  userId: string,
  cafeId: string,
  extra: Record<string, unknown> = {}
): Promise<{ accessToken: string; refreshToken: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessToken  = jwt.sign({ userId, cafeId, ...extra } as object, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY } as any)
  const rawRefresh   = generateSecureToken()
  const tokenHash    = hashToken(rawRefresh)
  const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)

  await prisma.refreshToken.create({ data: { tokenHash, userId, cafeId, expiresAt } })

  return { accessToken, refreshToken: rawRefresh }
}

/** Build a currency string from country. */
function currencyFor(country: string): string {
  const map: Record<string, string> = {
    MA: 'MAD', SA: 'SAR', AE: 'AED', US: 'USD',
    FR: 'EUR', ES: 'EUR', DE: 'EUR', GB: 'GBP'
  }
  return map[country.toUpperCase()] ?? 'MAD'
}

/** Derive a URL-safe subdomain slug from a café name. */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'my-cafe'
}

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
    const { accessToken, refreshToken } = await issueTokenPair(user.id, user.cafeId, { subdomain })
    return res.json({ token: accessToken, refreshToken, userId: user.id, cafeId: user.cafeId, subdomain })
  } catch (err) {
    logger.error({ msg: 'Login error', err })
    return res.status(500).json({ error: 'Login failed' })
  }
})

// ─── POST /api/demo-login — auto-login to demo cafe (no credentials) ──────────

router.post('/api/demo-login', async (req: Request, res: Response) => {
  try {
    const demoSubdomain = process.env.DEMO_SUBDOMAIN ?? 'plage'
    let cafe = await prisma.cafe.findUnique({
      where: { subdomain: demoSubdomain },
      select: { id: true, subdomain: true },
    })

    // Auto-seed demo data if café doesn't exist yet
    if (!cafe) {
      try {
        const { default: seed } = await import('../../prisma/seed')
        await seed()
        cafe = await prisma.cafe.findUnique({
          where: { subdomain: demoSubdomain },
          select: { id: true, subdomain: true },
        })
      } catch (seedErr) {
        logger.error({ msg: 'demo auto-seed failed', err: seedErr })
      }
    }

    if (!cafe) return res.status(503).json({ error: 'Demo not available' })

    const user = await prisma.user.findFirst({
      where: { cafeId: cafe.id },
      select: { id: true },
    })
    if (!user) return res.status(503).json({ error: 'Demo not available' })

    const token = jwt.sign(
      { userId: user.id, cafeId: cafe.id, subdomain: cafe.subdomain, isDemo: true },
      JWT_SECRET,
      { expiresIn: '2h' },
    )
    return res.json({ token, cafeId: cafe.id, subdomain: cafe.subdomain, isDemo: true })
  } catch (err) {
    logger.error({ msg: 'demo-login error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, cafeName, subdomain, businessName, country, accountMode } = req.body as {
      email: string
      password: string
      cafeName: string
      subdomain: string
      businessName?: string
      country?: string       // ISO-2: MA | SA | AE | FR | US …
      accountMode?: string   // 'RESTAURANT' (default) | 'TRAITEUR'
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
      const resolvedMode = (accountMode === 'TRAITEUR') ? 'TRAITEUR' : 'RESTAURANT'
      const cafe = await tx.cafe.create({
        data: {
          name: cafeName,
          businessName: businessName || cafeName,
          subdomain,
          country: resolvedCountry,
          currency,
          trialEndsAt,
          billingStatus: 'GRACE_PERIOD',
          isActive: true,
          accountMode: resolvedMode,
          // Traiteur accounts start with ordering disabled (events drive orders, not daily QR)
          orderingEnabled: resolvedMode === 'RESTAURANT',
        }
      })
      const user = await tx.user.create({
        data: { email, passwordHash, cafeId: cafe.id }
      })
      return { user, cafe }
    })

    const { accessToken, refreshToken } = await issueTokenPair(user.id, cafe.id)

    // Seed demo menu in background — gives new accounts a working menu on first QR scan
    seedDemoMenu(cafe.id).catch((e) => logger.warn({ msg: 'Demo menu seed failed', cafeId: cafe.id, err: e.message }))

    return res.status(201).json({
      token: accessToken,
      refreshToken,
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
          name: `Resto ${digits}`,
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
    const magicLink  = `${process.env.FRONTEND_URL || 'https://smartrestau.com'}/admin/magic?token=${magicToken}`

    // ── n8n webhook — send WhatsApp magic link ───────────────────────────────
    const n8nWebhook = process.env.N8N_WHATSAPP_WEBHOOK
    if (n8nWebhook) {
      fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalised, magicLink, cafeId: cafe.id, subdomain, country: resolvedCountry })
      }).catch((e) => logger.warn({ msg: 'n8n webhook failed', err: e.message }))
    } else {
      logger.info({ msg: 'Magic link (n8n not configured — dev only)', phone: normalised })
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

    const { accessToken, refreshToken } = await issueTokenPair(payload.userId, payload.cafeId)
    return res.json({ token: accessToken, refreshToken, userId: payload.userId, cafeId: payload.cafeId })
  } catch (err) {
    return res.status(500).json({ error: 'Magic link exchange failed' })
  }
})

// ─── POST /api/auth/magic-login-send — send login link to EXISTING user ──────
//
// For users created via magic-link (no password set).
// Looks up the user by email, creates a short-lived JWT, and emails it.

router.post('/api/auth/magic-login-send', async (req: Request, res: Response) => {
  const lang: Lang = resolveLang(req.body?.lang ?? req.query['lang'] as string)
  try {
    const { email } = req.body as { email: string }
    if (!email) return res.status(400).json({ error: t('error_fields_required', lang) })

    const cleanEmail = email.trim().toLowerCase()

    // Always return 200 to avoid leaking whether the email exists
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, cafeId: true, cafe: { select: { subdomain: true } } }
    })

    if (user) {
      const loginToken = jwt.sign(
        { userId: user.id, cafeId: user.cafeId, magic: true },
        JWT_SECRET,
        { expiresIn: '15m' }
      )
      const base      = process.env.FRONTEND_URL ?? 'https://smartrestau.com'
      const magicLink = `${base}/admin/magic?token=${loginToken}`

      await sendMagicLink({ to: cleanEmail, magicLink, lang, cafeName: '' }).catch(e =>
        logger.warn({ msg: 'magic-login-send: email failed', err: e.message })
      )
      logger.info({ msg: 'magic-login-send: link issued', email: cleanEmail })
    }

    return res.json({ sent: true })
  } catch (err) {
    logger.error({ msg: 'magic-login-send error', err })
    return res.status(500).json({ error: t('error_server', lang) })
  }
})

// ─── POST /api/auth/magic-send ────────────────────────────────────────────────
//
// Step 1 of magic-link registration:
//   1. Validate email whitelist (Gmail, Outlook, Hotmail, Yahoo only)
//   2. Check for duplicate email / subdomain
//   3. Create a VerificationToken with hashed token + cafe form data
//   4. Send magic link email via Resend

router.post('/api/auth/magic-send', async (req: Request, res: Response) => {
  const lang: Lang = resolveLang(req.body?.lang ?? req.query['lang'] as string)

  try {
    const { email, cafeName, subdomain, country = 'MA', businessType = 'RESTAURANT' } = req.body as {
      email:         string
      cafeName:      string
      subdomain:     string
      country?:      string
      businessType?: string
      lang?:         string
    }

    // Normalise businessType — only allow known values
    const VALID_TYPES = ['RESTAURANT', 'CAFE', 'TRAITEUR', 'PASTRY', 'FOOD_TRUCK', 'HOTEL']
    const cleanBusinessType = VALID_TYPES.includes(businessType) ? businessType : 'RESTAURANT'

    // ── Field presence ────────────────────────────────────────────────────────
    if (!email || !cafeName || !subdomain) {
      return res.status(400).json({ error: t('error_fields_required', lang) })
    }

    // ── Email format ──────────────────────────────────────────────────────────
    const cleanEmail = email.trim().toLowerCase()
    if (!isValidEmail(cleanEmail)) {
      return res.status(422).json({ error: t('error_email_format', lang) })
    }

    // ── Whitelist check ───────────────────────────────────────────────────────
    if (!isWhitelistedEmail(cleanEmail)) {
      logger.warn({ msg: 'magic-send: rejected non-whitelisted provider', domain: emailDomain(cleanEmail) })
      return res.status(422).json({ error: t('error_email_provider', lang) })
    }

    // ── Subdomain format ──────────────────────────────────────────────────────
    const cleanSubdomain = subdomain.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(cleanSubdomain)) {
      return res.status(422).json({ error: t('error_subdomain_format', lang) })
    }

    // ── Uniqueness checks ─────────────────────────────────────────────────────
    const [existingUser, existingCafe] = await Promise.all([
      prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } }),
      prisma.cafe.findUnique({ where: { subdomain: cleanSubdomain }, select: { id: true } })
    ])

    if (existingUser) return res.status(409).json({ error: t('error_email_taken', lang) })
    if (existingCafe) return res.status(409).json({ error: t('error_subdomain_taken', lang) })

    // ── Delete any pending (unused, non-expired) token for this email ─────────
    // Rate-limit: one active token per email at a time
    await prisma.verificationToken.deleteMany({
      where: { email: cleanEmail, usedAt: null }
    })

    // ── Generate & store token ────────────────────────────────────────────────
    const rawToken = generateSecureToken()
    const expiresAt = new Date(Date.now() + MAGIC_EXPIRES_MS)

    await prisma.verificationToken.create({
      data: {
        email:    cleanEmail,
        token:    rawToken,
        expiresAt,
        cafeData: {
          cafeName:     cafeName.trim(),
          subdomain:    cleanSubdomain,
          country:      country.toUpperCase(),
          currency:     currencyFor(country),
          businessType: cleanBusinessType,
          lang
        }
      }
    })

    // ── Build and send magic link ─────────────────────────────────────────────
    const base      = process.env.FRONTEND_URL ?? 'https://smartrestau.com'
    const magicLink = `${base}/api/auth/magic-verify?token=${rawToken}&lang=${lang}`

    await sendMagicLink({ to: cleanEmail, magicLink, lang, cafeName: cafeName.trim() })

    logger.info({ msg: 'magic-send: token issued', email: cleanEmail, lang })
    return res.json({ sent: true, email: cleanEmail })
  } catch (err) {
    logger.error({ msg: 'magic-send error', err })
    return res.status(500).json({ error: t('error_server', lang) })
  }
})

// ─── GET /api/auth/test-email ─────────────────────────────────────────────────
// Superadmin-only: sends a test email to verify SMTP is working.
// Usage: GET /api/auth/test-email?to=you@gmail.com&secret=YOUR_SUPERADMIN_SECRET

router.get('/api/auth/test-email', async (req: Request, res: Response) => {
  if (req.query['secret'] !== process.env.SUPERADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const to = (req.query['to'] as string) || (process.env.SUPERADMIN_EMAIL ?? '')
  try {
    await sendMagicLink({ to, magicLink: 'https://smartrestau.com', lang: 'en', cafeName: 'Test Cafe' })
    return res.json({ ok: true, to })
  } catch (err: unknown) {
    const e = err as Record<string, unknown>
    return res.status(500).json({ error: String(e['message'] ?? err), code: e['code'], response: e['response'] })
  }
})

// ─── GET /api/auth/magic-verify ───────────────────────────────────────────────
//
// Step 2 of magic-link registration:
//   1. Look up the token (exact hex match)
//   2. Reject if expired or already used
//   3. Create Cafe + User in a transaction
//   4. Mark token as used
//   5. Issue 8h session JWT and redirect to /admin/dashboard

router.get('/api/auth/magic-verify', async (req: Request, res: Response) => {
  const lang: Lang  = resolveLang(req.query['lang'] as string)
  const rawToken    = (req.query['token'] as string ?? '').trim()

  // Accept both GET (redirect from email) and return JSON for AJAX callers
  const wantsJson   = req.headers.accept?.includes('application/json') ?? false

  function fail(status: number, msg: string) {
    if (wantsJson) return res.status(status).json({ error: msg })
    const base = process.env.FRONTEND_URL ?? 'https://smartrestau.com'
    return res.redirect(`${base}/signup?verifyError=${encodeURIComponent(msg)}&lang=${lang}`)
  }

  try {
    if (!rawToken || rawToken.length !== 64 || !/^[a-f0-9]+$/.test(rawToken)) {
      return fail(400, t('error_token_invalid', lang))
    }

    // ── Fetch token record ─────────────────────────────────────────────────────
    const record = await prisma.verificationToken.findUnique({
      where: { token: rawToken }
    })

    if (!record) return fail(401, t('error_token_invalid', lang))

    // ── Used check ─────────────────────────────────────────────────────────────
    if (record.usedAt !== null) return fail(401, t('error_token_used', lang))

    // ── Expiry check ───────────────────────────────────────────────────────────
    if (new Date() > record.expiresAt) {
      await prisma.verificationToken.delete({ where: { id: record.id } })
      return fail(401, t('error_token_invalid', lang))
    }

    // ── Extract stored cafe data ───────────────────────────────────────────────
    const cafeData = record.cafeData as {
      cafeName:     string
      subdomain:    string
      country:      string
      currency:     string
      businessType: string
      lang:         Lang
    }

    // ── Final uniqueness guard (race condition protection) ─────────────────────
    const [dupUser, dupCafe] = await Promise.all([
      prisma.user.findUnique({ where: { email: record.email }, select: { id: true } }),
      prisma.cafe.findUnique({ where: { subdomain: cafeData.subdomain }, select: { id: true } })
    ])

    if (dupUser) return fail(409, t('error_email_taken', lang))
    if (dupCafe) return fail(409, t('error_subdomain_taken', lang))

    // ── Create Cafe + User in atomic transaction ────────────────────────────────
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const { user, cafe } = await prisma.$transaction(async (tx) => {
      const isTraiteur = cafeData.businessType === 'TRAITEUR'

      const cafe = await tx.cafe.create({
        data: {
          name:          cafeData.cafeName,
          businessName:  cafeData.cafeName,
          subdomain:     cafeData.subdomain,
          country:       cafeData.country,
          currency:      cafeData.currency,
          // accountMode drives which dashboard modules are shown at first login
          accountMode:   isTraiteur ? 'TRAITEUR' : 'RESTAURANT',
          trialEndsAt,
          billingStatus: 'GRACE_PERIOD',
          isActive:      true
        }
      })

      // No password — magic-link only account.
      // Store a random irreversible hash so the NOT NULL constraint is satisfied.
      const placeholderHash = await hashPassword(
        crypto.randomBytes(24).toString('base64')
      )
      const user = await tx.user.create({
        data: { email: record.email, passwordHash: placeholderHash, cafeId: cafe.id }
      })

      return { user, cafe }
    })

    // ── Mark token as used (single-use guarantee) ──────────────────────────────
    await prisma.verificationToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() }
    })

    // ── Seed demo menu in background ───────────────────────────────────────────
    seedDemoMenu(cafe.id).catch(e =>
      logger.warn({ msg: 'Demo menu seed failed (magic-verify)', cafeId: cafe.id, err: e.message })
    )

    logger.info({ msg: 'magic-verify: account created', email: record.email, cafeId: cafe.id })

    if (wantsJson) {
      const { accessToken, refreshToken } = await issueTokenPair(user.id, cafe.id, { subdomain: cafe.subdomain })
      return res.json({
        token:        accessToken,
        refreshToken,
        userId:       user.id,
        cafeId:       cafe.id,
        subdomain:    cafe.subdomain,
        trialEndsAt,
        lang
      })
    }

    // Browser redirect — short-lived access token only (no refresh token in URL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionToken = jwt.sign(
      { userId: user.id, cafeId: cafe.id, subdomain: cafe.subdomain },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as any
    )
    const base = process.env.FRONTEND_URL ?? 'https://smartrestau.com'
    return res.redirect(
      `${base}/verify-success?token=${sessionToken}&cafeId=${cafe.id}&subdomain=${cafe.subdomain}&lang=${lang}`
    )
  } catch (err) {
    logger.error({ msg: 'magic-verify error', err })
    return fail(500, t('error_server', lang))
  }
})

// ─── POST /api/auth/refresh — rotate refresh token, issue new access token ────

router.post('/api/auth/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string }
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' })

  try {
    const hash   = hashToken(refreshToken)
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } })

    if (!stored) return res.status(401).json({ error: 'Invalid refresh token' })

    if (new Date() > stored.expiresAt) {
      await prisma.refreshToken.delete({ where: { tokenHash: hash } })
      return res.status(401).json({ error: 'Refresh token expired' })
    }

    // Rotate: delete old token before issuing new pair (prevents replay)
    await prisma.refreshToken.delete({ where: { tokenHash: hash } })
    const { accessToken, refreshToken: newRefresh } = await issueTokenPair(stored.userId, stored.cafeId)

    return res.json({ accessToken, refreshToken: newRefresh })
  } catch (err) {
    logger.error({ msg: 'refresh error', err })
    return res.status(500).json({ error: 'Token refresh failed' })
  }
})

// ─── POST /api/auth/logout — revoke refresh token server-side ─────────────────

router.post('/api/auth/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string }
  if (refreshToken) {
    const hash = hashToken(refreshToken)
    await prisma.refreshToken.deleteMany({ where: { tokenHash: hash } }).catch(() => {})
  }
  return res.json({ ok: true })
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
