import type { OrderItem, AddItemInput } from '../types'
import { getProduct }      from '../products/ProductService'
import { getProductPricing } from '../pricing/PricingService'
import { calculateItemTotal, calculateItemSubtotal } from '../services/OrderTotalsService'

// ─── Map row → type ───────────────────────────────────────────────────────────

function toItem(row: any): OrderItem {
  return {
    id:        row.id,
    orderId:   row.orderId,
    productId: row.productId,
    sku:       row.sku,
    name:      row.name,
    quantity:  row.quantity,
    unitPrice: row.unitPrice,
    discount:  row.discount,
    tax:       row.tax,
    total:     row.total,
    metadata:  row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.createdAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function addItem(orderId: string, input: AddItemInput): Promise<OrderItem> {
  const { default: prisma } = await import('../../prisma')

  // Snapshot product name from catalogue (price may be explicitly passed or resolved)
  const product  = await getProduct(input.productId)
  if (!product) throw new Error(`Product not found: ${input.productId}`)

  // Resolve unit price: explicit input takes priority, else resolve from pricing
  let unitPrice = input.unitPrice
  if (unitPrice == null || unitPrice <= 0) {
    const pricing = await getProductPricing(input.productId)
    if (!pricing) throw new Error(`No pricing found for product ${input.productId}`)
    unitPrice = pricing.effectivePrice
  }

  const discount = input.discount ?? 0
  const tax      = input.tax      ?? 0
  const total    = calculateItemTotal({ quantity: input.quantity, unitPrice, discount, tax })

  const row = await (prisma as any).marketplaceOrderItem.create({
    data: {
      orderId,
      productId: input.productId,
      sku:       product.sku,
      name:      product.name,
      quantity:  input.quantity,
      unitPrice,
      discount,
      tax,
      total,
      metadata:  input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  return toItem(row)
}

export async function removeItem(itemId: string): Promise<void> {
  const { default: prisma } = await import('../../prisma')
  await (prisma as any).marketplaceOrderItem.delete({ where: { id: itemId } })
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).marketplaceOrderItem.findMany({
    where:   { orderId },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(toItem)
}

export async function clearOrderItems(orderId: string): Promise<void> {
  const { default: prisma } = await import('../../prisma')
  await (prisma as any).marketplaceOrderItem.deleteMany({ where: { orderId } })
}
