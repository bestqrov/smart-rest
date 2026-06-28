import express, { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'
import { CertificationService, evaluate } from '../certification'

const router = express.Router()

// ─── Superadmin auth guard (mirrors superadmin.ts) ───────────────────────────

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const secret         = req.header('x-superadmin-secret')
  const email          = req.header('x-superadmin-email')
  const expectedSecret = process.env.SUPERADMIN_SECRET
  const expectedEmail  = process.env.SUPERADMIN_EMAIL
  if (!expectedSecret || secret !== expectedSecret) return res.status(401).json({ error: 'Unauthorized' })
  if (expectedEmail && email !== expectedEmail)      return res.status(401).json({ error: 'Unauthorized' })
  return next()
}

// ─── GET /api/superadmin/certification ────────────────────────────────────────

router.get('/api/superadmin/certification', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search ?? '')
    const level  = String(req.query.level  ?? '')
    const page   = Math.max(1, parseInt(String(req.query.page  ?? '1')))
    const limit  = Math.min(100, parseInt(String(req.query.limit ?? '30')))
    const skip   = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { name:      { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [cafes, total] = await Promise.all([
      prisma.cafe.findMany({
        where,
        select: { id: true, name: true, subdomain: true, billingStatus: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.cafe.count({ where }),
    ])

    // Fetch latest cert results (sequential to avoid overwhelming DB)
    const rows = await Promise.all(
      cafes.map(async cafe => {
        const cert = await CertificationService.getLatestResult(cafe.id, 'restaurant')
        return {
          cafeId:        cafe.id,
          cafeName:      cafe.name,
          subdomain:     cafe.subdomain,
          billingStatus: cafe.billingStatus,
          certification: cert ? {
            level:       cert.level,
            percentage:  cert.percentage,
            score:       cert.score,
            maxScore:    cert.maxScore,
            status:      cert.status,
            evaluatedAt: cert.evaluatedAt,
            expiresAt:   cert.expiresAt,
            version:     cert.version,
          } : null,
        }
      }),
    )

    // Post-filter by level
    const filtered = level ? rows.filter(r => r.certification?.level === level) : rows

    const stats = await CertificationService.getStats('restaurant')

    return res.json({ rows: filtered, total, page, stats })
  } catch (err) {
    logger.error({ msg: 'GET superadmin/certification error', err })
    return res.status(500).json({ error: 'Failed to load certification data' })
  }
})

// ─── GET /api/superadmin/certification/:tenantId ──────────────────────────────

router.get('/api/superadmin/certification/:tenantId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.params['tenantId'])
    const history = await CertificationService.getResultsForTenant(tenantId, 10)
    return res.json({ latest: history[0] ?? null, history })
  } catch (err) {
    logger.error({ msg: 'GET superadmin/certification/:tenantId error', err })
    return res.status(500).json({ error: 'Failed to load tenant certification' })
  }
})

// ─── POST /api/superadmin/certification/:tenantId/evaluate ───────────────────

router.post('/api/superadmin/certification/:tenantId/evaluate', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.params['tenantId'])
    logger.info({ msg: 'SuperAdmin triggered certification evaluation', tenantId })
    const result = await evaluate(tenantId, 'restaurant', { metadata: { triggeredBy: 'superadmin-manual' } })
    return res.json({ ok: true, result })
  } catch (err: any) {
    logger.error({ msg: 'POST superadmin/certification/evaluate error', err })
    return res.status(500).json({ error: err?.message ?? 'Evaluation failed' })
  }
})

// ─── POST /api/superadmin/certification/bulk-evaluate ────────────────────────

router.post('/api/superadmin/certification/bulk-evaluate', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantIds } = req.body as { tenantIds: string[] }
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ error: 'tenantIds must be a non-empty array' })
    }
    if (tenantIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 tenants per bulk evaluation' })
    }

    const results: { tenantId: string; ok: boolean; level?: string; error?: string }[] = []
    for (const tenantId of tenantIds) {
      try {
        const r = await evaluate(tenantId, 'restaurant', { metadata: { triggeredBy: 'superadmin-bulk' } })
        results.push({ tenantId, ok: true, level: r.level })
      } catch (err: any) {
        results.push({ tenantId, ok: false, error: err?.message ?? 'Failed' })
      }
    }

    return res.json({ results, total: tenantIds.length, succeeded: results.filter(r => r.ok).length })
  } catch (err) {
    logger.error({ msg: 'POST superadmin/certification/bulk-evaluate error', err })
    return res.status(500).json({ error: 'Bulk evaluation failed' })
  }
})

export default router
