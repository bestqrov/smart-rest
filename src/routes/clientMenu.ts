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
        select: { name: true, isActive: true, logoUrl: true, currency: true, country: true, localIp: true, accentColor: true, primaryFont: true }
      }),
      prisma.category.findMany({
        where: { cafeId: table.cafeId },
        orderBy: { order: 'asc' },
        include: { products: { where: { isAvailable: true }, orderBy: { nameEn: 'asc' } } }
      })
    ])

    if (!cafe?.isActive) return res.status(403).json({ error: 'Venue is currently unavailable' })

    // Derive marketType from country (Africa + MENA = Local, rest = Global)
    const LOCAL_COUNTRIES = ['MA','SN','CI','MR','TN','DZ','LY','SD','NG','GH','KE','TZ','UG','ZM','CM','BJ','TG','ML','BF','NE','GN','SL','LR','GM','GW','MZ','AO','CD','CG','GA']
    const marketType = LOCAL_COUNTRIES.includes(cafe.country ?? 'MA') ? 'Local' : 'Global'

    return res.json({
      cafeName:    cafe.name,
      cafeLogoUrl: cafe.logoUrl,
      currency:    cafe.currency,
      accentColor: cafe.accentColor,
      primaryFont: cafe.primaryFont,
      country:     cafe.country,
      marketType,
      localIp:     cafe.localIp ?? null,
      categories,
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch menu' })
  }
})

// ─── GET /api/menu/wifi — return WiFi creds only after verified active order ──
// Security: tableToken proves the customer is physically at the table.
// An active OPENED order proves they placed an order (not just scanning).
// Password is never exposed until both conditions are satisfied.

router.get('/api/menu/wifi', async (req: Request, res: Response) => {
  try {
    const tableToken = req.query.tableToken as string | undefined
    if (!tableToken) return res.status(400).json({ error: 'tableToken required' })

    const table = await prisma.table.findFirst({
      where: { qrToken: tableToken, isActive: true },
      select: { id: true, cafeId: true }
    })
    if (!table) return res.status(404).json({ error: 'Invalid table token' })

    // Verify the customer has an active order — prevents credential scraping via QR
    const activeOrder = await prisma.order.findFirst({
      where: { tableId: table.id, billStatus: 'OPENED' },
      select: { id: true }
    })
    if (!activeOrder) return res.status(403).json({ error: 'No active order for this table' })

    const cafe = await prisma.cafe.findUnique({
      where: { id: table.cafeId },
      select: { smartWifi: true }
    })

    const wifi = cafe?.smartWifi
    if (!wifi?.enabled || !wifi.showAfterOrder || !wifi.ssid) {
      return res.status(404).json({ error: 'Smart WiFi not available for this venue' })
    }

    return res.json({ ssid: wifi.ssid, password: wifi.password })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

export default router
