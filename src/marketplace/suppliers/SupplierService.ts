import type { MarketplaceSupplier, CreateSupplierInput, SupplierStatus } from '../types'
import { emitSupplierCreated } from '../events/MarketplaceEvents'

// ─── Map row → type ───────────────────────────────────────────────────────────

function toSupplier(row: any, productCount = 0): MarketplaceSupplier {
  return {
    id:           row.id,
    company:      row.company,
    contact:      row.contact,
    email:        row.email,
    phone:        row.phone ?? undefined,
    country:      row.country,
    rating:       row.rating,
    notes:        row.notes ?? undefined,
    status:       row.status as SupplierStatus,
    productCount,
    createdAt:    row.createdAt,
    updatedAt:    row.updatedAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createSupplier(input: CreateSupplierInput): Promise<MarketplaceSupplier> {
  const { default: prisma } = await import('../../prisma')

  const row = await (prisma as any).marketplaceSupplier.create({
    data: {
      company: input.company,
      contact: input.contact,
      email:   input.email,
      phone:   input.phone   ?? null,
      country: input.country,
      rating:  input.rating  ?? 3.0,
      notes:   input.notes   ?? null,
      status:  'ACTIVE',
    },
  })

  const supplier = toSupplier(row)
  emitSupplierCreated(supplier.id, supplier.company)
  return supplier
}

export async function updateSupplier(
  id:    string,
  patch: Partial<Omit<MarketplaceSupplier, 'id' | 'productCount' | 'createdAt' | 'updatedAt'>>,
): Promise<MarketplaceSupplier> {
  const { default: prisma } = await import('../../prisma')

  const data: Record<string, unknown> = {}
  if (patch.company !== undefined) data['company'] = patch.company
  if (patch.contact !== undefined) data['contact'] = patch.contact
  if (patch.email   !== undefined) data['email']   = patch.email
  if (patch.phone   !== undefined) data['phone']   = patch.phone
  if (patch.country !== undefined) data['country'] = patch.country
  if (patch.rating  !== undefined) data['rating']  = patch.rating
  if (patch.notes   !== undefined) data['notes']   = patch.notes
  if (patch.status  !== undefined) data['status']  = patch.status

  const row = await (prisma as any).marketplaceSupplier.update({ where: { id }, data })
  return toSupplier(row)
}

export async function getSupplier(id: string): Promise<MarketplaceSupplier | null> {
  const { default: prisma } = await import('../../prisma')

  const [row, productCount] = await Promise.all([
    (prisma as any).marketplaceSupplier.findUnique({ where: { id } }),
    (prisma as any).marketplaceProduct.count({ where: { supplierId: id, status: { not: 'ARCHIVED' } } }),
  ])

  return row ? toSupplier(row, productCount) : null
}

export async function getAllSuppliers(status?: SupplierStatus): Promise<MarketplaceSupplier[]> {
  const { default: prisma } = await import('../../prisma')

  const [rows, counts] = await Promise.all([
    (prisma as any).marketplaceSupplier.findMany({
      where:   status ? { status } : {},
      orderBy: { company: 'asc' },
    }),
    (prisma as any).marketplaceProduct.groupBy({
      by:     ['supplierId'],
      _count: { supplierId: true },
      where:  { supplierId: { not: null }, status: { not: 'ARCHIVED' } },
    }),
  ])

  const countMap = new Map<string, number>()
  for (const c of counts) {
    if (c.supplierId) countMap.set(c.supplierId, c._count.supplierId)
  }

  return rows.map((r: any) => toSupplier(r, countMap.get(r.id) ?? 0))
}

export async function setSupplierStatus(id: string, status: SupplierStatus): Promise<MarketplaceSupplier> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceSupplier.update({ where: { id }, data: { status } })
  return toSupplier(row)
}
