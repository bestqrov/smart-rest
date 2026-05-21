import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

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
    const { categoryId, nameAr, nameEn, nameFr = '', nameEs = '', nameDe = '', description, price, imageUrl } = req.body
    if (!categoryId || !nameAr || !nameEn || price === undefined) {
      return res.status(400).json({ error: 'categoryId, nameAr, nameEn, price required' })
    }
    const cat = await prisma.category.findUnique({ where: { id: String(categoryId) } })
    if (!cat || cat.cafeId !== cafeId) return res.status(403).json({ error: 'Category not yours' })

    const product = await prisma.product.create({
      data: { categoryId: String(categoryId), nameAr, nameEn, nameFr, nameEs, nameDe, description: description || null, price, imageUrl: imageUrl || null }
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

    const { nameAr, nameEn, nameFr, nameEs, nameDe, description, price, imageUrl, isAvailable } = req.body
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
        ...(isAvailable !== undefined && { isAvailable })
      }
    })
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
    const { businessName, logoUrl, socialLinks, hasSocialShareAddon, lat, lng } = req.body
    const cafe = await prisma.cafe.update({
      where: { id: cafeId },
      data: {
        ...(businessName !== undefined && { businessName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(socialLinks !== undefined && { socialLinks }),
        ...(hasSocialShareAddon !== undefined && { hasSocialShareAddon }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng })
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
        coffeeRefPrice: true, sandwichRefPrice: true
      }
    })
    return res.json(cafe)
  } catch (err) {
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
        id: true, name: true, role: true, shiftStatus: true,
        clockInTime: true, isActive: true,
        assignedTables: { select: { id: true, tableNumber: true, zone: true } },
      },
      orderBy: [{ shiftStatus: 'asc' }, { name: 'asc' }],
    })
    return res.json({ waiters: staff })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/staff error', err })
    return res.status(500).json({ error: 'Failed to fetch staff' })
  }
})

// ─── POST /api/admin/staff — create a new staff member ────────────────────────

router.post('/api/admin/staff', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { name, role, pinCode } = req.body as { name: string; role: string; pinCode: string }

    if (!name?.trim())          return res.status(400).json({ error: 'name is required' })
    if (!/^\d{4}$/.test(pinCode)) return res.status(400).json({ error: 'pinCode must be exactly 4 digits' })
    if (!['WAITER','CASHIER','SUPERVISOR'].includes(role)) return res.status(400).json({ error: 'invalid role' })

    const bcrypt = await import('bcrypt')
    const hashed = await bcrypt.default.hash(pinCode, 10)

    const staff = await prisma.staff.create({
      data: { cafeId, name: name.trim(), role: role as any, pinCode: hashed, isActive: true },
      select: { id: true, name: true, role: true, shiftStatus: true },
    })
    logger.info({ msg: 'staff created', staffId: staff.id, cafeId })
    return res.status(201).json(staff)
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/staff error', err })
    return res.status(500).json({ error: 'Failed to create staff member' })
  }
})

// ─── POST /api/admin/onboarding — complete initial setup ─────────────────────
//
// Body: {
//   businessName, logoUrl?, currency,
//   coffeeRefPrice, sandwichRefPrice,
//   zones: [{ name, tableCount }],
//   managerName, managerPin (4 digits)
// }

router.post('/api/admin/onboarding', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const {
      businessName, logoUrl, currency,
      coffeeRefPrice, sandwichRefPrice,
      zones,
      managerName, managerPin,
    } = req.body as {
      businessName:      string
      logoUrl?:          string
      currency:          string
      coffeeRefPrice:    number
      sandwichRefPrice:  number
      zones:             { name: string; tableCount: number }[]
      managerName:       string
      managerPin:        string
    }

    if (!businessName?.trim())                return res.status(400).json({ error: 'businessName is required' })
    if (!currency?.trim())                    return res.status(400).json({ error: 'currency is required' })
    if (!coffeeRefPrice || coffeeRefPrice < 0) return res.status(400).json({ error: 'coffeeRefPrice is required' })
    if (!sandwichRefPrice || sandwichRefPrice < 0) return res.status(400).json({ error: 'sandwichRefPrice is required' })
    if (!zones?.length)                       return res.status(400).json({ error: 'At least one zone is required' })
    if (!managerName?.trim())                 return res.status(400).json({ error: 'managerName is required' })
    if (!/^\d{4}$/.test(managerPin))          return res.status(400).json({ error: 'managerPin must be 4 digits' })

    const bcrypt = await import('bcrypt')
    const { randomUUID } = await import('crypto')

    // ── 1. Update cafe profile ─────────────────────────────────────────────────
    const totalTables = zones.reduce((s, z) => s + z.tableCount, 0)
    await prisma.cafe.update({
      where: { id: cafeId },
      data: {
        businessName:    businessName.trim(),
        name:            businessName.trim(),
        currency:        currency.trim().toUpperCase(),
        coffeeRefPrice:  Number(coffeeRefPrice),
        sandwichRefPrice: Number(sandwichRefPrice),
        totalSeats:      totalTables,
        ...(logoUrl ? { logoUrl: logoUrl.trim() } : {}),
        isProfileComplete: true,
      },
    })

    // ── 2. Create tables per zone (skip if tables already exist) ──────────────
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

export default router
