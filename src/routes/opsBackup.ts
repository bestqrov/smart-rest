import { Router } from 'express'
import { triggerBackup, getBackupHistory, getBackup, deleteBackup } from '../ops/backup/BackupService'

const router = Router()

function requireSuperAdmin(req: any, res: any, next: any) {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (!secret || !email || secret !== process.env.SUPERADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// GET /api/superadmin/ops/backup
router.get('/api/superadmin/ops/backup', requireSuperAdmin, async (req, res) => {
  try {
    const limit   = typeof req.query['limit'] === 'string' ? parseInt(req.query['limit']) : 20
    const history = await getBackupHistory(limit)
    res.json({ backups: history })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/superadmin/ops/backup/:id
router.get('/api/superadmin/ops/backup/:id', requireSuperAdmin, async (req, res) => {
  try {
    const record = await getBackup(String(req.params['id']))
    if (!record) return res.status(404).json({ error: 'Backup not found' })
    res.json(record)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/superadmin/ops/backup/trigger
router.post('/api/superadmin/ops/backup/trigger', requireSuperAdmin, async (req, res) => {
  try {
    const email  = String(req.headers['x-superadmin-email'])
    const label  = typeof req.body?.label === 'string'
      ? req.body.label
      : `Manual backup — ${new Date().toISOString().split('T')[0]}`

    const record = await triggerBackup(label, email)
    res.json({ ok: true, backup: record })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// DELETE /api/superadmin/ops/backup/:id
router.delete('/api/superadmin/ops/backup/:id', requireSuperAdmin, async (req, res) => {
  try {
    await deleteBackup(String(req.params['id']))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
