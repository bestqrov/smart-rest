import { Router } from 'express'
import { getAllSettings, updateSetting } from '../ops/runtime/RuntimeConfig'

const router = Router()

function requireSuperAdmin(req: any, res: any, next: any) {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (!secret || !email || secret !== process.env.SUPERADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// GET /api/superadmin/ops/runtime
router.get('/api/superadmin/ops/runtime', requireSuperAdmin, async (_req, res) => {
  try {
    const settings = await getAllSettings()
    res.json({ settings })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/superadmin/ops/runtime/:key
router.patch('/api/superadmin/ops/runtime/:key', requireSuperAdmin, async (req, res) => {
  try {
    const key       = String(req.params['key'])
    const { value } = req.body as { value: unknown }
    if (value === undefined) return res.status(400).json({ error: 'value is required' })

    const email   = String(req.headers['x-superadmin-email'])
    const setting = await updateSetting(key, value, email)
    res.json({ ok: true, setting })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('unknown') || msg.includes('read-only') ? 400 : 500
    res.status(status).json({ error: msg })
  }
})

export default router
