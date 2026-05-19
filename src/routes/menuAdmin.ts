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
        hasExtendedTrial: true, totalSeats: true
      }
    })
    return res.json(cafe)
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

export default router
