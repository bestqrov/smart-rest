import express, { Request, Response } from 'express'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

// POST /api/products/:productId/like
// Public — identified by X-Session-ID header to prevent double-likes.
// We keep a per-product Set of session IDs in memory (restarts reset it, which is acceptable).
const likedSessions = new Map<string, Set<string>>()

router.post('/api/products/:productId/like', async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string
    const rawHeader = req.headers['x-session-id']
    const sessionId = Array.isArray(rawHeader) ? rawHeader[0] : (rawHeader ?? '')

    if (!sessionId) {
      return res.status(400).json({ error: 'X-Session-ID header is required' })
    }

    const sessions = likedSessions.get(productId) ?? new Set<string>()
    if (sessions.has(sessionId)) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { likesCount: true },
      })
      return res.json({ likesCount: product?.likesCount ?? 0, alreadyLiked: true })
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    })

    sessions.add(sessionId)
    likedSessions.set(productId, sessions)

    return res.json({ likesCount: updated.likesCount, alreadyLiked: false })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
