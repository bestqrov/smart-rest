import express, { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import prisma from '../prisma'

const router = express.Router()

const CONFIG_KEY = 'landing_page'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const secret         = req.header('x-superadmin-secret')
  const email          = req.header('x-superadmin-email')
  const expectedSecret = process.env.SUPERADMIN_SECRET
  const expectedEmail  = process.env.SUPERADMIN_EMAIL
  if (!expectedSecret || secret !== expectedSecret) return res.status(401).json({ error: 'Unauthorized' })
  if (expectedEmail && email !== expectedEmail)      return res.status(401).json({ error: 'Unauthorized' })
  return next()
}

// ─── Multer — memory storage, file goes straight to Cloudinary ───────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

function uploadToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'smart-menu/hero', resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'))
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}

// ─── POST /api/superadmin/landing-config/upload-hero ─────────────────────────

router.post(
  '/api/superadmin/landing-config/upload-hero',
  requireSuperAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, async (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? 'File too large (max 5 MB)'
          : err.message ?? 'Upload failed'
        return res.status(400).json({ error: msg })
      }
      if (!req.file) return res.status(400).json({ error: 'No file received' })
      try {
        const url = await uploadToCloudinary(req.file.buffer)
        return res.json({ url })
      } catch (e: any) {
        return res.status(500).json({ error: e?.message ?? 'Cloudinary upload failed' })
      }
    })
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
