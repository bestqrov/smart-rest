import { Router } from 'express'
import { listBillingAudit } from '../billing'
import { requireSuperAdmin } from './_billingAuthGuard'
import logger from '../logger'

const router = Router()

function parseDate(raw: string | undefined, label: string): Date | undefined {
  if (!raw) return undefined
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid "${label}" date`)
  return d
}

// GET /api/superadmin/billing/audit?tenantId=&action=&from=&to=&page=&limit=
router.get('/api/superadmin/billing/audit', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  const { tenantId, action, from, to, page, limit } = req.query as Record<string, string>

  let fromDate: Date | undefined
  let toDate:   Date | undefined
  try {
    fromDate = parseDate(from, 'from')
    toDate   = parseDate(to, 'to')
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }

  try {
    const result = await listBillingAudit({
      tenantId, action, from: fromDate, to: toDate,
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) {
    logger.error({ msg: '[billing/audit] list failed', err: err.message })
    res.status(500).json({ error: err.message })
  }
})

export default router
