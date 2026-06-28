import { Router, Request, Response } from 'express'
import {
  getOrders,
  getOrder,
  calculateTotals,
}               from '../marketplace/orders/OrderService'
import { getOrderItems }    from '../marketplace/order-items/OrderItemService'
import {
  markUnderReview,
  approveOrder,
  rejectOrder,
  fulfillOrder,
} from '../marketplace/approval/ApprovalService'

const router = Router()

// ─── SuperAdmin auth guard ────────────────────────────────────────────────────

function requireSuperAdmin(req: Request, res: Response): boolean {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (secret !== process.env.SUPERADMIN_SECRET || !email) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

function saEmail(req: Request): string {
  return String(req.headers['x-superadmin-email'])
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/superadmin/marketplace/orders
router.get('/api/superadmin/marketplace/orders', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return

  try {
    const { status, module, tenantId, supplierId, page, limit } = req.query
    const result = await getOrders({
      status:     status     as any,
      module:     module     as any,
      tenantId:   tenantId   as string | undefined,
      supplierId: supplierId as string | undefined,
      page:       page   ? Number(page)  : undefined,
      limit:      limit  ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/superadmin/marketplace/orders/:id
router.get('/api/superadmin/marketplace/orders/:id', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return

  try {
    const [order, items] = await Promise.all([
      getOrder(String(req.params.id)),
      getOrderItems(String(req.params.id)),
    ])
    if (!order) return res.status(404).json({ error: 'Order not found' }) as any
    res.json({ order, items })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/orders/:id/review
router.post('/api/superadmin/marketplace/orders/:id/review', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return

  try {
    const order = await markUnderReview(String(req.params.id), saEmail(req))
    res.json(order)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/orders/:id/approve
router.post('/api/superadmin/marketplace/orders/:id/approve', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return

  try {
    const order = await approveOrder(String(req.params.id), saEmail(req))
    res.json(order)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/orders/:id/reject
router.post('/api/superadmin/marketplace/orders/:id/reject', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return

  try {
    const { reason } = req.body
    const order = await rejectOrder(String(req.params.id), saEmail(req), reason)
    res.json(order)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/orders/:id/fulfill
router.post('/api/superadmin/marketplace/orders/:id/fulfill', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return

  try {
    const order = await fulfillOrder(String(req.params.id), saEmail(req))
    res.json(order)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
