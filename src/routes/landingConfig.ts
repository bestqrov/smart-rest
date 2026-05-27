import express, { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
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

// ─── Multer — save hero images to public/uploads/ ─────────────────────────────

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `hero-${Date.now()}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

// ─── POST /api/superadmin/landing-config/upload-hero ─────────────────────────

router.post(
  '/api/superadmin/landing-config/upload-hero',
  requireSuperAdmin,
  upload.single('image'),
  (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' })
    const url = `/uploads/${req.file.filename}`
    return res.json({ url })
  }
)

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
