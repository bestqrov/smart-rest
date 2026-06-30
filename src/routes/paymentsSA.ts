import { Router } from 'express'
import * as PaymentService from '../payments/services/PaymentService'
import type { ProviderName, PaymentMethod } from '../payments/types'

const router = Router()

function requireSuperAdmin(req: any, res: any): boolean {
  if (req.headers['x-superadmin-secret'] !== process.env.SUPERADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

function saEmail(req: any): string {
  return String(req.headers['x-superadmin-email'] ?? 'sa@system')
}

// ─── List transactions ────────────────────────────────────────────────────────
router.get('/api/superadmin/payments/transactions', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { tenantId, orderId, status, provider, module: mod, page, limit } =
      req.query as Record<string, string>
    const result = await PaymentService.getTransactions({
      tenantId, orderId,
      status:   status   as any,
      provider: provider as any,
      module:   mod,
      page:     page  ? Number(page)  : 1,
      limit:    limit ? Number(limit) : 20,
    })
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Get single transaction ───────────────────────────────────────────────────
router.get('/api/superadmin/payments/transactions/:id', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const tx = await PaymentService.getTransaction(String(req.params.id))
    if (!tx) return res.status(404).json({ error: 'Transaction not found' })
    res.json({ transaction: tx })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Create transaction manually ──────────────────────────────────────────────
router.post('/api/superadmin/payments/transactions', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { orderId, tenantId, module: mod, provider, method, amount, currency, reference, notes } =
      req.body
    if (!orderId || !tenantId || !provider || !method || amount == null) {
      return res.status(400).json({ error: 'orderId, tenantId, provider, method, amount required' })
    }
    const tx = await PaymentService.createTransaction({
      orderId, tenantId,
      module:   mod ?? 'MARKETPLACE',
      provider: provider as ProviderName,
      method:   method   as PaymentMethod,
      amount:   Number(amount),
      currency: currency ?? 'MAD',
      reference, notes,
    })
    res.status(201).json({ transaction: tx })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Authorize ────────────────────────────────────────────────────────────────
router.post('/api/superadmin/payments/transactions/:id/authorize', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const tx = await PaymentService.authorize(String(req.params.id), req.body.metadata)
    res.json({ transaction: tx })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Mark Paid (manual validation) ───────────────────────────────────────────
router.post('/api/superadmin/payments/transactions/:id/paid', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { reference, notes } = req.body
    const tx = await PaymentService.markPaid(
      String(req.params.id),
      reference,
      undefined,
      notes ?? `Validated by ${saEmail(req)}`,
    )
    res.json({ transaction: tx })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Mark Failed ──────────────────────────────────────────────────────────────
router.post('/api/superadmin/payments/transactions/:id/fail', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const tx = await PaymentService.fail(String(req.params.id), req.body.reason)
    res.json({ transaction: tx })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Refund ───────────────────────────────────────────────────────────────────
router.post('/api/superadmin/payments/transactions/:id/refund', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { amount, reason } = req.body
    const tx = await PaymentService.refund(
      String(req.params.id),
      amount != null ? Number(amount) : undefined,
      reason,
    )
    res.json({ transaction: tx })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Cancel ───────────────────────────────────────────────────────────────────
router.post('/api/superadmin/payments/transactions/:id/cancel', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const tx = await PaymentService.cancel(String(req.params.id))
    res.json({ transaction: tx })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/api/superadmin/payments/stats', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { default: prisma } = await import('../prisma')
    const [total, pending, paid, failed, refunded] = await Promise.all([
      (prisma as any).paymentTransaction.count(),
      (prisma as any).paymentTransaction.count({ where: { status: 'PENDING' } }),
      (prisma as any).paymentTransaction.count({ where: { status: 'PAID' } }),
      (prisma as any).paymentTransaction.count({ where: { status: 'FAILED' } }),
      (prisma as any).paymentTransaction.count({ where: { status: 'REFUNDED' } }),
    ])
    const paidSum = await (prisma as any).paymentTransaction.aggregate({
      where: { status: 'PAID' }, _sum: { amount: true },
    })
    res.json({
      stats: {
        total, pending, paid, failed, refunded,
        totalPaid: paidSum._sum.amount ?? 0,
      },
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
