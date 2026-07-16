import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import {
  syncBusinessProfile, getReviewMonitoringFeed, generateReviewReplySuggestion,
  calculateLocalSeoScore, upsertCitation, listCitations, getPerformanceInsights,
} from '../seo/SeoService'

const router = express.Router()

// POST /api/admin/seo/gbp/sync
router.post('/api/admin/seo/gbp/sync', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const result = await syncBusinessProfile(req.admin!.cafeId)
    return res.json(result)
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/seo/gbp/sync error', err })
    return res.status(500).json({ error: 'Failed to sync business profile' })
  }
})

// GET /api/admin/seo/reviews/feed?limit=
router.get('/api/admin/seo/reviews/feed', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const feed = await getReviewMonitoringFeed(req.admin!.cafeId, req.query.limit ? Number(req.query.limit) : undefined)
    return res.json({ feed })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/seo/reviews/feed error', err })
    return res.status(500).json({ error: 'Failed to fetch review feed' })
  }
})

// POST /api/admin/seo/reviews/:sourceId/suggest-reply — body: { sourceType, rating, comment? }
router.post('/api/admin/seo/reviews/:sourceId/suggest-reply', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { sourceType, rating, comment } = req.body as { sourceType?: 'FEEDBACK' | 'ORDER_REVIEW'; rating?: number; comment?: string }
    if (!sourceType || !rating) return res.status(400).json({ error: 'sourceType and rating are required' })

    const reply = await generateReviewReplySuggestion(cafeId, sourceType, req.params.sourceId as string, rating, comment ?? null)
    return res.json({ reply })
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/seo/reviews/:sourceId/suggest-reply error', err })
    return res.status(500).json({ error: 'Failed to generate reply suggestion' })
  }
})

// GET /api/admin/seo/score
router.get('/api/admin/seo/score', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const score = await calculateLocalSeoScore(req.admin!.cafeId)
    return res.json(score)
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/seo/score error', err })
    return res.status(500).json({ error: 'Failed to calculate SEO score' })
  }
})

// GET/POST /api/admin/seo/citations
router.get('/api/admin/seo/citations', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const citations = await listCitations(req.admin!.cafeId)
    return res.json({ citations })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/seo/citations error', err })
    return res.status(500).json({ error: 'Failed to fetch citations' })
  }
})

router.post('/api/admin/seo/citations', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { source, url, status } = req.body as { source?: string; url?: string; status?: 'LISTED' | 'MISSING' | 'INCONSISTENT' }
    if (!source) return res.status(400).json({ error: 'source is required' })
    const citation = await upsertCitation(req.admin!.cafeId, source, url, status)
    return res.json({ citation })
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/seo/citations error', err })
    return res.status(500).json({ error: 'Failed to save citation' })
  }
})

// GET /api/admin/seo/insights
router.get('/api/admin/seo/insights', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const insights = await getPerformanceInsights(req.admin!.cafeId)
    return res.json(insights)
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/seo/insights error', err })
    return res.status(500).json({ error: 'Failed to fetch performance insights' })
  }
})

export default router
