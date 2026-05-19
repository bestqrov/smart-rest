import express, { Request, Response } from 'express'
import verifyLocation from '../middleware/verifyLocation'
import prisma from '../prisma'

const router = express.Router()

async function getMenu(req: Request, res: Response) {
  try {
    const cafe = (req as any).cafe as { id: string; name: string }
    if (!cafe) return res.status(500).json({ error: 'Cafe not attached to request' })

    const tableToken = (req.header('x-table-token') as string) || (req.query.tableToken as string)
    if (!tableToken) return res.status(400).json({ error: 'Missing table token' })

    const table = await prisma.table.findUnique({ where: { qrToken: tableToken } })
    if (!table || table.cafeId !== cafe.id) {
      return res.status(404).json({ error: 'Table not found for this cafe' })
    }

    const categories = await prisma.category.findMany({
      where: { cafeId: cafe.id },
      orderBy: { order: 'asc' },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: { nameEn: 'asc' }
        }
      }
    })

    return res.json({ cafeId: cafe.id, tableId: table.id, cafe: { id: cafe.id, name: cafe.name }, categories })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch menu' })
  }
}

router.get('/:subdomain/menu', verifyLocation, getMenu)

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
