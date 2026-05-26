import express, { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'

const router = express.Router()

const CONFIG_KEY = 'landing_page'

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const secret         = req.header('x-superadmin-secret')
  const email          = req.header('x-superadmin-email')
  const expectedSecret = process.env.SUPERADMIN_SECRET
  const expectedEmail  = process.env.SUPERADMIN_EMAIL
  if (!expectedSecret || secret !== expectedSecret) return res.status(401).json({ error: 'Unauthorized' })
  if (expectedEmail && email !== expectedEmail)      return res.status(401).json({ error: 'Unauthorized' })
  return next()
}

// ─── GET /api/public/landing-config — no auth ─────────────────────────────────

router.get('/api/public/landing-config', async (_req: Request, res: Response) => {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: CONFIG_KEY } })
    return res.json(row ? row.value : {})
  } catch {
    return res.json({})
  }
})

// ─── GET /api/superadmin/landing-config ───────────────────────────────────────

router.get('/api/superadmin/landing-config', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: CONFIG_KEY } })
    return res.json(row ? row.value : {})
  } catch {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PUT /api/superadmin/landing-config ───────────────────────────────────────

router.put('/api/superadmin/landing-config', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const value = req.body
    await prisma.siteConfig.upsert({
      where:  { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value },
      update: { value },
    })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Failed to save' })
  }
})

export default router
