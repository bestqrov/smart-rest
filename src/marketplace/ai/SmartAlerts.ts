import type { SmartAlert, RecommendationContext } from './types'

let counter = 0
function nextId() { return `alert-${Date.now()}-${++counter}` }

export async function generateAlerts(ctx: RecommendationContext): Promise<SmartAlert[]> {
  const { default: prisma } = await import('../../prisma')
  const alerts: SmartAlert[] = []

  // Alert 1 — Seats vs QR stands
  if (ctx.seats && ctx.seats > 0) {
    const qrProducts = await (prisma as any).marketplaceProduct.findMany({
      where: { tags: { has: 'qr' }, status: 'PUBLISHED' },
      take: 5,
    })
    if (qrProducts.length > 0) {
      // Count tenant's approved/fulfilled QR stand items from orders
      const orders = await (prisma as any).marketplaceOrder.findMany({
        where: { tenantId: ctx.tenantId, status: { in: ['APPROVED', 'FULFILLED'] } },
        select: { id: true },
      })
      const orderIds = orders.map((o: any) => o.id)
      const qrItems = await (prisma as any).marketplaceOrderItem.findMany({
        where: { orderId: { in: orderIds }, productId: { in: qrProducts.map((p: any) => p.id) } },
      })
      const qrOwned = qrItems.reduce((s: number, i: any) => s + i.quantity, 0)

      if (qrOwned < ctx.seats) {
        alerts.push({
          id: nextId(),
          severity: 'WARNING',
          title: qrOwned === 0 ? 'لا تملك حوامل QR' : 'حوامل QR غير كافية',
          message: `لديك ${ctx.seats} طاولة${qrOwned > 0 ? ` لكن فقط ${qrOwned} حامل QR` : ''}. اطلب ${ctx.seats - qrOwned} حامل إضافي.`,
          productId: qrProducts[0].id,
          actionLabel: 'عرض المنتج',
          actionUrl: `/admin/marketplace/products/${qrProducts[0].id}`,
        })
      }
    }
  }

  // Alert 2 — Certification upgrade path
  const upgradeMap: Record<string, { to: string; tagHint: string; tip: string }> = {
    SILVER:  { to: 'GOLD',     tagHint: 'kitchen',  tip: 'شاشة المطبخ يمكن أن تساعدك في الوصول إلى تصنيف GOLD' },
    GOLD:    { to: 'PLATINUM', tagHint: 'printer',  tip: 'طابعة Pro يمكن أن تساعدك في الوصول إلى تصنيف PLATINUM' },
    BRONZE:  { to: 'SILVER',   tagHint: 'pos',      tip: 'نظام POS يمكن أن يرفع تصنيفك إلى SILVER' },
  }
  if (ctx.certificationLevel) {
    const upgrade = upgradeMap[ctx.certificationLevel.toUpperCase()]
    if (upgrade) {
      const products = await (prisma as any).marketplaceProduct.findMany({
        where: { tags: { has: upgrade.tagHint }, status: 'PUBLISHED' },
        take: 1,
      })
      if (products.length > 0) {
        alerts.push({
          id: nextId(),
          severity: 'SUCCESS',
          title: `ارتقِ من ${ctx.certificationLevel} إلى ${upgrade.to}`,
          message: `مطعمك حاصل على تصنيف ${ctx.certificationLevel}. ${upgrade.tip}.`,
          productId: products[0].id,
          actionLabel: 'عرض المنتج',
          actionUrl: `/admin/marketplace/products/${products[0].id}`,
        })
      }
    }
  }

  // Alert 3 — Previously purchased items now low stock (re-order reminder)
  if (ctx.orderHistory && ctx.orderHistory.length > 0) {
    const lowStockItems = await (prisma as any).productInventory.findMany({
      where: { productId: { in: ctx.orderHistory }, stock: { lte: 3 } },
      take: 2,
    })
    for (const inv of lowStockItems) {
      const product = await (prisma as any).marketplaceProduct.findUnique({
        where: { id: inv.productId }, select: { id: true, name: true },
      })
      if (product) {
        alerts.push({
          id: nextId(),
          severity: 'WARNING',
          title: 'منتج تم شراؤه سابقاً — مخزون منخفض',
          message: `${product.name} متاح بكمية ${inv.stock} فقط. اطلب الآن لتجنب نفاد المخزون.`,
          productId: product.id,
          actionLabel: 'اطلب الآن',
          actionUrl: `/admin/marketplace/products/${product.id}`,
        })
      }
    }
  }

  // Alert 4 — AI modules installed but no AI product ordered
  if (ctx.aiUsage) {
    const aiProducts = await (prisma as any).marketplaceProduct.findMany({
      where: { tags: { has: 'ai' }, status: 'PUBLISHED' },
      take: 1,
    })
    const ordered = ctx.orderHistory ?? []
    if (aiProducts.length > 0 && !ordered.includes(aiProducts[0].id)) {
      alerts.push({
        id: nextId(),
        severity: 'INFO',
        title: 'أدوات الذكاء الاصطناعي',
        message: 'تستخدم وحدات AI في SmartSuite. اكتشف منتجاتنا للذكاء الاصطناعي لتعزيز أداء مطعمك.',
        productId: aiProducts[0].id,
        actionLabel: 'اكتشف الآن',
        actionUrl: `/admin/marketplace/products/${aiProducts[0].id}`,
      })
    }
  }

  return alerts
}
