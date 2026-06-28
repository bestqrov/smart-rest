import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import {
  createOrder,
  addItemToOrder,
  removeItemFromOrder,
  submitOrder,
  cancelOrder,
  getOrder,
  getOrders,
}               from '../marketplace/orders/OrderService'
import { getOrderItems } from '../marketplace/order-items/OrderItemService'
import type { OrderModule } from '../marketplace/types'

const router = Router()

// ─── Auth guard ───────────────────────────────────────────────────────────────

interface AuthPayload {
  cafeId:   string
  userId?:  string
  role?:    string
}

function requireAuth(req: Request, res: Response): AuthPayload | null {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    return payload
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/restaurant/marketplace/orders
router.post('/api/restaurant/marketplace/orders', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    const { supplierId, currency, notes } = req.body
    const order = await createOrder({
      tenantId:    auth.cafeId,
      module:      'RESTAURANT' as OrderModule,
      requestedBy: auth.userId ?? auth.cafeId,
      supplierId,
      currency,
      notes,
    })
    res.status(201).json(order)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/restaurant/marketplace/orders/:id/items
router.post('/api/restaurant/marketplace/orders/:id/items', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    const order = await getOrder(String(req.params.id))
    if (!order || order.tenantId !== auth.cafeId) {
      return res.status(404).json({ error: 'Order not found' }) as any
    }

    const { productId, quantity, unitPrice, discount, tax, metadata } = req.body
    const item = await addItemToOrder(String(req.params.id), { productId, quantity, unitPrice, discount, tax, metadata })
    res.status(201).json(item)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// DELETE /api/restaurant/marketplace/orders/:id/items/:itemId
router.delete('/api/restaurant/marketplace/orders/:id/items/:itemId', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    const order = await getOrder(String(req.params.id))
    if (!order || order.tenantId !== auth.cafeId) {
      return res.status(404).json({ error: 'Order not found' }) as any
    }

    await removeItemFromOrder(String(req.params.id), String(req.params.itemId))
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/restaurant/marketplace/orders/:id/submit
router.post('/api/restaurant/marketplace/orders/:id/submit', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    const order = await getOrder(String(req.params.id))
    if (!order || order.tenantId !== auth.cafeId) {
      return res.status(404).json({ error: 'Order not found' }) as any
    }

    const updated = await submitOrder(String(req.params.id))
    res.json(updated)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/restaurant/marketplace/orders/:id/cancel
router.post('/api/restaurant/marketplace/orders/:id/cancel', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    const order = await getOrder(String(req.params.id))
    if (!order || order.tenantId !== auth.cafeId) {
      return res.status(404).json({ error: 'Order not found' }) as any
    }
    if (!['DRAFT', 'SUBMITTED'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot cancel order in status ${order.status}` }) as any
    }

    const updated = await cancelOrder(String(req.params.id), auth.userId ?? auth.cafeId)
    res.json(updated)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/restaurant/marketplace/orders
router.get('/api/restaurant/marketplace/orders', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    const { status, page, limit } = req.query
    const result = await getOrders({
      tenantId: auth.cafeId,
      module:   'RESTAURANT',
      status:   status as any,
      page:     page  ? Number(page)  : undefined,
      limit:    limit ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/restaurant/marketplace/orders/:id
router.get('/api/restaurant/marketplace/orders/:id', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    const [order, items] = await Promise.all([
      getOrder(String(req.params.id)),
      getOrderItems(String(req.params.id)),
    ])
    if (!order || order.tenantId !== auth.cafeId) {
      return res.status(404).json({ error: 'Order not found' }) as any
    }
    res.json({ order, items })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
