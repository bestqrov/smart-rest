import { Router, Request, Response } from 'express'
import { getAllCategories }    from '../marketplace/categories/CategoryService'
import { getAllSuppliers }     from '../marketplace/suppliers/SupplierService'
import { getAllInventory, getLowStockProducts } from '../marketplace/inventory/InventoryService'
import { getOrders }           from '../marketplace/orders/OrderService'
import { getProductPricing }   from '../marketplace/pricing/PricingService'

const router = Router()

function requireSuperAdmin(req: Request, res: Response): boolean {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (secret !== process.env.SUPERADMIN_SECRET || !email) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

// GET /api/superadmin/marketplace/dashboard
router.get('/api/superadmin/marketplace/dashboard', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return

  try {
    const { default: prisma } = await import('../prisma')

    const [
      totalProducts,
      activeProducts,
      categories,
      suppliers,
      allInventory,
      lowStock,
      pendingOrders,
      recentOrdersPage,
      recentProducts,
    ] = await Promise.all([
      (prisma as any).marketplaceProduct.count({ where: { status: { not: 'ARCHIVED' } } }),
      (prisma as any).marketplaceProduct.count({ where: { status: 'ACTIVE' } }),
      getAllCategories(false),
      getAllSuppliers(),
      getAllInventory(),
      getLowStockProducts(),
      getOrders({ status: 'SUBMITTED', limit: 1 }),
      getOrders({ limit: 5 }),
      (prisma as any).marketplaceProduct.findMany({
        where:   { status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'desc' },
        take:    5,
        select:  { id: true, sku: true, name: true, type: true, status: true, createdAt: true },
      }),
    ])

    // Inventory value = sum(stock × unitPrice for active products with pricing)
    let inventoryValue = 0
    for (const inv of allInventory) {
      const pricing = await getProductPricing(inv.productId).catch(() => null)
      if (pricing) inventoryValue += inv.stock * pricing.basePrice
    }

    // Top categories by product count
    const categoryProductCounts = await (prisma as any).marketplaceProduct.groupBy({
      by:     ['categoryId'],
      _count: { categoryId: true },
      where:  { status: { not: 'ARCHIVED' } },
      orderBy: { _count: { categoryId: 'desc' } },
      take:   5,
    })
    const catMap = new Map(categories.map(c => [c.id, c.name]))
    const topCategories = categoryProductCounts.map((r: any) => ({
      categoryId:   r.categoryId,
      categoryName: catMap.get(r.categoryId) ?? 'Unknown',
      productCount: r._count.categoryId,
    }))

    res.json({
      stats: {
        totalProducts,
        activeProducts,
        totalCategories: categories.length,
        totalSuppliers:  suppliers.length,
        totalOrders:     recentOrdersPage.total,
        pendingOrders:   pendingOrders.total,
        lowStock:        lowStock.length,
        inventoryValue:  Math.round(inventoryValue * 100) / 100,
      },
      recentOrders:   recentOrdersPage.orders,
      recentProducts,
      topCategories,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
