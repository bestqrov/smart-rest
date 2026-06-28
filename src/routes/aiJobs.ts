import express, { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'
import { cancelJob, retryJob } from '../services/aiJobService'

const router = express.Router()

// ─── Auth ─────────────────────────────────────────────────────────────────────

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.header('x-superadmin-secret')
  const email  = req.header('x-superadmin-email')
  if (
    secret !== process.env.SUPERADMIN_SECRET ||
    email  !== process.env.SUPERADMIN_EMAIL
  ) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  return next()
}

// ─── GET /api/superadmin/ai-jobs/stats ────────────────────────────────────────

router.get('/api/superadmin/ai-jobs/stats', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [running, queued, completedToday, failedToday, allCompleted, allFailed] = await Promise.all([
      prisma.aIJob.count({ where: { status: 'RUNNING' } }),
      prisma.aIJob.count({ where: { status: 'QUEUED' } }),
      prisma.aIJob.count({ where: { status: 'COMPLETED', completedAt: { gte: todayStart } } }),
      prisma.aIJob.count({ where: { status: 'FAILED',    completedAt: { gte: todayStart } } }),
      prisma.aIJob.aggregate({ where: { status: 'COMPLETED', durationMs: { not: null } }, _avg: { durationMs: true, estimatedCost: true, totalTokens: true } }),
      prisma.aIJob.count({ where: { status: 'FAILED' } }),
    ])

    return res.json({
      running,
      queued,
      completedToday,
      failedToday,
      avgDurationMs:  Math.round(allCompleted._avg.durationMs  ?? 0),
      avgCost:        allCompleted._avg.estimatedCost ?? 0,
      avgTokens:      Math.round(allCompleted._avg.totalTokens ?? 0),
      totalFailed:    allFailed,
    })
  } catch (err) {
    logger.error({ msg: 'ai-jobs stats error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/superadmin/ai-jobs ──────────────────────────────────────────────

router.get('/api/superadmin/ai-jobs', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string | string[]>
    const status   = q.status   as string | undefined
    const module   = q.module   as string | undefined
    const provider = q.provider as string | undefined
    const jobType  = q.jobType  as string | undefined
    const search   = q.search   as string | undefined
    const dateFrom = q.dateFrom as string | undefined
    const dateTo   = q.dateTo   as string | undefined
    const page     = (q.page  as string) ?? '1'
    const limit    = (q.limit as string) ?? '50'

    const where: any = {}
    if (status)   where.status   = status
    if (module)   where.module   = module
    if (provider) where.provider = provider
    if (jobType)  where.jobType  = jobType
    if (search)   where.OR = [
      { module:  { contains: search } },
      { jobType: { contains: search } },
      { inputReference: { contains: search } },
    ]
    if (dateFrom || dateTo) {
      where.queuedAt = {}
      if (dateFrom) where.queuedAt.gte = new Date(dateFrom)
      if (dateTo)   where.queuedAt.lte = new Date(dateTo)
    }

    const pageNum  = parseInt(page)  || 1
    const limitNum = parseInt(limit) || 50
    const skip     = (pageNum - 1) * limitNum

    const [jobs, total] = await Promise.all([
      prisma.aIJob.findMany({
        where,
        orderBy: { queuedAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, module: true, jobType: true, provider: true, model: true,
          status: true, priority: true, progress: true,
          queuedAt: true, startedAt: true, completedAt: true, durationMs: true,
          retryCount: true, estimatedCost: true, totalTokens: true,
          inputReference: true, outputReference: true, errorMessage: true,
        },
      }),
      prisma.aIJob.count({ where }),
    ])

    return res.json({ jobs, total, page: pageNum, pages: Math.ceil(total / limitNum) })
  } catch (err) {
    logger.error({ msg: 'ai-jobs list error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/superadmin/ai-jobs/:id ─────────────────────────────────────────

router.get('/api/superadmin/ai-jobs/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id  = String(req.params.id)
    const job = await prisma.aIJob.findUnique({
      where: { id },
      include: {
        logs: { orderBy: { timestamp: 'asc' } },
      },
    })
    if (!job) return res.status(404).json({ error: 'Job not found' })
    return res.json(job)
  } catch (err) {
    logger.error({ msg: 'ai-job detail error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── POST /api/superadmin/ai-jobs/:id/cancel ─────────────────────────────────

router.post('/api/superadmin/ai-jobs/:id/cancel', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await cancelJob(String(req.params.id))
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'ai-job cancel error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── POST /api/superadmin/ai-jobs/:id/retry ──────────────────────────────────

router.post('/api/superadmin/ai-jobs/:id/retry', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await retryJob(String(req.params.id))
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'ai-job retry error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
