import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

// ─── Equipment CRUD ───────────────────────────────────────────────────────────

router.get('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  try {
    const equipment = await prisma.equipment.findMany({
      where: { cafeId },
      orderBy: { createdAt: 'desc' },
      include: {
        maintenanceRecords: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true, cost: true, nextServiceAt: true },
        },
        _count: { select: { maintenanceRecords: true } },
      },
    })
    return res.json({ items: equipment })
  } catch (err) {
    logger.error({ msg: 'equipment list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/summary/stats', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  try {
    const [equipment, maintenanceCosts] = await Promise.all([
      prisma.equipment.findMany({
        where: { cafeId },
        select: { id: true, status: true, purchasePrice: true, warrantyEndsAt: true },
      }),
      prisma.maintenanceRecord.aggregate({
        where: { cafeId },
        _sum: { cost: true },
      }),
    ])

    const now = new Date()
    const in30days = new Date(now.getTime() + 30 * 86400000)

    return res.json({
      total:          equipment.length,
      active:         equipment.filter(e => e.status === 'active').length,
      maintenance:    equipment.filter(e => e.status === 'maintenance').length,
      broken:         equipment.filter(e => e.status === 'broken').length,
      totalPurchaseValue: equipment.reduce((s, e) => s + (e.purchasePrice ?? 0), 0),
      totalMaintenanceCost: maintenanceCosts._sum.cost ?? 0,
      warrantyExpiringSoon: equipment.filter(e =>
        e.warrantyEndsAt && e.warrantyEndsAt > now && e.warrantyEndsAt < in30days
      ).length,
    })
  } catch (err) {
    logger.error({ msg: 'equipment summary error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const equipment = await prisma.equipment.findFirst({
      where: { id, cafeId },
      include: { maintenanceRecords: { orderBy: { date: 'desc' } } },
    })
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' })
    return res.json(equipment)
  } catch (err) {
    logger.error({ msg: 'equipment get error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const {
    name, category, brand, serialNumber, purchaseDate, purchasePrice,
    supplier, warrantyEndsAt, receiptUrl, photoUrl, status, notes,
  } = req.body as Record<string, any>

  if (!name || !category) {
    return res.status(400).json({ error: 'name and category are required' })
  }

  try {
    const equipment = await prisma.equipment.create({
      data: {
        cafeId,
        name,
        category,
        brand:          brand          ?? null,
        serialNumber:   serialNumber   ?? null,
        purchaseDate:   purchaseDate   ? new Date(purchaseDate)   : null,
        purchasePrice:  purchasePrice  != null ? Number(purchasePrice) : null,
        supplier:       supplier       ?? null,
        warrantyEndsAt: warrantyEndsAt ? new Date(warrantyEndsAt) : null,
        receiptUrl:     receiptUrl     ?? null,
        photoUrl:       photoUrl       ?? null,
        status:         status         ?? 'active',
        notes:          notes          ?? null,
      },
    })
    return res.status(201).json(equipment)
  } catch (err) {
    logger.error({ msg: 'equipment create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  const body = req.body as Record<string, any>

  try {
    const existing = await prisma.equipment.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Equipment not found' })

    const data: Record<string, any> = {}
    if (body.name          !== undefined) data.name          = body.name
    if (body.category      !== undefined) data.category      = body.category
    if (body.brand         !== undefined) data.brand         = body.brand
    if (body.serialNumber  !== undefined) data.serialNumber  = body.serialNumber
    if (body.purchaseDate  !== undefined) data.purchaseDate  = body.purchaseDate  ? new Date(body.purchaseDate)  : null
    if (body.purchasePrice !== undefined) data.purchasePrice = body.purchasePrice != null ? Number(body.purchasePrice) : null
    if (body.supplier      !== undefined) data.supplier      = body.supplier
    if (body.warrantyEndsAt !== undefined) data.warrantyEndsAt = body.warrantyEndsAt ? new Date(body.warrantyEndsAt) : null
    if (body.receiptUrl    !== undefined) data.receiptUrl    = body.receiptUrl
    if (body.photoUrl      !== undefined) data.photoUrl      = body.photoUrl
    if (body.status        !== undefined) data.status        = body.status
    if (body.notes         !== undefined) data.notes         = body.notes

    const equipment = await prisma.equipment.update({ where: { id }, data })
    // Security check: ensure updated equipment still belongs to requesting cafe
    if (equipment.cafeId !== cafeId) {
      throw new Error('Equipment does not belong to this cafe')
    }
    return res.json(equipment)
  } catch (err) {
    logger.error({ msg: 'equipment update error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const existing = await prisma.equipment.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Equipment not found' })
    await prisma.equipment.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'equipment delete error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Maintenance Records ──────────────────────────────────────────────────────

router.get('/:id/maintenance', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const equipment = await prisma.equipment.findFirst({ where: { id, cafeId } })
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' })
    const records = await prisma.maintenanceRecord.findMany({
      where: { equipmentId: id },
      orderBy: { date: 'desc' },
    })
    return res.json({ items: records })
  } catch (err) {
    logger.error({ msg: 'maintenance list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/maintenance', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  const {
    date, description, technicianName, technicianPhone,
    cost, receiptUrl, nextServiceAt,
  } = req.body as Record<string, any>

  if (!description) return res.status(400).json({ error: 'description is required' })

  try {
    const equipment = await prisma.equipment.findFirst({ where: { id, cafeId } })
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' })

    const record = await prisma.maintenanceRecord.create({
      data: {
        equipmentId:     id,
        cafeId,
        date:            date          ? new Date(date) : new Date(),
        description,
        technicianName:  technicianName  ?? null,
        technicianPhone: technicianPhone ?? null,
        cost:            cost           ? Number(cost) : 0,
        receiptUrl:      receiptUrl     ?? null,
        nextServiceAt:   nextServiceAt  ? new Date(nextServiceAt) : null,
      },
    })
    return res.status(201).json(record)
  } catch (err) {
    logger.error({ msg: 'maintenance create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:equipId/maintenance/:recordId', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const equipId   = req.params.equipId   as string
  const recordId  = req.params.recordId  as string
  try {
    const record = await prisma.maintenanceRecord.findFirst({
      where: { id: recordId, equipmentId: equipId, cafeId },
    })
    if (!record) return res.status(404).json({ error: 'Record not found' })
    await prisma.maintenanceRecord.delete({ where: { id: recordId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'maintenance delete error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
