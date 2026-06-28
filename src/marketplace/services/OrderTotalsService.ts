import type { OrderItem, OrderTotals } from '../types'

// ─── Calculate order totals from items ───────────────────────────────────────
// All math done in JS to avoid floating-point accumulation — round at end only.

export function calculateItemTotal(item: {
  quantity:  number
  unitPrice: number
  discount:  number  // percentage 0–100
  tax:       number  // percentage 0–100
}): number {
  const afterDiscount = item.unitPrice * (1 - item.discount / 100)
  const afterTax      = afterDiscount * (1 + item.tax / 100)
  return Math.round(afterTax * item.quantity * 100) / 100
}

export function calculateItemSubtotal(item: {
  quantity:  number
  unitPrice: number
}): number {
  return Math.round(item.quantity * item.unitPrice * 100) / 100
}

export function calculateOrderTotals(items: OrderItem[], orderDiscount = 0): OrderTotals {
  let subtotal = 0
  let taxSum   = 0

  for (const item of items) {
    const base   = item.quantity * item.unitPrice * (1 - item.discount / 100)
    const taxAmt = base * (item.tax / 100)
    subtotal += base
    taxSum   += taxAmt
  }

  const discountAmt = subtotal * (orderDiscount / 100)
  const taxOnNet    = (subtotal - discountAmt) * 0  // order-level tax not implemented — tax is per-item
  const total       = subtotal - discountAmt + taxSum

  return {
    subtotal: Math.round(subtotal    * 100) / 100,
    discount: Math.round(discountAmt * 100) / 100,
    tax:      Math.round(taxSum      * 100) / 100,
    total:    Math.round(total       * 100) / 100,
  }
}
