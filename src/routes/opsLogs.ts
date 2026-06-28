import { Router } from 'express'
import { getLogs, getLogModules } from '../ops/logs/LogService'
import type { LogFilter, LogSeverity, LogSource } from '../ops/types'

const router = Router()

function requireSuperAdmin(req: any, res: any, next: any) {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (!secret || !email || secret !== process.env.SUPERADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// GET /api/superadmin/ops/logs
// Query: module, severity, source, search, from, to, page, limit
router.get('/api/superadmin/ops/logs', requireSuperAdmin, async (req, res) => {
  try {
    const filter: LogFilter = {
      module:   typeof req.query['module']   === 'string' ? req.query['module']   : undefined,
      severity: typeof req.query['severity'] === 'string' ? req.query['severity'] as LogSeverity : undefined,
      source:   typeof req.query['source']   === 'string' ? req.query['source']   as LogSource   : undefined,
      search:   typeof req.query['search']   === 'string' ? req.query['search']   : undefined,
      from:     typeof req.query['from']     === 'string' ? new Date(req.query['from']) : undefined,
      to:       typeof req.query['to']       === 'string' ? new Date(req.query['to'])   : undefined,
      page:     typeof req.query['page']     === 'string' ? parseInt(req.query['page'])  : 1,
      limit:    typeof req.query['limit']    === 'string' ? parseInt(req.query['limit']) : 50,
    }

    const result = await getLogs(filter)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/superadmin/ops/logs/modules
router.get('/api/superadmin/ops/logs/modules', requireSuperAdmin, async (_req, res) => {
  try {
    const modules = await getLogModules()
    res.json({ modules })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
