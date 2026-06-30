import { Router } from 'express'
import jwt         from 'jsonwebtoken'
import * as PaymentService from '../payments/services/PaymentService'

const router = Router()

function authRestaurant(req: any): { cafeId: string } {
  const auth  = (req.headers.authorization as string | undefined) ?? ''
  const token = auth.replace('Bearer ', '')
  if (!token) throw new Error('No token')
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
  return { cafeId: String(payload.cafeId) }
}

// ─── Payment history (tenant-scoped) ─────────────────────────────────────────
router.get('/api/restaurant/payments/transactions', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    const { status, page, limit } = req.query as Record<string, string>
    const result = await PaymentService.getTransactions({
      tenantId: auth.cafeId,
      status:   status as any,
      page:     page  ? Number(page)  : 1,
      limit:    limit ? Number(limit) : 20,
    })
    res.json(result)
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Single transaction ───────────────────────────────────────────────────────
router.get('/api/restaurant/payments/transactions/:id', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    const tx   = await PaymentService.getTransaction(String(req.params.id))
    if (!tx) return res.status(404).json({ error: 'Not found' })
    // Tenant isolation
    if (tx.tenantId !== auth.cafeId) return res.status(403).json({ error: 'Forbidden' })
    res.json({ transaction: tx })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Payment status for an order ─────────────────────────────────────────────
router.get('/api/restaurant/payments/order/:orderId', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const tx = await (prisma as any).paymentTransaction.findFirst({
      where: { orderId: String(req.params.orderId), tenantId: auth.cafeId },
      orderBy: { createdAt: 'desc' },
    })
    if (!tx) return res.json({ transaction: null })
    res.json({ transaction: tx })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

export default router
