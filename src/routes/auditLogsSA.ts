// ─── SuperAdmin — Platform-wide Audit Log Viewer ────────────────────────────
// Read-only surface over the one shared AuditService (src/core/audit/
// AuditService.ts) — no new storage, no new audit mechanism. Distinct from
// src/routes/billingAuditSA.ts, which is billing-module-scoped; this is the
// generic cross-module viewer the "Activity Log" nav item has pointed to
// with no page/route behind it.

import { Router } from 'express'
import { AuditService } from '../core'
import { requireSuperAdmin } from './_billingAuthGuard'
import logger from '../logger'

const router = Router()

function parseDate(raw: string | undefined, label: string): Date | undefined {
  if (!raw) return undefined
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid "${label}" date`)
  return d
}

// GET /api/superadmin/audit-logs?module=&entity=&entityId=&action=&performedBy=&from=&to=&page=&limit=
router.get('/api/superadmin/audit-logs', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  const { module: mod, entity, entityId, action, performedBy, from, to, page, limit } = req.query as Record<string, string>

  let fromDate: Date | undefined
  let toDate:   Date | undefined
  try {
    fromDate = parseDate(from, 'from')
    toDate   = parseDate(to, 'to')
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }

  try {
    const result = await AuditService.getAuditHistory({
      module: mod, entity, entityId, action, performedBy,
      from: fromDate, to: toDate,
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) {
    logger.error({ msg: '[audit-logs] list failed', err: err.message })
    res.status(500).json({ error: err.message })
  }
})

// GET /api/superadmin/audit-logs/modules — distinct module names seen so far,
// for a filter dropdown. Small dataset (module count, not row count), a
// simple distinct scan is fine.
router.get('/api/superadmin/audit-logs/modules', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { default: prisma } = await import('../prisma')
    const rows = await (prisma as any).auditEntry.findMany({
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    })
    res.json({ modules: rows.map((r: any) => r.module) })
  } catch (err: any) {
    logger.error({ msg: '[audit-logs] modules list failed', err: err.message })
    res.status(500).json({ error: err.message })
  }
})

export default router
