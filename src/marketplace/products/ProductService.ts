import type {
  MarketplaceProduct, CreateProductInput, UpdateProductInput,
  ProductStatus,
} from '../types'
import { emitProductCreated, emitProductUpdated, emitProductArchived } from '../events/MarketplaceEvents'
import { createPricing } from '../pricing/PricingService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

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

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createProduct(input: CreateProductInput): Promise<MarketplaceProduct> {
  const { default: prisma } = await import('../../prisma')

  const slug = input.slug ?? toSlug(input.name)
  const row  = await (prisma as any).marketplaceProduct.create({
    data: {
      sku:              input.sku,
      name:             input.name,
      slug,
      description:      input.description,
      type:             input.type,
      categoryId:       input.categoryId,
      brand:            input.brand ?? null,
      status:           'DRAFT',
      visibility:       input.visibility ?? 'PRIVATE',
      images:           input.images ?? [],
      tags:             input.tags ?? [],
      metadata:         input.metadata ? JSON.stringify(input.metadata) : null,
      supportedModules: input.supportedModules ?? ['ALL'],
      supplierId:       input.supplierId ?? null,
    },
  })

  const product = toProduct(row)

  // Auto-create pricing if provided
  if (input.pricing) {
    await createPricing(product.id, input.pricing).catch(() => undefined)
  }

  emitProductCreated(product.id, product.sku, product.type, product.supportedModules)
  return product
}

export async function updateProduct(id: string, patch: UpdateProductInput): Promise<MarketplaceProduct> {
  const { default: prisma } = await import('../../prisma')

  const data: Record<string, unknown> = {}
  if (patch.name             !== undefined) data['name']             = patch.name
  if (patch.description      !== undefined) data['description']      = patch.description
  if (patch.categoryId       !== undefined) data['categoryId']       = patch.categoryId
  if (patch.brand            !== undefined) data['brand']            = patch.brand
  if (patch.visibility       !== undefined) data['visibility']       = patch.visibility
  if (patch.images           !== undefined) data['images']           = patch.images
  if (patch.tags             !== undefined) data['tags']             = patch.tags
  if (patch.metadata         !== undefined) data['metadata']         = JSON.stringify(patch.metadata)
  if (patch.supportedModules !== undefined) data['supportedModules'] = patch.supportedModules
  if (patch.supplierId       !== undefined) data['supplierId']       = patch.supplierId

  const row     = await (prisma as any).marketplaceProduct.update({ where: { id }, data })
  const product = toProduct(row)
  emitProductUpdated(product.id, patch as Record<string, unknown>)
  return product
}

export async function setProductStatus(id: string, status: ProductStatus): Promise<MarketplaceProduct> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceProduct.update({ where: { id }, data: { status } })
  const product = toProduct(row)
  if (status === 'ARCHIVED') emitProductArchived(id)
  else emitProductUpdated(id, { status })
  return product
}

export async function archiveProduct(id: string): Promise<void> {
  await setProductStatus(id, 'ARCHIVED')
}

export async function publishProduct(id: string): Promise<MarketplaceProduct> {
  return setProductStatus(id, 'ACTIVE')
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getProduct(id: string): Promise<MarketplaceProduct | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceProduct.findUnique({ where: { id } })
  return row ? toProduct(row) : null
}

export async function getProductBySku(sku: string): Promise<MarketplaceProduct | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceProduct.findUnique({ where: { sku } })
  return row ? toProduct(row) : null
}

export async function getProductsByCategory(categoryId: string): Promise<MarketplaceProduct[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).marketplaceProduct.findMany({
    where:   { categoryId, status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toProduct)
}

export async function getProductsByModule(module: string): Promise<MarketplaceProduct[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).marketplaceProduct.findMany({
    where: {
      status:           'ACTIVE',
      supportedModules: { has: module },
    },
    orderBy: { name: 'asc' },
  })
  return rows.map(toProduct)
}

export async function getProductsBySupplier(supplierId: string): Promise<MarketplaceProduct[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).marketplaceProduct.findMany({
    where:   { supplierId, status: { not: 'ARCHIVED' } },
    orderBy: { name: 'asc' },
  })
  return rows.map(toProduct)
}
