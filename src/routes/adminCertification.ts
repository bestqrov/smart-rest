import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'
import { CertificationService, evaluate, getEvidenceForResult } from '../certification'
import { getAllPacks } from '../certification/packs/PackRegistry'
import { getProfile }  from '../certification/profiles/ProfileRegistry'

const router = express.Router()

// ─── GET /api/admin/certification ─────────────────────────────────────────────
// Legacy endpoint — kept for backward compat (dashboard widget)

router.get('/api/admin/certification', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { certificationStatus: true, certificationMetrics: true, certifiedAt: true },
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })
    return res.json({
      certificationStatus:  cafe.certificationStatus,
      certificationMetrics: cafe.certificationMetrics ?? null,
      certifiedAt:          cafe.certifiedAt ?? null,
    })
  } catch (err) {
    logger.error({ msg: 'GET certification error', err })
    return res.status(500).json({ error: 'Failed to fetch certification data' })
  }
})

// ─── GET /api/admin/certification/result ──────────────────────────────────────
// Full certification result with pack breakdown and evidence map.

router.get('/api/admin/certification/result', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!

    const result = await CertificationService.getLatestResult(cafeId, 'restaurant')

    if (!result) {
      return res.json({ result: null, packBreakdown: [], evidenceMap: {}, nextLevel: null, history: [] })
    }

    // Fetch evidence for all rules
    const evidences = await getEvidenceForResult(result.id)
    const evidenceMap = Object.fromEntries(evidences.map(e => [e.ruleId, e]))

    // Build pack breakdown using in-memory PackRegistry
    const packs = getAllPacks().filter(p => p.rules.length > 0)
    const packBreakdown = packs.map(pack => {
      const packRules = result.ruleResults.filter(r =>
        pack.rules.some(pr => pr.id === r.ruleId),
      )
      const packScore    = packRules.reduce((s, r) => s + r.earnedScore, 0)
      const packMaxScore = packRules.reduce((s, r) => s + r.weight, 0)
      return {
        packId:          pack.id,
        packName:        pack.name,
        description:     pack.description,
        tags:            pack.tags,
        ruleResults:     packRules,
        packScore:       Math.round(packScore * 10) / 10,
        packMaxScore,
        packPercentage:  packMaxScore > 0 ? Math.round((packScore / packMaxScore) * 1000) / 10 : 0,
      }
    }).filter(p => p.ruleResults.length > 0)

    // Next level calculation
    let nextLevel: { level: string; minPercentage: number; pointsNeeded: number } | null = null
    try {
      const profile = getProfile('restaurant')
      const sorted  = [...profile.certificateLevels].sort((a, b) => a.minPercentage - b.minPercentage)
      const curIdx  = sorted.findIndex(l => l.level === result.level)
      const next    = sorted[curIdx + 1]
      if (next) {
        nextLevel = {
          level:         next.level,
          minPercentage: next.minPercentage,
          pointsNeeded:  Math.max(0, Math.ceil((next.minPercentage / 100) * result.maxScore - result.score)),
        }
      }
    } catch (_) {}

    // Last 5 results for history
    const history = await CertificationService.getResultsForTenant(cafeId, 5)

    return res.json({ result, packBreakdown, evidenceMap, nextLevel, history })
  } catch (err) {
    logger.error({ msg: 'GET certification/result error', err })
    return res.status(500).json({ error: 'Failed to load certification result' })
  }
})

// ─── POST /api/admin/certification/evaluate ───────────────────────────────────
// Trigger a fresh evaluation for the current restaurant.

router.post('/api/admin/certification/evaluate', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!

    logger.info({ msg: 'Manual certification evaluation triggered', cafeId })
    const result = await evaluate(cafeId, 'restaurant', { metadata: { triggeredBy: 'admin-manual' } })

    return res.json({ ok: true, result })
  } catch (err: any) {
    logger.error({ msg: 'POST certification/evaluate error', err })
    if (err?.message?.includes('disabled')) {
      return res.status(403).json({ error: 'Certification is not yet available for your account.' })
    }
    return res.status(500).json({ error: 'Evaluation failed — please try again.' })
  }
})

export default router
