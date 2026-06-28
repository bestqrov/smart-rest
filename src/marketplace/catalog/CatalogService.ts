import type {
  MarketplaceProduct, ProductFilter, ProductPage, ProductPricing,
} from '../types'
import { getProductPricing } from '../pricing/PricingService'
import { getInventory }      from '../inventory/InventoryService'

// ─── Map row → product ────────────────────────────────────────────────────────

function toProduct(row: any): MarketplaceProduct {
  return {
    id:               row.id,
    sku:              row.sku,
    name:             row.name,
    slug:             row.slug,
    description:      row.description,
    type:             row.type,
    categoryId:       row.categoryId,
    brand:            row.brand ?? undefined,
    status:           row.status,
    visibility:       row.visibility,
    images:           row.images ?? [],
    tags:             row.tags ?? [],
    metadata:         row.metadata ? JSON.parse(row.metadata) : {},
    supportedModules: row.supportedModules ?? [],
    supplierId:       row.supplierId ?? undefined,
    createdAt:        row.createdAt,
    updatedAt:        row.updatedAt,
  }
}

// ─── Build Prisma where clause from ProductFilter ─────────────────────────────

function buildWhere(filter: ProductFilter): Record<string, unknown> {
  const where: Record<string, unknown> = {}

  if (filter.categoryId)  where['categoryId']       = filter.categoryId
  if (filter.type)        where['type']             = filter.type
  if (filter.status)      where['status']           = filter.status
  else                    where['status']           = { not: 'ARCHIVED' }   // default: exclude archived
  if (filter.visibility)  where['visibility']       = filter.visibility
  if (filter.supplierId)  where['supplierId']       = filter.supplierId
  if (filter.module)      where['supportedModules'] = { has: filter.module }
  if (filter.tags && filter.tags.length > 0) {
    where['tags'] = { hasSome: filter.tags }
  }
  if (filter.search) {
    where['OR'] = [
      { name:        { contains: filter.search, mode: 'insensitive' } },
      { description: { contains: filter.search, mode: 'insensitive' } },
      { sku:         { contains: filter.search, mode: 'insensitive' } },
      { brand:       { contains: filter.search, mode: 'insensitive' } },
    ]
  }

  return where
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getProducts(filter: ProductFilter = {}): Promise<ProductPage> {
  const { default: prisma } = await import('../../prisma')

  const page  = Math.max(1, filter.page  ?? 1)
  const limit = Math.min(100, filter.limit ?? 20)
  const skip  = (page - 1) * limit
  const where = buildWhere(filter)

  const sortField = filter.sortBy ?? 'createdAt'
  const sortOrder = filter.sortOrder ?? 'desc'

  const [rows, total] = await Promise.all([
    (prisma as any).marketplaceProduct.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take:    limit,
    }),
    (prisma as any).marketplaceProduct.count({ where }),
  ])

  return {
    products: rows.map(toProduct),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function getProduct(id: string): Promise<MarketplaceProduct | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceProduct.findUnique({ where: { id } })
  return row ? toProduct(row) : null
}

export async function getProductBySlug(slug: string): Promise<MarketplaceProduct | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceProduct.findUnique({ where: { slug } })
  return row ? toProduct(row) : null
}

export async function search(query: string, limit = 20): Promise<MarketplaceProduct[]> {
  const result = await getProducts({ search: query, status: 'ACTIVE', limit })
  return result.products
}

export async function getCategories(onlyActive = true) {
  const { getAllCategories } = await import('../categories/CategoryService')
  return getAllCategories(onlyActive)
}

export async function getCategoryTree(onlyActive = true) {
  const { getCategoryTree: tree } = await import('../categories/CategoryService')
  return tree(onlyActive)
}

// Products with inStockOnly support (needs inventory join)
export async function filter(criteria: ProductFilter): Promise<ProductPage> {
  if (!criteria.inStockOnly) {
    return getProducts(criteria)
  }

  // Get page without stock filter first
  const allResult = await getProducts({ ...criteria, inStockOnly: false, limit: 1000 })

  // Filter by available stock
  const withStock: MarketplaceProduct[] = []
  for (const product of allResult.products) {
    const inv = await getInventory(product.id)
    if (inv && inv.available > 0) withStock.push(product)
  }

  const page  = criteria.page  ?? 1
  const limit = criteria.limit ?? 20
  const slice = withStock.slice((page - 1) * limit, page * limit)

  return {
    products: slice,
    total:    withStock.length,
    page,
    pages:    Math.ceil(withStock.length / limit),
  }
}

// Featured = ACTIVE + PUBLIC + highest-priority (first 8 by sortOrder/name)
export async function getFeatured(limit = 8): Promise<MarketplaceProduct[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).marketplaceProduct.findMany({
    where:   { status: 'ACTIVE', visibility: 'PUBLIC' },
    orderBy: [{ name: 'asc' }],
    take:    limit,
  })
  return rows.map(toProduct)
}

// Enrich product with pricing + inventory
export async function getProductWithDetails(id: string): Promise<{
  product:   MarketplaceProduct | null
  pricing:   ProductPricing | null
  inventory: Awaited<ReturnType<typeof getInventory>>
}> {
  const [product, pricing, inventory] = await Promise.all([
    getProduct(id),
    getProductPricing(id),
    getInventory(id),
  ])

  return { product, pricing, inventory }
}
