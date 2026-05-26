import express, { Request, Response } from 'express'
import prisma from '../prisma'
import { verifyToken } from '../middleware/auth'

const router = express.Router()

const CONFIG_KEY = 'landing_page'

// ─── GET /api/public/landing-config — no auth ─────────────────────────────────

router.get('/api/public/landing-config', async (_req: Request, res: Response) => {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: CONFIG_KEY } })
    return res.json(row ? row.value : {})
  } catch {
    return res.json({})
  }
})

// ─── GET /api/superadmin/landing-config — superadmin only ────────────────────

router.get('/api/superadmin/landing-config', verifyToken, async (req: Request, res: Response) => {
  if ((req as any).user?.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Forbidden' })
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: CONFIG_KEY } })
    return res.json(row ? row.value : {})
  } catch {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PUT /api/superadmin/landing-config — superadmin only ────────────────────

router.put('/api/superadmin/landing-config', verifyToken, async (req: Request, res: Response) => {
  if ((req as any).user?.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Forbidden' })
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
