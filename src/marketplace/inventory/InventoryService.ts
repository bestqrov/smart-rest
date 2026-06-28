import type { ProductInventory, StockAdjustment } from '../types'
import { emitInventoryUpdated } from '../events/MarketplaceEvents'

// ─── Map row → type ───────────────────────────────────────────────────────────

function toInventory(row: any): ProductInventory {
  const available = Math.max(0, row.stock - row.reserved)
  return {
    id:                row.id,
    productId:         row.productId,
    stock:             row.stock,
    reserved:          row.reserved,
    available,
    lowStockThreshold: row.lowStockThreshold,
    isLowStock:        available <= row.lowStockThreshold,
    lastUpdated:       row.lastUpdated,
  }
}

// ─── Ensure inventory record exists ──────────────────────────────────────────

async function ensureInventory(productId: string): Promise<void> {
  const { default: prisma } = await import('../../prisma')
  const existing = await (prisma as any).productInventory.findUnique({ where: { productId } })
  if (!existing) {
    await (prisma as any).productInventory.create({
      data: { productId, stock: 0, reserved: 0, lowStockThreshold: 5 },
    })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getInventory(productId: string): Promise<ProductInventory | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).productInventory.findUnique({ where: { productId } })
  return row ? toInventory(row) : null
}

export async function setStock(productId: string, stock: number, threshold?: number): Promise<ProductInventory> {
  const { default: prisma } = await import('../../prisma')
  await ensureInventory(productId)

  const prev = await (prisma as any).productInventory.findUnique({ where: { productId } })
  const row  = await (prisma as any).productInventory.update({
    where: { productId },
    data:  {
      stock,
      ...(threshold !== undefined ? { lowStockThreshold: threshold } : {}),
    },
  })

  const inv = toInventory(row)
  emitInventoryUpdated(productId, prev?.stock ?? 0, stock, inv.available)
  return inv
}

export async function adjustStock(
  productId:  string,
  adjustment: StockAdjustment,
): Promise<ProductInventory> {
  const { default: prisma } = await import('../../prisma')
  await ensureInventory(productId)

  const current = await (prisma as any).productInventory.findUnique({ where: { productId } })
  const newStock = Math.max(0, (current?.stock ?? 0) + adjustment.delta)

  return setStock(productId, newStock)
}

export async function reserveStock(productId: string, qty: number): Promise<ProductInventory> {
  const { default: prisma } = await import('../../prisma')
  await ensureInventory(productId)

  const current   = await (prisma as any).productInventory.findUnique({ where: { productId } })
  const available = Math.max(0, (current?.stock ?? 0) - (current?.reserved ?? 0))

  if (available < qty) {
    throw new Error(`Insufficient stock for product ${productId}: ${available} available, ${qty} requested`)
  }

  const row = await (prisma as any).productInventory.update({
    where: { productId },
    data:  { reserved: (current?.reserved ?? 0) + qty },
  })

  return toInventory(row)
}

export async function releaseReservation(productId: string, qty: number): Promise<ProductInventory> {
  const { default: prisma } = await import('../../prisma')
  await ensureInventory(productId)

  const current = await (prisma as any).productInventory.findUnique({ where: { productId } })
  const newReserved = Math.max(0, (current?.reserved ?? 0) - qty)

  const row = await (prisma as any).productInventory.update({
    where: { productId },
    data:  { reserved: newReserved },
  })

  return toInventory(row)
}

export async function setLowStockThreshold(productId: string, threshold: number): Promise<ProductInventory> {
  const { default: prisma } = await import('../../prisma')
  await ensureInventory(productId)
  const row = await (prisma as any).productInventory.update({
    where: { productId },
    data:  { lowStockThreshold: threshold },
  })
  return toInventory(row)
}

export async function getLowStockProducts(): Promise<ProductInventory[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).productInventory.findMany()

  // filter in memory (MongoDB can't compare two fields in a where clause directly)
  const lowStock = rows
    .map(toInventory)
    .filter((inv: ProductInventory) => inv.isLowStock)

  return lowStock
}

export async function getAllInventory(): Promise<ProductInventory[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).productInventory.findMany({
    orderBy: { lastUpdated: 'desc' },
  })
  return rows.map(toInventory)
}
