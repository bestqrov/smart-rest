import { eventBus } from '../../core'
import type { MarketplaceBundle } from './types'

export async function listBundles(activeOnly = true): Promise<MarketplaceBundle[]> {
  const { default: prisma } = await import('../../prisma')
  const where = activeOnly ? { active: true } : {}
  return (prisma as any).marketplaceBundle.findMany({ where, orderBy: { createdAt: 'desc' } })
}

export async function getBundle(id: string): Promise<MarketplaceBundle | null> {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).marketplaceBundle.findUnique({ where: { id } })
}

export async function createBundle(data: {
  name: string
  slug: string
  description: string
  type: string
  bundlePrice: number
  currency?: string
  productIds: string[]
}): Promise<MarketplaceBundle> {
  const { default: prisma } = await import('../../prisma')

  // Compute savings from individual base prices
  let individualTotal = 0
  for (const pid of data.productIds) {
    const pricing = await (prisma as any).productPricing.findUnique({ where: { productId: pid } })
    if (pricing) individualTotal += pricing.basePrice
  }
  const savings = Math.max(0, individualTotal - data.bundlePrice)

  return (prisma as any).marketplaceBundle.create({
    data: { ...data, savings, currency: data.currency ?? 'MAD', active: true },
  })
}

export async function updateBundle(
  id: string,
  patch: Partial<{
    name: string
    description: string
    type: string
    bundlePrice: number
    active: boolean
    productIds: string[]
  }>,
): Promise<MarketplaceBundle> {
  const { default: prisma } = await import('../../prisma')

  // Recalculate savings when price or products change
  if (patch.bundlePrice !== undefined || patch.productIds !== undefined) {
    const current = await (prisma as any).marketplaceBundle.findUnique({ where: { id } })
    const productIds  = patch.productIds  ?? current.productIds
    const bundlePrice = patch.bundlePrice ?? current.bundlePrice
    let individualTotal = 0
    for (const pid of productIds) {
      const pricing = await (prisma as any).productPricing.findUnique({ where: { productId: pid } })
      if (pricing) individualTotal += pricing.basePrice
    }
    ;(patch as Record<string, unknown>).savings = Math.max(0, individualTotal - bundlePrice)
  }

  return (prisma as any).marketplaceBundle.update({ where: { id }, data: patch })
}

export async function trackBundleView(bundleId: string, tenantId: string): Promise<void> {
  eventBus.publish('BundleViewed', { bundleId, tenantId }, 'marketplace-ai')
}

// Default bundle templates — seeded on init
export const BUNDLE_SEEDS = [
  {
    name: 'Starter Pack',
    slug: 'starter-pack',
    description: 'حزمة البداية: كل ما تحتاجه لتشغيل مطعمك بكفاءة.',
    type: 'STARTER',
    bundlePrice: 1499,
    productIds: [],
  },
  {
    name: 'Restaurant Pro Pack',
    slug: 'restaurant-pro-pack',
    description: 'حزمة المطعم الاحترافي: أدوات متقدمة للمطاعم المتوسطة والكبيرة.',
    type: 'PRO',
    bundlePrice: 3299,
    productIds: [],
  },
  {
    name: 'POS Pack',
    slug: 'pos-pack',
    description: 'حزمة نقاط البيع: شاشة، طابعة، وقارئ بطاقات.',
    type: 'POS',
    bundlePrice: 2199,
    productIds: [],
  },
  {
    name: 'Kitchen Pack',
    slug: 'kitchen-pack',
    description: 'حزمة المطبخ: شاشة KDS، طابعة تذاكر، ومعدات المطبخ.',
    type: 'KITCHEN',
    bundlePrice: 1799,
    productIds: [],
  },
  {
    name: 'Premium AI Pack',
    slug: 'premium-ai-pack',
    description: 'حزمة الذكاء الاصطناعي المميزة: أدوات AI متقدمة لتحليل البيانات والتوصيات.',
    type: 'PREMIUM_AI',
    bundlePrice: 2499,
    productIds: [],
  },
]
