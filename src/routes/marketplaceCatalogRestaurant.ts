import { Router }  from 'express'
import jwt          from 'jsonwebtoken'
import * as RecommendationService from '../marketplace/ai/RecommendationService'
import * as BundleEngine          from '../marketplace/ai/BundleEngine'
import * as SmartAlerts           from '../marketplace/ai/SmartAlerts'
import { checkCompatibility }     from '../marketplace/ai/CompatibilityEngine'

const router = Router()

function authRestaurant(req: any): { cafeId: string; userId?: string } {
  const auth  = (req.headers.authorization as string | undefined) ?? ''
  const token = auth.replace('Bearer ', '')
  if (!token) throw new Error('No token')
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
  return { cafeId: String(payload.cafeId), userId: payload.userId ? String(payload.userId) : undefined }
}

// ─── Flag check ───────────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/flag', async (req, res) => {
  try {
    authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const flag = await (prisma as any).featureFlag.findUnique({ where: { key: 'marketplace' } })
    res.json({ enabled: flag?.status === 'enabled' })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Categories ───────────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/categories', async (req, res) => {
  try {
    authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const cats = await (prisma as any).marketplaceCategory.findMany({
      where: { active: true }, orderBy: { sortOrder: 'asc' },
    })
    res.json({ categories: cats })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Catalog list ─────────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/catalog', async (req, res) => {
  try {
    authRestaurant(req)
    const { search, categoryId, type, page = '1', limit = '20', featured, brand } =
      req.query as Record<string, string>
    const { default: prisma } = await import('../prisma')

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
      visibility: { in: ['PUBLIC', 'MODULE_ONLY'] },
    }
    if (search)     where.name       = { contains: search, mode: 'insensitive' }
    if (categoryId) where.categoryId = categoryId
    if (type)       where.type       = type
    if (brand)      where.brand      = { contains: brand, mode: 'insensitive' }
    if (featured === '1') where.tags = { has: 'featured' }

    const skip = (Number(page) - 1) * Number(limit)
    const [products, total] = await Promise.all([
      (prisma as any).marketplaceProduct.findMany({
        where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).marketplaceProduct.count({ where }),
    ])

    const enriched = await Promise.all(products.map(async (p: any) => {
      const [pricing, inv] = await Promise.all([
        (prisma as any).productPricing.findUnique({ where: { productId: p.id } }).catch(() => null),
        (prisma as any).productInventory.findUnique({ where: { productId: p.id } }).catch(() => null),
      ])
      const available = inv ? Math.max(0, inv.stock - inv.reserved) : 0
      return { ...p, pricing, inventory: inv ? { ...inv, available } : null }
    }))

    res.json({ products: enriched, total, page: Number(page), limit: Number(limit) })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Featured products ────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/featured', async (req, res) => {
  try {
    authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const products = await (prisma as any).marketplaceProduct.findMany({
      where: { status: 'ACTIVE', tags: { has: 'featured' } },
      take: 8, orderBy: { updatedAt: 'desc' },
    })
    const enriched = await Promise.all(products.map(async (p: any) => {
      const pricing = await (prisma as any).productPricing.findUnique({ where: { productId: p.id } }).catch(() => null)
      return { ...p, pricing }
    }))
    res.json({ products: enriched })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Recently added ───────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/recent', async (req, res) => {
  try {
    authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const products = await (prisma as any).marketplaceProduct.findMany({
      where: { status: 'ACTIVE', visibility: { in: ['PUBLIC', 'MODULE_ONLY'] } },
      take: 8, orderBy: { createdAt: 'desc' },
    })
    const enriched = await Promise.all(products.map(async (p: any) => {
      const pricing = await (prisma as any).productPricing.findUnique({ where: { productId: p.id } }).catch(() => null)
      return { ...p, pricing }
    }))
    res.json({ products: enriched })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Low stock deals ──────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/low-stock-deals', async (req, res) => {
  try {
    authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const invItems = await (prisma as any).productInventory.findMany({
      orderBy: { stock: 'asc' }, take: 20,
    })
    const productIds = invItems.map((i: any) => i.productId)
    const products   = await (prisma as any).marketplaceProduct.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE' },
    })
    const enriched = products.map((p: any) => {
      const inv = invItems.find((i: any) => i.productId === p.id)
      return { ...p, inventory: inv ? { ...inv, available: Math.max(0, inv.stock - inv.reserved) } : null }
    })
    res.json({ products: enriched })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Product detail ───────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/catalog/:id', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    const id   = String(req.params.id)
    const { default: prisma } = await import('../prisma')

    const product = await (prisma as any).marketplaceProduct.findUnique({ where: { id } })
    if (!product) return res.status(404).json({ error: 'Not found' })

    const [pricing, inv, supplier] = await Promise.all([
      (prisma as any).productPricing.findUnique({ where: { productId: id } }).catch(() => null),
      (prisma as any).productInventory.findUnique({ where: { productId: id } }).catch(() => null),
      product.supplierId
        ? (prisma as any).marketplaceSupplier.findUnique({ where: { id: product.supplierId } }).catch(() => null)
        : null,
    ])

    const available = inv ? Math.max(0, inv.stock - inv.reserved) : 0
    const isLow     = inv ? available <= inv.lowStockThreshold : false

    // Related products (same category)
    const related = await (prisma as any).marketplaceProduct.findMany({
      where: { categoryId: product.categoryId, id: { not: id }, status: 'ACTIVE' },
      take: 4,
    })

    // Compatibility check (restaurant always has RESTAURANT module)
    const compatibility = checkCompatibility(product, ['RESTAURANT', 'reservations', 'loyalty', 'marketing'])

    res.json({
      product: { ...product, pricing, inventory: inv ? { ...inv, available, isLow } : null, supplier },
      related,
      compatibility,
    })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Recommendations ──────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/recommendations', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    const { default: prisma } = await import('../prisma')

    const cafe   = await prisma.cafe.findUnique({ where: { id: auth.cafeId } }).catch(() => null)
    const orders = await (prisma as any).marketplaceOrder.findMany({
      where: { tenantId: auth.cafeId }, select: { id: true },
    })
    const orderIds = orders.map((o: any) => o.id)
    const items    = await (prisma as any).marketplaceOrderItem.findMany({
      where: { orderId: { in: orderIds } }, select: { productId: true },
    })

    const ctx = {
      tenantId:      auth.cafeId,
      restaurantType: (cafe as any)?.type ?? 'RESTAURANT',
      orderHistory:  [...new Set(items.map((i: any) => i.productId))] as string[],
      month:         new Date().getMonth() + 1,
    }

    const [recommendations, trending] = await Promise.all([
      RecommendationService.generateRecommendations(ctx, 8),
      RecommendationService.getTrending(4),
    ])

    // Fire-and-forget log
    for (const r of recommendations) {
      RecommendationService.logRecommendation(auth.cafeId, r.productId, r).catch(() => undefined)
    }

    res.json({ recommendations, trending })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

router.post('/api/restaurant/marketplace/recommendations/:logId/accept', async (req, res) => {
  try {
    authRestaurant(req)
    await RecommendationService.acceptRecommendation(String(req.params.logId))
    res.json({ ok: true })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

router.post('/api/restaurant/marketplace/recommendations/:logId/dismiss', async (req, res) => {
  try {
    authRestaurant(req)
    await RecommendationService.dismissRecommendation(String(req.params.logId))
    res.json({ ok: true })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Bundles ──────────────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/bundles', async (req, res) => {
  try {
    authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const bundles = await BundleEngine.listBundles(true)
    const enriched = await Promise.all(bundles.map(async (b: any) => {
      const products = await (prisma as any).marketplaceProduct.findMany({
        where: { id: { in: b.productIds } },
        select: { id: true, name: true, images: true },
      })
      return { ...b, products }
    }))
    res.json({ bundles: enriched })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

router.post('/api/restaurant/marketplace/bundles/:id/view', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    await BundleEngine.trackBundleView(String(req.params.id), auth.cafeId)
    res.json({ ok: true })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Smart Alerts ─────────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/alerts', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const cafe   = await prisma.cafe.findUnique({ where: { id: auth.cafeId } }).catch(() => null)
    const orders = await (prisma as any).marketplaceOrder.findMany({
      where: { tenantId: auth.cafeId, status: { in: ['APPROVED', 'FULFILLED'] } },
      select: { id: true },
    })
    const orderIds = orders.map((o: any) => o.id)
    const items    = await (prisma as any).marketplaceOrderItem.findMany({
      where: { orderId: { in: orderIds } }, select: { productId: true },
    })

    const ctx = {
      tenantId:           auth.cafeId,
      seats:              (cafe as any)?.seats ?? 0,
      certificationLevel: (cafe as any)?.certificationLevel,
      orderHistory:       [...new Set(items.map((i: any) => i.productId))] as string[],
      aiUsage:            true,
    }
    const alerts = await SmartAlerts.generateAlerts(ctx)
    res.json({ alerts })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Dashboard Widget ─────────────────────────────────────────────────────────

router.get('/api/restaurant/marketplace/widget', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    const { default: prisma } = await import('../prisma')

    const [pendingOrders, approvedOrders, recentOrders, aggResult, orders] = await Promise.all([
      (prisma as any).marketplaceOrder.count({ where: { tenantId: auth.cafeId, status: 'SUBMITTED' } }),
      (prisma as any).marketplaceOrder.count({ where: { tenantId: auth.cafeId, status: 'APPROVED' } }),
      (prisma as any).marketplaceOrder.findMany({
        where:    { tenantId: auth.cafeId },
        orderBy:  { createdAt: 'desc' },
        take:     5,
        select:   { id: true, orderNumber: true, status: true, total: true, createdAt: true },
      }),
      (prisma as any).marketplaceOrder.aggregate({
        where: { tenantId: auth.cafeId, status: { in: ['APPROVED', 'FULFILLED'] } },
        _sum:  { total: true },
      }),
      (prisma as any).marketplaceOrder.findMany({
        where:  { tenantId: auth.cafeId }, select: { id: true },
      }),
    ])

    const orderIds   = orders.map((o: any) => o.id)
    const items      = await (prisma as any).marketplaceOrderItem.findMany({
      where: { orderId: { in: orderIds } }, select: { productId: true },
    })
    const ctx = {
      tenantId:     auth.cafeId,
      orderHistory: [...new Set(items.map((i: any) => i.productId))] as string[],
    }
    const recommendations = await RecommendationService.generateRecommendations(ctx, 3)

    res.json({
      pendingOrders,
      approvedOrders,
      totalSpent:     aggResult._sum.total ?? 0,
      recentPurchases: recentOrders,
      recommendations,
    })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Marketplace Notifications (tenant-scoped) ───────────────────────────────
router.get('/api/restaurant/marketplace/notifications', async (req, res) => {
  try {
    const auth = authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    const notifications = await (prisma as any).coreNotification.findMany({
      where:   { module: 'MARKETPLACE', targetId: auth.cafeId },
      orderBy: { createdAt: 'desc' },
      take:    60,
    })
    res.json({ notifications })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

router.patch('/api/restaurant/marketplace/notifications/:id/read', async (req, res) => {
  try {
    authRestaurant(req)
    const { default: prisma } = await import('../prisma')
    await (prisma as any).coreNotification.update({
      where: { id: String(req.params.id) },
      data:  { read: true },
    })
    res.json({ ok: true })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

export default router
