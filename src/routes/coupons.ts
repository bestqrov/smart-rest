/**
 * Discount coupons.
 *   Admin:  GET/POST /api/admin/coupons, PATCH/DELETE /api/admin/coupons/:id
 *   Guest:  POST /api/coupons/preview { sessionId, code, subtotal } — informational;
 *           the real discount is computed in POST /api/orders.
 */

import express, { Request, Response } from 'express'
import prisma from '../prisma'
import logger from '../logger'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { requirePlanFeature } from '../billing/planAccess'
import { CouponError, normalizeCode, previewCoupon } from '../coupons/CouponService'

const router = express.Router()
const OBJECT_ID = /^[a-f0-9]{24}$/i
const CODE_RE   = /^[A-Z0-9_-]{3,20}$/

function parseBody(b: any, partial: boolean) {
  const out: Record<string, unknown> = {}
  if (!partial || b.code !== undefined) {
    const code = normalizeCode(b.code)
    if (!CODE_RE.test(code)) throw new Error('BAD_CODE')
    out.code = code
  }
  if (!partial || b.type !== undefined) {
    if (b.type !== 'PERCENT' && b.type !== 'FIXED') throw new Error('BAD_TYPE')
    out.type = b.type
  }
  if (!partial || b.value !== undefined) {
    const v = Number(b.value)
    const type = out.type ?? b.type
    if (!Number.isFinite(v) || v <= 0 || (type === 'PERCENT' && v > 100)) throw new Error('BAD_VALUE')
    out.value = v
  }
  const num = (k: string, int = false) => {
    if (b[k] === undefined) return
    if (b[k] === null || b[k] === '') { out[k] = k === 'minOrder' ? 0 : null; return }
    const n = Number(b[k])
    if (!Number.isFinite(n) || n < 0 || (int && !Number.isInteger(n))) throw new Error('BAD_' + k.toUpperCase())
    out[k] = n
  }
  num('minOrder'); num('maxDiscount'); num('maxUses', true)
  for (const k of ['startsAt', 'endsAt']) {
    if (b[k] === undefined) continue
    if (b[k] === null || b[k] === '') { out[k] = null; continue }
    const d = new Date(b[k]); if (isNaN(d.getTime())) throw new Error('BAD_DATE'); out[k] = d
  }
  if (b.isActive !== undefined) out.isActive = !!b.isActive
  if (b.note !== undefined) out.note = String(b.note).slice(0, 200)
  return out
}

function isDup(err: unknown) {
  return (err as { code?: string })?.code === 'P2002'
}

router.get('/api/admin/coupons', authorizeAdmin, requirePlanFeature('coupons'), async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const coupons = await prisma.coupon.findMany({ where: { cafeId }, orderBy: { createdAt: 'desc' } })
    const usage   = await prisma.order.groupBy({
      by: ['couponCode'], where: { cafeId, couponCode: { not: null }, status: { not: 'CANCELLED' } },
      _sum: { discountAmount: true, totalPrice: true },
    })
    const byCode = new Map(usage.map(u => [u.couponCode, u._sum]))
    return res.json({ coupons: coupons.map(c => ({
      ...c,
      totalDiscount: byCode.get(c.code)?.discountAmount ?? 0,
      totalRevenue:  byCode.get(c.code)?.totalPrice ?? 0,
    })) })
  } catch (err) {
    logger.error({ msg: 'GET coupons error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.post('/api/admin/coupons', authorizeAdmin, requirePlanFeature('coupons'), async (req: Request, res: Response) => {
  try {
    const data = parseBody(req.body ?? {}, false)
    // App-level check too: the @@unique index only exists after `prisma db push`.
    const dup = await prisma.coupon.findFirst({ where: { cafeId: req.admin!.cafeId, code: data.code as string }, select: { id: true } })
    if (dup) return res.status(409).json({ error: 'Code already exists', code: 'DUPLICATE' })
    const c = await prisma.coupon.create({ data: { ...(data as any), cafeId: req.admin!.cafeId } })
    return res.status(201).json(c)
  } catch (err) {
    if (isDup(err)) return res.status(409).json({ error: 'Code already exists', code: 'DUPLICATE' })
    if (err instanceof Error && err.message.startsWith('BAD_')) return res.status(400).json({ error: err.message, code: err.message })
    logger.error({ msg: 'POST coupon error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.patch('/api/admin/coupons/:id', authorizeAdmin, requirePlanFeature('coupons'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    if (!OBJECT_ID.test(id)) return res.status(400).json({ error: 'Invalid id' })
    const existing = await prisma.coupon.findFirst({ where: { id, cafeId: req.admin!.cafeId } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const data = parseBody({ type: existing.type, ...req.body }, true)
    if (data.code && data.code !== existing.code) {
      const dup = await prisma.coupon.findFirst({ where: { cafeId: existing.cafeId, code: data.code as string }, select: { id: true } })
      if (dup) return res.status(409).json({ error: 'Code already exists', code: 'DUPLICATE' })
    }
    const c = await prisma.coupon.update({ where: { id }, data: data as any })
    return res.json(c)
  } catch (err) {
    if (isDup(err)) return res.status(409).json({ error: 'Code already exists', code: 'DUPLICATE' })
    if (err instanceof Error && err.message.startsWith('BAD_')) return res.status(400).json({ error: err.message, code: err.message })
    logger.error({ msg: 'PATCH coupon error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.delete('/api/admin/coupons/:id', authorizeAdmin, requirePlanFeature('coupons'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    if (!OBJECT_ID.test(id)) return res.status(400).json({ error: 'Invalid id' })
    const r = await prisma.coupon.deleteMany({ where: { id, cafeId: req.admin!.cafeId } })
    return r.count ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' })
  } catch (err) {
    logger.error({ msg: 'DELETE coupon error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.post('/api/coupons/preview', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '')
    if (!OBJECT_ID.test(sessionId)) return res.status(400).json({ error: 'sessionId required' })
    const session = await prisma.clientSession.findUnique({ where: { id: sessionId }, select: { cafeId: true, expiresAt: true } })
    if (!session || session.expiresAt <= new Date()) return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' })
    const subtotal = Math.max(0, Number(req.body?.subtotal) || 0)
    return res.json(await previewCoupon(session.cafeId, String(req.body?.code ?? ''), subtotal))
  } catch (err) {
    if (err instanceof CouponError) return res.status(400).json({ error: err.code, code: err.code, minOrder: err.minOrder })
    logger.error({ msg: 'Coupon preview error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

export default router
