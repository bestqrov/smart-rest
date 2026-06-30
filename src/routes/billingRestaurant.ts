// ─── Restaurant: Billing Routes ───────────────────────────────────────────────
import { Router }  from 'express'
import jwt         from 'jsonwebtoken'
import {
  getSubscriptionByTenant,
  listInvoices,
  getInvoice,
  getUsageSummary,
  checkAllQuotas,
} from '../billing'

const router = Router()

function authRestaurant(req: any): { cafeId: string } {
  const auth  = (req.headers.authorization as string | undefined) ?? ''
  const token = auth.replace('Bearer ', '')
  if (!token) throw new Error('No token')
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
  return { cafeId: String(payload.cafeId) }
}

// ─── GET /api/billing/plan ────────────────────────────────────────────────────
router.get('/api/billing/plan', async (req, res) => {
  try {
    const { cafeId }     = authRestaurant(req)
    const subscription   = await getSubscriptionByTenant(cafeId)
    res.json({ subscription })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── GET /api/billing/invoices ────────────────────────────────────────────────
router.get('/api/billing/invoices', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const { status, page, limit } = req.query as Record<string, string>
    const result = await listInvoices({
      tenantId: cafeId,
      status:   status as any,
      page:     page   ? Number(page)  : undefined,
      limit:    limit  ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── GET /api/billing/invoices/:id ───────────────────────────────────────────
router.get('/api/billing/invoices/:id', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const invoice    = await getInvoice(req.params.id)
    if (!invoice || invoice.tenantId !== cafeId) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.json({ invoice })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── GET /api/billing/usage ───────────────────────────────────────────────────
router.get('/api/billing/usage', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const summary    = await getUsageSummary(cafeId)
    res.json({ usage: summary })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── GET /api/billing/limits ──────────────────────────────────────────────────
router.get('/api/billing/limits', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const result     = await checkAllQuotas(cafeId)
    res.json({ limits: result })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

export default router
