import type { ProductPricing, CreatePricingInput } from '../types'

// ─── Effective price calculation ──────────────────────────────────────────────

export function calculateEffectivePrice(pricing: {
  basePrice:         number
  discount?:         number | null
  promotionalPrice?: number | null
  taxRate:           number
}): number {
  // Explicit promotional price takes priority over % discount
  if (pricing.promotionalPrice != null) {
    return Math.round(pricing.promotionalPrice * 100) / 100
  }
  if (pricing.discount != null && pricing.discount > 0) {
    const discounted = pricing.basePrice * (1 - pricing.discount / 100)
    return Math.round(discounted * 100) / 100
  }
  return Math.round(pricing.basePrice * 100) / 100
}

export function calculateMargin(basePrice: number, costPrice: number): number {
  if (basePrice <= 0) return 0
  return Math.round(((basePrice - costPrice) / basePrice) * 10000) / 100
}

export function calculateWithTax(price: number, taxRate: number): number {
  return Math.round(price * (1 + taxRate / 100) * 100) / 100
}

// ─── Map row → type ───────────────────────────────────────────────────────────

function toPricing(row: any): ProductPricing {
  const basePrice = row.basePrice
  const cost      = row.costPrice ?? undefined

  return {
    id:               row.id,
    productId:        row.productId,
    basePrice,
    currency:         row.currency,
    discount:         row.discount ?? undefined,
    promotionalPrice: row.promotionalPrice ?? undefined,
    taxRate:          row.taxRate,
    costPrice:        cost,
    margin:           cost !== undefined ? calculateMargin(basePrice, cost) : undefined,
    effectivePrice:   calculateEffectivePrice(row),
    isActive:         row.isActive,
    validFrom:        row.validFrom ?? undefined,
    validTo:          row.validTo   ?? undefined,
    createdAt:        row.createdAt,
    updatedAt:        row.updatedAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createPricing(productId: string, input: CreatePricingInput): Promise<ProductPricing> {
  const { default: prisma } = await import('../../prisma')

  const row = await (prisma as any).productPricing.create({
    data: {
      productId,
      basePrice:        input.basePrice,
      currency:         input.currency ?? 'MAD',
      discount:         input.discount    ?? null,
      promotionalPrice: input.promotionalPrice ?? null,
      taxRate:          input.taxRate ?? 0,
      costPrice:        input.costPrice ?? null,
      validFrom:        input.validFrom ?? null,
      validTo:          input.validTo   ?? null,
    },
  })

  return toPricing(row)
}

export async function updatePricing(
  productId: string,
  patch:     Partial<CreatePricingInput>,
): Promise<ProductPricing> {
  const { default: prisma } = await import('../../prisma')

  const data: Record<string, unknown> = {}
  if (patch.basePrice         !== undefined) data['basePrice']         = patch.basePrice
  if (patch.currency          !== undefined) data['currency']          = patch.currency
  if (patch.discount          !== undefined) data['discount']          = patch.discount
  if (patch.promotionalPrice  !== undefined) data['promotionalPrice']  = patch.promotionalPrice
  if (patch.taxRate           !== undefined) data['taxRate']           = patch.taxRate
  if (patch.costPrice         !== undefined) data['costPrice']         = patch.costPrice
  if (patch.validFrom         !== undefined) data['validFrom']         = patch.validFrom
  if (patch.validTo           !== undefined) data['validTo']           = patch.validTo

  const row = await (prisma as any).productPricing.update({
    where: { productId },
    data,
  })

  return toPricing(row)
}

export async function getProductPricing(productId: string): Promise<ProductPricing | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).productPricing.findUnique({ where: { productId } })
  return row ? toPricing(row) : null
}

export async function isPricingValid(pricing: ProductPricing): Promise<boolean> {
  const now = new Date()
  if (pricing.validFrom && pricing.validFrom > now) return false
  if (pricing.validTo   && pricing.validTo   < now) return false
  return pricing.isActive
}
