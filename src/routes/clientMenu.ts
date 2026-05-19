import express, { Request, Response } from 'express'
import prisma from '../prisma'

const router = express.Router()

// ─── GET /api/menu/public — public menu by tableId (used by customer QR page) ─

router.get('/api/menu/public', async (req: Request, res: Response) => {
  try {
    const tableId = req.query.tableId as string
    if (!tableId) return res.status(400).json({ error: 'tableId required' })

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      select: { cafeId: true, isActive: true }
    })
    if (!table || !table.isActive) return res.status(404).json({ error: 'Table not found' })

    const [cafe, categories] = await Promise.all([
      prisma.cafe.findUnique({
        where: { id: table.cafeId },
        select: { name: true, isActive: true, logoUrl: true, currency: true }
      }),
      prisma.category.findMany({
        where: { cafeId: table.cafeId },
        orderBy: { order: 'asc' },
        include: { products: { where: { isAvailable: true }, orderBy: { nameEn: 'asc' } } }
      })
    ])

    if (!cafe?.isActive) return res.status(403).json({ error: 'Venue is currently unavailable' })

    return res.json({ cafeName: cafe.name, cafeLogoUrl: cafe.logoUrl, currency: cafe.currency, categories })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch menu' })
  }
})

export default router
