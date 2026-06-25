import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

router.get('/summary/stats', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const items = await prisma.purchaseRequisition.findMany({
      where: { cafeId },
      select: { status: true, urgency: true, createdAt: true },
    })

    return res.json({
      pending:           items.filter(i => i.status === 'pending').length,
      urgentPending:     items.filter(i => i.status === 'pending' && i.urgency === 'urgent').length,
      ordered:           items.filter(i => i.status === 'ordered').length,
      receivedThisMonth: items.filter(i => i.status === 'received' && new Date(i.createdAt) >= startOfMonth).length,
      total:             items.length,
    })
  } catch (err) {
    logger.error({ msg: 'requisition stats error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { status, urgency } = req.query as { status?: string; urgency?: string }
  try {
    const items = await prisma.purchaseRequisition.findMany({
      where: {
        cafeId,
        ...(status  && status  !== 'all' ? { status }  : {}),
        ...(urgency && urgency !== 'all' ? { urgency } : {}),
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
    })
    return res.json({ items })
  } catch (err) {
    logger.error({ msg: 'requisition list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const {
    itemName, quantity, unit, estimatedPrice,
    urgency, requestedBy, notes,
  } = req.body as Record<string, any>

  if (!itemName || quantity == null || !requestedBy) {
    return res.status(400).json({ error: 'itemName, quantity and requestedBy are required' })
  }

  try {
    const item = await prisma.purchaseRequisition.create({
      data: {
        cafeId,
        itemName,
        quantity:       Number(quantity),
        unit:           unit           ?? 'units',
        estimatedPrice: estimatedPrice != null ? Number(estimatedPrice) : null,
        urgency:        urgency        ?? 'normal',
        requestedBy,
        notes:          notes          ?? null,
        status:         'pending',
      },
    })
    return res.status(201).json(item)
  } catch (err) {
    logger.error({ msg: 'requisition create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  const body = req.body as Record<string, any>

  try {
    const existing = await prisma.purchaseRequisition.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Requisition not found' })

    const data: Record<string, any> = {}
    if (body.itemName       !== undefined) data.itemName       = body.itemName
    if (body.quantity       !== undefined) data.quantity       = Number(body.quantity)
    if (body.unit           !== undefined) data.unit           = body.unit
    if (body.estimatedPrice !== undefined) data.estimatedPrice = body.estimatedPrice != null ? Number(body.estimatedPrice) : null
    if (body.urgency        !== undefined) data.urgency        = body.urgency
    if (body.requestedBy    !== undefined) data.requestedBy    = body.requestedBy
    if (body.notes          !== undefined) data.notes          = body.notes
    if (body.status         !== undefined) {
      data.status = body.status
      if (body.status === 'approved' && !existing.approvedAt) {
        data.approvedAt = new Date()
      }
    }

    const item = await prisma.purchaseRequisition.update({ where: { id }, data })
    return res.json(item)
  } catch (err) {
    logger.error({ msg: 'requisition update error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const existing = await prisma.purchaseRequisition.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Requisition not found' })
    await prisma.purchaseRequisition.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'requisition delete error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
