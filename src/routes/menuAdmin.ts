import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import { getProductCatalog, resolveSelectedProducts } from '../onboarding/ProductCatalog'

const router = express.Router()

// ─── Categories ───────────────────────────────────────────────────────────────

router.get('/api/admin/categories', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cats = await prisma.category.findMany({
      where: { cafeId },
      orderBy: { order: 'asc' },
      include: { _count: { select: { products: true } } }
    })
    return res.json(cats)
  } catch (err) {
    logger.error({ msg: 'GET categories error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.post('/api/admin/categories', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { nameAr, nameEn, nameFr = '', nameEs = '', nameDe = '' } = req.body
    if (!nameAr || !nameEn) return res.status(400).json({ error: 'nameAr and nameEn required' })

    const last = await prisma.category.findFirst({ where: { cafeId }, orderBy: { order: 'desc' } })
    const cat = await prisma.category.create({
      data: { cafeId, nameAr, nameEn, nameFr, nameEs, nameDe, order: (last?.order ?? 0) + 1 }
    })
    return res.status(201).json(cat)
  } catch (err) {
    logger.error({ msg: 'POST category error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.put('/api/admin/categories/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string
    const { nameAr, nameEn, nameFr, nameEs, nameDe, order } = req.body

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing || existing.cafeId !== cafeId) return res.status(404).json({ error: 'Not found' })

    const cat = await prisma.category.update({
      where: { id },
      data: {
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(nameFr !== undefined && { nameFr }),
        ...(nameEs !== undefined && { nameEs }),
        ...(nameDe !== undefined && { nameDe }),
        ...(order !== undefined && { order })
      }
    })
    return res.json(cat)
  } catch (err) {
    logger.error({ msg: 'PUT category error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.delete('/api/admin/categories/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string
    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing || existing.cafeId !== cafeId) return res.status(404).json({ error: 'Not found' })
    await prisma.category.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── Products ─────────────────────────────────────────────────────────────────

router.get('/api/admin/products', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const categoryId = req.query.categoryId as string | undefined
    const products = await prisma.product.findMany({
      where: { category: { cafeId }, ...(categoryId ? { categoryId } : {}) },
      orderBy: { nameEn: 'asc' },
      include: { category: { select: { nameEn: true, nameAr: true } } }
    })
    return res.json(products)
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

router.post('/api/admin/products', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { categoryId, nameAr, nameEn, nameFr = '', nameEs = '', nameDe = '', description, price, imageUrl, costPrice, unitType } = req.body
    if (!categoryId || !nameAr || !nameEn || price === undefined) {
      return res.status(400).json({ error: 'categoryId, nameAr, nameEn, price required' })
    }
    const cat = await prisma.category.findUnique({ where: { id: String(categoryId) } })
    if (!cat || cat.cafeId !== cafeId) return res.status(403).json({ error: 'Category not yours' })

    const product = await prisma.product.create({
      data: { categoryId: String(categoryId), nameAr, nameEn, nameFr, nameEs, nameDe, description: description || null, price, imageUrl: imageUrl || null,
        costPrice: costPrice !== undefined && costPrice !== '' ? Number(costPrice) : null,
        unitType: unitType === 'WEIGHT' ? 'WEIGHT' : 'PIECE' }
    })
    return res.status(201).json(product)
  } catch (err) {
    logger.error({ msg: 'POST product error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.put('/api/admin/products/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string
    const existing = await prisma.product.findUnique({ where: { id }, include: { category: { select: { cafeId: true } } } })
    if (!existing || existing.category.cafeId !== cafeId) return res.status(404).json({ error: 'Not found' })

    const { nameAr, nameEn, nameFr, nameEs, nameDe, description, price, imageUrl, isAvailable, costPrice, unitType } = req.body
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(nameFr !== undefined && { nameFr }),
        ...(nameEs !== undefined && { nameEs }),
        ...(nameDe !== undefined && { nameDe }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(costPrice !== undefined && { costPrice: costPrice === '' || costPrice === null ? null : Number(costPrice) }),
        ...(unitType !== undefined && { unitType: unitType === 'WEIGHT' ? 'WEIGHT' : 'PIECE' }),
      }
    })

    // Broadcast live price change to POS and all QR menu customers of this cafe
    if (price !== undefined) {
      const io = req.app.get('io')
      if (io) {
        const pricePayload = { productId: id, price: product.price, cafeId }
        io.to(`room_${cafeId}`).emit('price_updated', pricePayload)
        io.to(`menu_room_${cafeId}`).emit('price_updated', pricePayload)
        logger.info({ msg: 'price_updated broadcast', productId: id, price: product.price, cafeId })
      }
    }

    return res.json(product)
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

router.delete('/api/admin/products/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id = req.params.id as string
    const existing = await prisma.product.findUnique({ where: { id }, include: { category: { select: { cafeId: true } } } })
    if (!existing || existing.category.cafeId !== cafeId) return res.status(404).json({ error: 'Not found' })
    await prisma.product.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── Cafe profile update (social links, logo) ─────────────────────────────────

router.put('/api/admin/cafe/profile', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { businessName, logoUrl, socialLinks, hasSocialShareAddon, lat, lng, accentColor, primaryFont, localIp, reservationsEnabled, googleMapsUrl, tripadvisorUrl, reEngagementMessage, reEngagementDays } = req.body
    const cafe = await prisma.cafe.update({
      where: { id: cafeId },
      data: {
        ...(businessName !== undefined && { businessName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(socialLinks !== undefined && { socialLinks }),
        ...(hasSocialShareAddon !== undefined && { hasSocialShareAddon }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        ...(accentColor !== undefined && { accentColor }),
        ...(primaryFont !== undefined && { primaryFont }),
        ...(localIp !== undefined && { localIp: localIp || null }),
        ...(reservationsEnabled !== undefined && { reservationsEnabled: Boolean(reservationsEnabled) }),
        ...(googleMapsUrl !== undefined && { googleMapsUrl: googleMapsUrl || null }),
        ...(tripadvisorUrl !== undefined && { tripadvisorUrl: tripadvisorUrl || null }),
        ...(reEngagementMessage !== undefined && { reEngagementMessage: reEngagementMessage || null }),
        ...(reEngagementDays !== undefined && { reEngagementDays: Number(reEngagementDays) }),
      }
    })
    return res.json(cafe)
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

router.get('/api/admin/cafe/profile', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: {
        id: true, name: true, businessName: true, subdomain: true,
        country: true, currency: true, logoUrl: true, lat: true, lng: true,
        socialLinks: true, hasSocialShareAddon: true, isActive: true,
        walletBalance: true, billingStatus: true, trialEndsAt: true,
        hasExtendedTrial: true, totalSeats: true, isProfileComplete: true,
        coffeeRefPrice: true, sandwichRefPrice: true,
        monthlyFee: true, subscriptionTier: true,
        accentColor: true, primaryFont: true, localIp: true,
        reservationsEnabled: true, isSmartInventoryEnabled: true,
        googleMapsUrl: true, tripadvisorUrl: true,
        reEngagementMessage: true, reEngagementDays: true
      }
    })
    return res.json(cafe)
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/admin/cafe/payment-config ──────────────────────────────────────
router.get('/api/admin/cafe/payment-config', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { paymentConfig: true, country: true },
    })
    const pc = (cafe?.paymentConfig ?? {}) as any
    return res.json({
      orangeMoneyNumber:     pc.orangeMoneyNumber     ?? '',
      mtnMoMoNumber:         pc.mtnMoMoNumber         ?? '',
      waveWallet:            pc.waveWallet             ?? '',
      moyasarPublishableKey: pc.moyasarPublishableKey  ?? '',
      stripePublishableKey:  pc.stripePublishableKey   ?? '',
      stripeAccountId:       pc.stripeAccountId        ?? '',
      whatsappNumber:        pc.whatsappNumber         ?? '',
      country:               cafe?.country ?? 'MA',
    })
  } catch (err) {
    logger.error({ msg: 'GET payment-config error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PUT /api/admin/cafe/payment-config ──────────────────────────────────────
router.put('/api/admin/cafe/payment-config', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const {
      orangeMoneyNumber,
      mtnMoMoNumber,
      waveWallet,
      moyasarPublishableKey,
      stripePublishableKey,
      stripeAccountId,
      whatsappNumber,
    } = req.body

    await prisma.cafe.update({
      where: { id: cafeId },
      data:  {
        paymentConfig: {
          orangeMoneyNumber:     orangeMoneyNumber     ?? '',
          mtnMoMoNumber:         mtnMoMoNumber         ?? '',
          waveWallet:            waveWallet            ?? '',
          moyasarPublishableKey: moyasarPublishableKey ?? '',
          stripePublishableKey:  stripePublishableKey  ?? '',
          stripeAccountId:       stripeAccountId       ?? '',
          whatsappNumber:        whatsappNumber        ?? '',
        },
      },
    })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'PUT payment-config error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/admin/menu/seed-demo — one-time demo menu for existing cafes ───

router.post('/api/admin/menu/seed-demo', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const existing = await prisma.category.count({ where: { cafeId } })
    if (existing > 0) return res.status(409).json({ error: 'Menu already has categories. Remove them first if you want to reset.' })

    const cats = [
      { nameEn: 'Hot Drinks',   nameAr: 'مشروبات ساخنة',   order: 1 },
      { nameEn: 'Cold Drinks',  nameAr: 'مشروبات باردة',    order: 2 },
      { nameEn: 'Main Dishes',  nameAr: 'الأطباق الرئيسية', order: 3 },
      { nameEn: 'Desserts',     nameAr: 'الحلويات',          order: 4 },
    ]
    type P = { cat: string; nameEn: string; nameAr: string; price: number; desc: string }
    const products: P[] = [
      { cat: 'Hot Drinks',  nameEn: 'Espresso',            nameAr: 'إسبريسو',          price: 18, desc: 'Strong single-shot espresso' },
      { cat: 'Hot Drinks',  nameEn: 'Cappuccino',          nameAr: 'كابتشينو',          price: 28, desc: 'Espresso with steamed milk foam' },
      { cat: 'Hot Drinks',  nameEn: 'Moroccan Mint Tea',   nameAr: 'أتاي مغربي',       price: 22, desc: 'Fresh mint green tea with sugar' },
      { cat: 'Cold Drinks', nameEn: 'Fresh Orange Juice',  nameAr: 'عصير برتقال طازج', price: 25, desc: 'Freshly squeezed oranges' },
      { cat: 'Cold Drinks', nameEn: 'Iced Latte',          nameAr: 'آيس لاتيه',        price: 35, desc: 'Cold espresso over milk and ice' },
      { cat: 'Cold Drinks', nameEn: 'Mineral Water',       nameAr: 'ماء معدني',         price: 12, desc: 'Still or sparkling' },
      { cat: 'Main Dishes', nameEn: 'Tajine Kefta',        nameAr: 'طاجين كفتة وبيض',  price: 90, desc: 'Spiced meatballs in tomato sauce with egg' },
      { cat: 'Main Dishes', nameEn: 'Chicken Couscous',    nameAr: 'كسكس بالدجاج',     price: 95, desc: 'Traditional couscous with 7 vegetables' },
      { cat: 'Main Dishes', nameEn: 'Chicken Burger',      nameAr: 'برغر دجاج',         price: 58, desc: 'Crispy chicken fillet with coleslaw and fries' },
      { cat: 'Main Dishes', nameEn: 'Harira Soup',         nameAr: 'حريرة',            price: 30, desc: 'Classic tomato, lentil & chickpea soup' },
      { cat: 'Desserts',    nameEn: 'Chebakia',            nameAr: 'شباكية',            price: 25, desc: 'Honey sesame pastry with orange blossom' },
      { cat: 'Desserts',    nameEn: 'Chocolate Lava Cake', nameAr: 'كيك الشوكولاتة',   price: 45, desc: 'Warm dark chocolate cake with molten centre' },
    ]

    const catMap: Record<string, string> = {}
    for (const c of cats) {
      const created = await prisma.category.create({ data: { cafeId, nameEn: c.nameEn, nameAr: c.nameAr, order: c.order } })
      catMap[c.nameEn] = created.id
    }
    let productCount = 0
    for (const p of products) {
      const categoryId = catMap[p.cat]
      if (!categoryId) continue
      await prisma.product.create({ data: { categoryId, nameEn: p.nameEn, nameAr: p.nameAr, description: p.desc, price: p.price, isAvailable: true } })
      productCount++
    }

    logger.info({ msg: 'Demo menu seeded', cafeId, productCount })
    return res.json({ message: `Demo menu created: ${cats.length} categories, ${productCount} products.` })
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/menu/seed-demo error', err })
    return res.status(500).json({ error: 'Failed to seed demo menu' })
  }
})

// ─── GET /api/admin/staff — list all staff for this cafe ─────────────────────

router.get('/api/admin/staff', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const staff = await prisma.staff.findMany({
      where:   { cafeId, isActive: true },
      select: {
        id: true, name: true, role: true, roles: true,
        pinDisplay: true, shiftStatus: true,
        clockInTime: true, isActive: true,
        assignedTables: { select: { id: true, tableNumber: true, zone: true } },
      },
      orderBy: [{ shiftStatus: 'asc' }, { name: 'asc' }],
    })

    // Count pending (unacknowledged) waiter notifications per assigned table set
    const tableIds = staff.flatMap(s => s.assignedTables.map(t => t.id))
    const pendingOrders = tableIds.length > 0
      ? await prisma.order.findMany({
          where: {
            cafeId,
            tableId: { in: tableIds },
            billStatus: 'OPENED',
          },
          select: { tableId: true, waiterNotification: true },
        })
      : []

    const pendingByTable = new Map<string, number>()
    for (const o of pendingOrders) {
      if (o.tableId && o.waiterNotification?.isActive) {
        pendingByTable.set(o.tableId, (pendingByTable.get(o.tableId) ?? 0) + 1)
      }
    }

    const result = staff.map(s => ({
      ...s,
      pendingAlerts: s.assignedTables.reduce((n, t) => n + (pendingByTable.get(t.id) ?? 0), 0),
    }))

    return res.json({ waiters: result })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/staff error', err })
    return res.status(500).json({ error: 'Failed to fetch staff' })
  }
})

// ─── POST /api/admin/staff — create a new staff member ────────────────────────

router.post('/api/admin/staff', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { name, role, pinCode, roles = [] } = req.body as {
      name: string; role: string; pinCode: string; roles?: string[]
    }

    if (!name?.trim())            return res.status(400).json({ error: 'name is required' })
    if (!/^\d{4,8}$/.test(pinCode)) return res.status(400).json({ error: 'pinCode must be 4 to 8 digits' })
    if (!['WAITER','CASHIER','SUPERVISOR'].includes(role)) return res.status(400).json({ error: 'invalid role' })

    const ALLOWED_EXTRA = ['WAITER','CASHIER','SUPERVISOR','BARISTA','COOK','BAKER','CLEANER','TECHNICIAN','DISHWASHER','RUNNER','DELIVERY','SECURITY']
    const cleanRoles = Array.isArray(roles) ? roles.filter(r => ALLOWED_EXTRA.includes(r)) : []

    const bcrypt = await import('bcrypt')
    const hashed = await bcrypt.default.hash(pinCode, 10)

    const staff = await prisma.staff.create({
      data: {
        cafeId,
        name:       name.trim(),
        role:       role as any,
        roles:      cleanRoles,
        pinCode:    hashed,
        pinDisplay: pinCode,
        isActive:   true,
      },
      select: { id: true, name: true, role: true, roles: true, shiftStatus: true, pinDisplay: true },
    })
    logger.info({ msg: 'staff created', staffId: staff.id, cafeId })
    return res.status(201).json(staff)
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/staff error', err })
    return res.status(500).json({ error: 'Failed to create staff member' })
  }
})

// ─── DELETE /api/admin/staff/:id — soft-delete a staff member ────────────────

router.delete('/api/admin/staff/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const staffId = String(req.params.id)
    const existing = await prisma.staff.findUnique({ where: { id: staffId } })
    if (!existing || existing.cafeId !== cafeId) return res.status(404).json({ error: 'Not found' })
    await prisma.staff.update({ where: { id: staffId }, data: { isActive: false } })
    logger.info({ msg: 'staff deactivated', staffId, cafeId })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE /api/admin/staff error', err })
    return res.status(500).json({ error: 'Failed to deactivate staff' })
  }
})

// ─── POST /api/admin/onboarding — complete initial setup ─────────────────────
//
// Body: {
//   businessName, logoUrl?, currency,
//   coffeeRefPrice, sandwichRefPrice,
//   zones: [{ name, tableCount }],
//   managerName, managerPin (4-8 alphanumeric characters)
// }

router.post('/api/admin/onboarding', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const {
      businessName, logoUrl, currency, country,
      coffeeRefPrice, sandwichRefPrice,
      zones,
      managerName, managerPin,
      tier,
    } = req.body as {
      businessName:      string
      logoUrl?:          string
      currency:          string
      country?:          string
      coffeeRefPrice:    number
      sandwichRefPrice:  number
      zones:             { name: string; tableCount: number }[]
      managerName:       string
      managerPin:        string
      tier?:             string
    }

    if (!businessName?.trim())                return res.status(400).json({ error: 'businessName is required' })
    if (!currency?.trim())                    return res.status(400).json({ error: 'currency is required' })
    if (!coffeeRefPrice || coffeeRefPrice < 0) return res.status(400).json({ error: 'coffeeRefPrice is required' })
    if (!sandwichRefPrice || sandwichRefPrice < 0) return res.status(400).json({ error: 'sandwichRefPrice is required' })
    if (!zones?.length)                       return res.status(400).json({ error: 'At least one zone is required' })
    if (!managerName?.trim())                 return res.status(400).json({ error: 'managerName is required' })
    if (!/^[a-zA-Z0-9]{4,8}$/.test(managerPin)) return res.status(400).json({ error: 'managerPin must be 4-8 alphanumeric characters' })

    const bcrypt = await import('bcrypt')
    const { randomUUID } = await import('crypto')

    // ── 1. Update cafe profile ─────────────────────────────────────────────────
    const totalTables = zones.reduce((s, z) => s + z.tableCount, 0)
    await prisma.cafe.update({
      where: { id: cafeId },
      data: {
        businessName:     businessName.trim(),
        name:             businessName.trim(),
        currency:         currency.trim().toUpperCase(),
        ...(country ? { country: country.trim().toUpperCase() } : {}),
        coffeeRefPrice:   Number(coffeeRefPrice),
        sandwichRefPrice: Number(sandwichRefPrice),
        totalSeats:       totalTables,
        ...(logoUrl ? { logoUrl: logoUrl.trim() } : {}),
        ...(tier === 'CAFE' || tier === 'RESTAURANT' ? { tier } : {}),
        isProfileComplete: true,
      },
    })

    // ── 2. Create tables per zone (skip if tables already exist) ──────────────
    // Tables start as inactive — manager must activate each one from the Tables page
    const existingTables = await prisma.table.count({ where: { cafeId } })
    if (existingTables === 0) {
      let tableNumber = 1
      await prisma.$transaction(async tx => {
        for (const zone of zones) {
          for (let i = 0; i < zone.tableCount; i++) {
            await tx.table.create({
              data: {
                cafeId,
                tableNumber: tableNumber++,
                zone:        zone.name.trim(),
                qrToken:     randomUUID(),
                isActive:    false,
              },
            })
          }
        }
      })
    }

    // ── 3. Create manager staff (idempotent — skip if SUPERVISOR already exists) ─
    const existingSupervisor = await prisma.staff.findFirst({
      where: { cafeId, role: 'SUPERVISOR' },
    })
    if (!existingSupervisor) {
      const hashed = await bcrypt.default.hash(managerPin, 10)
      await prisma.staff.create({
        data: {
          cafeId,
          name:     managerName.trim(),
          role:     'SUPERVISOR',
          pinCode:  hashed,
          isActive: true,
        },
      })
    }

    logger.info({ msg: 'onboarding complete', cafeId, totalTables })
    return res.json({ success: true, totalTables })
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/onboarding error', err })
    return res.status(500).json({ error: 'Onboarding failed' })
  }
})

// ─── Onboarding — suggested product catalog ────────────────────────────────────
// Country + business-type aware starter menu checklist. Read from
// src/onboarding/ProductCatalog.ts — no data duplicated here.

router.get('/api/admin/onboarding/product-catalog', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const country      = String(req.query.country ?? '')
    const businessType = String(req.query.businessType ?? '')
    if (!country || !businessType) {
      return res.status(400).json({ error: 'country and businessType query params are required' })
    }
    const categories = getProductCatalog(country, businessType)
    return res.json({ categories })
  } catch (err) {
    logger.error({ msg: 'GET onboarding product-catalog error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// Body: { country, businessType, selections: [{ categoryKey, productKeys: string[] }] }
// Re-resolves selections against the same server-side catalog (never
// trusts client-supplied names/prices) and creates Category + Product
// rows using the exact same Prisma calls as the manual menu-builder
// endpoints above — idempotent: skips a product if one with the same
// name already exists in that category for this cafe (safe to re-submit).
router.post('/api/admin/onboarding/apply-product-catalog', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { country, businessType, selections } = req.body as {
      country?:      string
      businessType?: string
      selections?:   { categoryKey: string; productKeys: string[] }[]
    }

    if (!country || !businessType || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: 'country, businessType and at least one selection are required' })
    }

    const resolved = resolveSelectedProducts(country, businessType, selections)
    if (resolved.length === 0) {
      return res.status(400).json({ error: 'No matching catalog items for the given selections' })
    }

    let createdCategories = 0
    let createdProducts   = 0

    for (const { category, products } of resolved) {
      let cat = await prisma.category.findFirst({ where: { cafeId, nameEn: category.nameEn } })
      if (!cat) {
        const last = await prisma.category.findFirst({ where: { cafeId }, orderBy: { order: 'desc' } })
        cat = await prisma.category.create({
          data: {
            cafeId, nameAr: category.nameAr, nameEn: category.nameEn, nameFr: category.nameFr,
            nameEs: '', nameDe: '', order: (last?.order ?? 0) + 1,
          },
        })
        createdCategories++
      }

      for (const product of products) {
        const existing = await prisma.product.findFirst({ where: { categoryId: cat.id, nameEn: product.nameEn } })
        if (existing) continue

        await prisma.product.create({
          data: {
            categoryId: cat.id, nameAr: product.nameAr, nameEn: product.nameEn, nameFr: product.nameFr,
            nameEs: '', nameDe: '', price: product.suggestedPrice ?? 0,
            unitType: product.unitType === 'WEIGHT' ? 'WEIGHT' : 'PIECE',
          },
        })
        createdProducts++
      }
    }

    logger.info({ msg: 'onboarding product catalog applied', cafeId, createdCategories, createdProducts })
    return res.json({ success: true, createdCategories, createdProducts })
  } catch (err) {
    logger.error({ msg: 'POST onboarding apply-product-catalog error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── Smart WiFi settings ──────────────────────────────────────────────────────

router.get('/api/admin/cafe/wifi', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { smartWifi: true }
    })
    return res.json(cafe?.smartWifi ?? { enabled: false, ssid: '', password: '', showAfterOrder: true })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/cafe/wifi error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.put('/api/admin/cafe/wifi', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { enabled, ssid, password, showAfterOrder } = req.body as {
      enabled?: boolean; ssid?: string; password?: string; showAfterOrder?: boolean
    }

    // Never store credentials with leading/trailing whitespace
    const cafe = await prisma.cafe.update({
      where: { id: cafeId },
      data: {
        smartWifi: {
          enabled:        enabled        ?? false,
          ssid:           (ssid          ?? '').trim(),
          password:       (password      ?? '').trim(),
          showAfterOrder: showAfterOrder ?? true
        }
      },
      select: { smartWifi: true }
    })
    logger.info({ msg: 'smartWifi updated', cafeId, enabled })
    return res.json(cafe.smartWifi)
  } catch (err) {
    logger.error({ msg: 'PUT /api/admin/cafe/wifi error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PATCH /api/admin/staff/:id/pin — update a staff member's PIN ─────────────

router.patch('/api/admin/staff/:id/pin', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id     = req.params['id'] as string
    const { pinCode } = req.body as { pinCode?: string }

    if (!pinCode || !/^\d{4,8}$/.test(pinCode)) {
      return res.status(400).json({ error: 'pinCode must be 4 to 8 digits' })
    }

    const staff = await prisma.staff.findUnique({ where: { id }, select: { cafeId: true } })
    if (!staff) return res.status(404).json({ error: 'Staff not found' })
    if (staff.cafeId !== cafeId) return res.status(403).json({ error: 'Forbidden' })

    const bcrypt = await import('bcrypt')
    const hashed = await bcrypt.default.hash(pinCode, 10)

    await prisma.staff.update({
      where: { id },
      data:  { pinCode: hashed, pinDisplay: pinCode }
    })

    logger.info({ msg: 'Staff PIN updated', cafeId, staffId: id })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'PATCH staff/:id/pin error', err })
    return res.status(500).json({ error: 'Failed to update PIN' })
  }
})

// ─── POST /api/admin/auth/change-password ────────────────────────────────────

router.post('/api/admin/auth/change-password', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.admin!
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const bcrypt = await import('bcrypt')
    const valid  = await bcrypt.default.compare(currentPassword, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

    const newHash = await bcrypt.default.hash(newPassword, 10)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } })

    logger.info({ msg: 'Admin password changed', userId })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'POST change-password error', err })
    return res.status(500).json({ error: 'Failed to change password' })
  }
})

