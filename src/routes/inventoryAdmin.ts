/**
 * Smart Inventory & Supplier Management — Admin API
 *
 * All routes require a valid admin JWT and are scoped to req.admin.cafeId.
 * Routes check isSmartInventoryEnabled before serving data.
 *
 * Stock Items:
 *   GET    /api/v1/inventory/stock               list all
 *   POST   /api/v1/inventory/stock               create
 *   PATCH  /api/v1/inventory/stock/:id           update (qty / metadata)
 *   DELETE /api/v1/inventory/stock/:id           delete
 *   GET    /api/v1/inventory/stock/low           items below threshold
 *   POST   /api/v1/inventory/stock/:id/restock   add qty (restock action)
 *
 * Suppliers:
 *   GET    /api/v1/inventory/suppliers            list
 *   POST   /api/v1/inventory/suppliers            create
 *   PATCH  /api/v1/inventory/suppliers/:id        update
 *   DELETE /api/v1/inventory/suppliers/:id        delete (soft)
 *
 * Purchase Orders:
 *   GET    /api/v1/inventory/purchase-orders           list
 *   POST   /api/v1/inventory/purchase-orders           create
 *   PATCH  /api/v1/inventory/purchase-orders/:id       update status / mark sent
 *   GET    /api/v1/inventory/purchase-orders/:id       get single PO
 *
 * System Notifications:
 *   GET    /api/v1/inventory/notifications              list unread
 *   PATCH  /api/v1/inventory/notifications/:id/read    mark read
 *   POST   /api/v1/inventory/notifications/read-all    mark all read
 *
 * Webhook (called by n8n):
 *   POST   /api/v1/inventory/webhook/low-stock         receive low-stock event externally
 *
 * Activation (self-service request flow):
 *   POST   /api/v1/inventory/request-activation        restaurant owner requests feature activation
 *   GET    /api/v1/inventory/activation-status         returns current gate + request state
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

// ── Feature gate middleware ───────────────────────────────────────────────────

export async function requireInventory(req: Request, res: Response, next: Function) {
  try {
    const cafeId = req.admin!.cafeId
    const cafe   = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { isSmartInventoryEnabled: true }
    })
    if (!cafe?.isSmartInventoryEnabled) {
      return res.status(403).json({
        error:  'Smart Inventory is not enabled for this account.',
        code:   'INVENTORY_NOT_ENABLED',
        upgrade: true
      })
    }
    return next()
  } catch {
    return res.status(500).json({ error: 'Gate check failed' })
  }
}

// ─── STOCK ITEMS ──────────────────────────────────────────────────────────────

// GET /api/v1/inventory/stock
router.get('/api/v1/inventory/stock', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { search } = req.query as { search?: string }

    const items = await prisma.stockItem.findMany({
      where: {
        cafeId,
        ...(search ? { ingredientName: { contains: search, mode: 'insensitive' } } : {})
      },
      orderBy: [{ isLow: 'desc' }, { ingredientName: 'asc' }]
    })
    return res.json(items)
  } catch (err) {
    logger.error({ msg: 'GET /api/v1/inventory/stock error', err })
    return res.status(500).json({ error: 'Failed to fetch stock items' })
  }
})

// GET /api/v1/inventory/stock/low — items below minimum threshold
router.get('/api/v1/inventory/stock/low', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const items  = await prisma.stockItem.findMany({
      where:   { cafeId, isLow: true },
      orderBy: { ingredientName: 'asc' }
    })
    return res.json(items)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch low-stock items' })
  }
})

// POST /api/v1/inventory/stock
router.post('/api/v1/inventory/stock', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { ingredientName, unit, currentQty, minimumThreshold, costPerUnit } = req.body as {
      ingredientName:   string
      unit:             string
      currentQty:       number
      minimumThreshold: number
      costPerUnit:      number
    }

    if (!ingredientName?.trim()) return res.status(400).json({ error: 'ingredientName is required' })

    const validUnits = ['g', 'ml', 'pcs', 'kg', 'L']
    if (!validUnits.includes(unit)) {
      return res.status(400).json({ error: `unit must be one of: ${validUnits.join(', ')}` })
    }

    const existing = await prisma.stockItem.findUnique({
      where: { cafeId_ingredientName: { cafeId, ingredientName: ingredientName.trim() } }
    })
    if (existing) return res.status(409).json({ error: 'An ingredient with this name already exists' })

    const isLow = (currentQty ?? 0) < (minimumThreshold ?? 0)

    const item = await prisma.stockItem.create({
      data: {
        cafeId,
        ingredientName:   ingredientName.trim(),
        unit:             unit ?? 'g',
        currentQty:       currentQty     ?? 0,
        minimumThreshold: minimumThreshold ?? 0,
        costPerUnit:      costPerUnit     ?? 0,
        isLow
      }
    })
    return res.status(201).json(item)
  } catch (err) {
    logger.error({ msg: 'POST /api/v1/inventory/stock error', err })
    return res.status(500).json({ error: 'Failed to create stock item' })
  }
})

// PATCH /api/v1/inventory/stock/:id
router.patch('/api/v1/inventory/stock/:id', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string

    const existing = await prisma.stockItem.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Stock item not found' })

    const { ingredientName, unit, currentQty, minimumThreshold, costPerUnit } = req.body as Partial<{
      ingredientName:   string
      unit:             string
      currentQty:       number
      minimumThreshold: number
      costPerUnit:      number
    }>

    const newQty  = currentQty       !== undefined ? currentQty       : existing.currentQty
    const newMin  = minimumThreshold !== undefined ? minimumThreshold : existing.minimumThreshold
    const isLow   = newQty < newMin

    const item = await prisma.stockItem.update({
      where: { id },
      data:  {
        ...(ingredientName   !== undefined && { ingredientName: ingredientName.trim() }),
        ...(unit             !== undefined && { unit }),
        ...(currentQty       !== undefined && { currentQty }),
        ...(minimumThreshold !== undefined && { minimumThreshold }),
        ...(costPerUnit      !== undefined && { costPerUnit }),
        isLow
      }
    })
    return res.json(item)
  } catch (err) {
    logger.error({ msg: 'PATCH /api/v1/inventory/stock/:id error', err })
    return res.status(500).json({ error: 'Failed to update stock item' })
  }
})

// POST /api/v1/inventory/stock/:id/restock  { addQty: number }
router.post('/api/v1/inventory/stock/:id/restock', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId     = req.admin!.cafeId
    const id         = req.params.id as string
    const { addQty } = req.body as { addQty?: number }

    if (!addQty || addQty <= 0) return res.status(400).json({ error: 'addQty must be a positive number' })

    const existing = await prisma.stockItem.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Stock item not found' })

    const newQty = existing.currentQty + addQty
    const isLow  = newQty < existing.minimumThreshold

    const item = await prisma.stockItem.update({
      where: { id },
      data:  { currentQty: newQty, isLow, lastRestockedAt: new Date() }
    })
    return res.json(item)
  } catch (err) {
    return res.status(500).json({ error: 'Restock failed' })
  }
})

// DELETE /api/v1/inventory/stock/:id
router.delete('/api/v1/inventory/stock/:id', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string

    const existing = await prisma.stockItem.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Stock item not found' })

    await prisma.stockItem.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Delete failed' })
  }
})

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

// GET /api/v1/inventory/suppliers
router.get('/api/v1/inventory/suppliers', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId    = req.admin!.cafeId
    const suppliers = await prisma.inventorySupplier.findMany({
      where:   { cafeId },
      orderBy: { name: 'asc' }
    })
    return res.json(suppliers)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch suppliers' })
  }
})

// POST /api/v1/inventory/suppliers
router.post('/api/v1/inventory/suppliers', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { name, contactPerson, phone, email } = req.body as {
      name:          string
      contactPerson?: string
      phone?:         string
      email?:         string
    }
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })

    const supplier = await prisma.inventorySupplier.create({
      data: {
        cafeId,
        name:          name.trim(),
        contactPerson: contactPerson?.trim() ?? '',
        phone:         phone?.trim()         ?? '',
        email:         email?.trim()         ?? ''
      }
    })
    return res.status(201).json(supplier)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create supplier' })
  }
})

// PATCH /api/v1/inventory/suppliers/:id
router.patch('/api/v1/inventory/suppliers/:id', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string

    const existing = await prisma.inventorySupplier.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Supplier not found' })

    const { name, contactPerson, phone, email, isActive } = req.body as Partial<{
      name:          string
      contactPerson: string
      phone:         string
      email:         string
      isActive:      boolean
    }>

    const supplier = await prisma.inventorySupplier.update({
      where: { id },
      data:  {
        ...(name          !== undefined && { name:          name.trim()          }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson.trim() }),
        ...(phone         !== undefined && { phone:         phone.trim()         }),
        ...(email         !== undefined && { email:         email.trim()         }),
        ...(isActive      !== undefined && { isActive })
      }
    })
    return res.json(supplier)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update supplier' })
  }
})

// DELETE /api/v1/inventory/suppliers/:id  (soft delete via isActive=false)
router.delete('/api/v1/inventory/suppliers/:id', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string

    const existing = await prisma.inventorySupplier.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Supplier not found' })

    await prisma.inventorySupplier.update({ where: { id }, data: { isActive: false } })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Delete failed' })
  }
})

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────

// GET /api/v1/inventory/purchase-orders
router.get('/api/v1/inventory/purchase-orders', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { status } = req.query as { status?: string }

    const orders = await prisma.purchaseOrder.findMany({
      where:   { cafeId, ...(status ? { status } : {}) },
      include: { supplier: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return res.json(orders)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch purchase orders' })
  }
})

// GET /api/v1/inventory/purchase-orders/:id
router.get('/api/v1/inventory/purchase-orders/:id', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string

    const po = await prisma.purchaseOrder.findFirst({
      where:   { id, cafeId },
      include: { supplier: true }
    })
    if (!po) return res.status(404).json({ error: 'Purchase order not found' })
    return res.json(po)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch purchase order' })
  }
})

// POST /api/v1/inventory/purchase-orders
router.post('/api/v1/inventory/purchase-orders', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { supplierId, notes, items, requisitionId } = req.body as {
      supplierId:     string
      notes?:         string
      items:          { stockItemName: string; unit: string; quantityOrdered: number; unitCost: number }[]
      requisitionId?: string
    }

    if (!supplierId) return res.status(400).json({ error: 'supplierId is required' })
    if (!items?.length) return res.status(400).json({ error: 'items array is required' })

    const supplier = await prisma.inventorySupplier.findFirst({ where: { id: supplierId, cafeId } })
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' })

    let requisition = null
    if (requisitionId) {
      requisition = await prisma.purchaseRequisition.findFirst({ where: { id: requisitionId, cafeId } })
      if (!requisition) return res.status(404).json({ error: 'Requisition not found' })
    }

    const enrichedItems = items.map(item => ({
      ...item,
      totalCost: item.quantityOrdered * item.unitCost
    }))
    const totalCost = enrichedItems.reduce((sum, i) => sum + i.totalCost, 0)

    const po = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          cafeId,
          supplierId,
          notes:    notes ?? '',
          items:    enrichedItems,
          totalCost,
          ...(requisition && { requisitionId: requisition.id })
        },
        include: { supplier: { select: { id: true, name: true, phone: true, email: true } } }
      })
      if (requisition) {
        await tx.purchaseRequisition.update({
          where: { id: requisition.id },
          data:  { status: 'ordered', purchaseOrderId: created.id }
        })
      }
      return created
    })
    return res.status(201).json(po)
  } catch (err) {
    logger.error({ msg: 'POST /api/v1/inventory/purchase-orders error', err })
    return res.status(500).json({ error: 'Failed to create purchase order' })
  }
})

// PATCH /api/v1/inventory/purchase-orders/:id
// Body: { status?, notes?, sentViaWhatsApp? }
router.patch('/api/v1/inventory/purchase-orders/:id', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string

    const existing = await prisma.purchaseOrder.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' })

    const { status, notes, sentViaWhatsApp } = req.body as Partial<{
      status:          string
      notes:           string
      sentViaWhatsApp: boolean
    }>

    const validStatuses = ['pending', 'ordered', 'received', 'cancelled']
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
    }

    // When marking as received, auto-restock the inventory quantities
    if (status === 'received' && existing.status !== 'received') {
      await prisma.$transaction(async (tx) => {
        for (const item of existing.items as any[]) {
          const stockItem = await tx.stockItem.findUnique({
            where: { cafeId_ingredientName: { cafeId, ingredientName: item.stockItemName } }
          })
          if (stockItem) {
            const newQty = stockItem.currentQty + item.quantityOrdered
            await tx.stockItem.update({
              where: { id: stockItem.id },
              data:  {
                currentQty:     newQty,
                isLow:          newQty < stockItem.minimumThreshold,
                lastRestockedAt: new Date()
              }
            })
          }
        }

        await tx.purchaseOrder.update({
          where: { id },
          data:  { status, ...(notes !== undefined && { notes }) }
        })

        await tx.systemNotification.create({
          data: {
            cafeId,
            type:    'PO_RECEIVED',
            title:   `Purchase Order Received`,
            body:    `Stock levels updated for ${existing.items.length} item(s). PO from ${(await tx.inventorySupplier.findUnique({ where: { id: existing.supplierId }, select: { name: true } }))?.name ?? 'supplier'}.`,
            refId:   id,
            refType: 'purchase_order'
          }
        })
      })
      const updated = await prisma.purchaseOrder.findFirst({ where: { id }, include: { supplier: true } })
      return res.json(updated)
    }

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data:  {
        ...(status          !== undefined && { status }),
        ...(notes           !== undefined && { notes }),
        ...(sentViaWhatsApp !== undefined && {
          sentViaWhatsApp,
          ...(sentViaWhatsApp && { sentAt: new Date() })
        })
      },
      include: { supplier: { select: { id: true, name: true, phone: true, email: true } } }
    })
    return res.json(po)
  } catch (err) {
    logger.error({ msg: 'PATCH /api/v1/inventory/purchase-orders/:id error', err })
    return res.status(500).json({ error: 'Failed to update purchase order' })
  }
})

// ─── SYSTEM NOTIFICATIONS ─────────────────────────────────────────────────────

// GET /api/v1/inventory/notifications
router.get('/api/v1/inventory/notifications', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const notifs = await prisma.systemNotification.findMany({
      where:   { cafeId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take:    50
    })
    return res.json(notifs)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// PATCH /api/v1/inventory/notifications/:id/read
router.patch('/api/v1/inventory/notifications/:id/read', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string

    const notif = await prisma.systemNotification.findFirst({ where: { id, cafeId } })
    if (!notif) return res.status(404).json({ error: 'Notification not found' })

    await prisma.systemNotification.update({ where: { id }, data: { isRead: true } })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark as read' })
  }
})

// POST /api/v1/inventory/notifications/read-all
router.post('/api/v1/inventory/notifications/read-all', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    await prisma.systemNotification.updateMany({ where: { cafeId, isRead: false }, data: { isRead: true } })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark all as read' })
  }
})

// ─── n8n WEBHOOK — low-stock trigger (called by n8n automation) ───────────────
// POST /api/v1/inventory/webhook/low-stock
// Body: { cafeId, stockItemId, ingredientName, currentQty, unit }
// No admin JWT — uses a shared secret header instead

router.post('/api/v1/inventory/webhook/low-stock', async (req: Request, res: Response) => {
  try {
    const secret = req.headers['x-webhook-secret']
    if (secret !== process.env.INVENTORY_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { cafeId, stockItemId, ingredientName, currentQty, unit } = req.body as {
      cafeId:        string
      stockItemId:   string
      ingredientName: string
      currentQty:    number
      unit:          string
    }

    // Log the external event for audit
    logger.info({ msg: 'inventory: external low-stock webhook received', cafeId, ingredientName, currentQty })

    // Optionally create a notification if not already created by the deduction service
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const existing = await prisma.systemNotification.findFirst({
      where: { cafeId, type: 'LOW_STOCK', refId: stockItemId, createdAt: { gte: today } }
    })
    if (!existing) {
      await prisma.systemNotification.create({
        data: {
          cafeId,
          type:    'LOW_STOCK',
          title:   `Low Stock Alert: ${ingredientName}`,
          body:    `External alert: only ${currentQty} ${unit} remaining.`,
          refId:   stockItemId,
          refType: 'stock_item'
        }
      })
    }

    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'inventory webhook error', err })
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// ─── ACTIVATION REQUEST (owner → superadmin approval flow) ────────────────────

// GET /api/v1/inventory/activation-status
// Returns current gate state + whether a request is already pending
router.get('/api/v1/inventory/activation-status', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe   = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: {
        isSmartInventoryEnabled:        true,
        inventoryActivationRequested:   true,
        inventoryActivationRequestedAt: true
      }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })
    return res.json(cafe)
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/v1/inventory/request-activation
// Restaurant owner requests the Smart Inventory module — pending superadmin approval
router.post('/api/v1/inventory/request-activation', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe   = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { isSmartInventoryEnabled: true, inventoryActivationRequested: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    if (cafe.isSmartInventoryEnabled) {
      return res.json({ ok: true, alreadyEnabled: true })
    }
    if (cafe.inventoryActivationRequested) {
      return res.json({ ok: true, alreadyRequested: true })
    }

    await prisma.cafe.update({
      where: { id: cafeId },
      data:  {
        inventoryActivationRequested:   true,
        inventoryActivationRequestedAt: new Date()
      }
    })

    logger.info({ msg: 'inventory activation requested', cafeId })
    return res.status(201).json({ ok: true, requested: true })
  } catch (err) {
    logger.error({ msg: 'request-activation error', err })
    return res.status(500).json({ error: 'Failed to submit request' })
  }
})

export default router