// ─── GET /api/admin/attendance/pointage?month=YYYY-MM ────────────────────────
// Returns a monthly attendance grid: for each active staff member, which days
// they had at least one WaiterShift clockIn in the requested month.

router.get('/api/admin/attendance/pointage', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const monthParam = (req.query.month as string) ?? ''

    // Parse month — default to current month
    const ref = monthParam.match(/^\d{4}-\d{2}$/)
      ? new Date(`${monthParam}-01T00:00:00`)
      : new Date()
    const year  = ref.getFullYear()
    const month = ref.getMonth() // 0-based
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const start = new Date(year, month, 1)
    const end   = new Date(year, month + 1, 1)

    const [allStaff, shifts] = await Promise.all([
      prisma.staff.findMany({
        where:  { cafeId, isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
      prisma.waiterShift.findMany({
        where:   { cafeId, clockIn: { gte: start, lt: end } },
        select:  { staffId: true, clockIn: true, clockOut: true },
        orderBy: { clockIn: 'asc' },
      }),
    ])

    // Group shifts by staffId → day
    const shiftMap: Record<string, Record<number, { clockIn: Date; clockOut: Date | null }>> = {}
    for (const s of shifts) {
      const day = s.clockIn.getDate()
      if (!shiftMap[s.staffId]) shiftMap[s.staffId] = {}
      // keep earliest clock-in per day
      if (!shiftMap[s.staffId][day]) {
        shiftMap[s.staffId][day] = { clockIn: s.clockIn, clockOut: s.clockOut }
      }
    }

    const fmtTime = (d: Date | null) =>
      d ? d.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', hour12: false }) : null

    const staff = allStaff.map(m => {
      const dayMap = shiftMap[m.id] ?? {}
      const days: Record<number, { in: string; out: string | null }> = {}
      let totalDays = 0
      for (const [d, v] of Object.entries(dayMap)) {
        days[Number(d)] = { in: fmtTime(v.clockIn)!, out: fmtTime(v.clockOut) }
        totalDays++
      }
      return { id: m.id, name: m.name, role: m.role, days, totalDays }
    })

    return res.json({ year, month: month + 1, daysInMonth, staff })
  } catch (err) {
    logger.error({ msg: 'GET pointage error', err })
    return res.status(500).json({ error: 'Failed to fetch pointage' })
  }
})

export default router
