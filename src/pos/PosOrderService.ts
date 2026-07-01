// ─── POS Core Service (K11 Foundation) ─────────────────────────────────────
// Order lifecycle primitives for staff-entered POS orders: open, add/update/
// remove item, apply discount, calculate totals, close. Builds directly on
// the existing Order/OrderItem models (same ones used by the QR ordering
// flow in routes/orders.ts and routes/pos/orders.ts) — no parallel schema.
// Payment processing is delegated to the existing payment engine; this
// service never touches PaymentTransaction directly beyond calling it.

import prisma from '../prisma'
import logger from '../logger'
import { eventBus } from '../core'
import { createTransaction, markPaid } from '../payments/services/PaymentService'
import type { ProviderName, PaymentMethod as EnginePaymentMethod } from '../payments/types'

type OrderPaymentMethod = 'CASH' | 'CARD' | 'ONLINE'

export interface OpenOrderInput {
  cafeId:        string
  tableId?:      string
  customerPhone?: string
  staffId?:      string
  paymentMethod: OrderPaymentMethod
}

export interface AddItemInput {
  productId: string
  quantity:  number
  notes?:    string
}

export interface DiscountInput {
  type:  'PERCENT' | 'AMOUNT'
  value: number
}

export interface OrderTotals {
  subtotal:       number
  discountAmount: number
  totalPrice:     number
  itemCount:      number
}

// ─── Internal helpers ──────────────────────────────────────────────────────

async function getOrderOrThrow(orderId: string, cafeId: string) {
  const order = await prisma.order.findFirst({
    where:   { id: orderId, cafeId },
    include: { items: true },
  })
  if (!order) throw new Error(`Order ${orderId} not found for cafe ${cafeId}`)
  return order
}

// Same subtotal convention as routes/pos/orders.ts: sum(unitPrice * quantity).
function computeSubtotal(items: { unitPrice: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
}

function computeCommission(items: { unitPrice: number; quantity: number; commissionRate: number }[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity * i.commissionRate, 0)
}

// Recomputes totalPrice/totalCommission from live items and persists them.
async function recalcTotals(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where:   { id: orderId },
    include: { items: true },
  })
  const subtotal        = computeSubtotal(order.items)
  const totalCommission = computeCommission(order.items)
  const discountAmount  = order.discountAmount ?? 0
  const totalPrice      = Math.max(0, subtotal - discountAmount)

  return prisma.order.update({
    where:   { id: orderId },
    data:    { totalPrice, totalCommission },
    include: { items: true },
  })
}

// Order.paymentMethod ('CASH'|'CARD'|'ONLINE') → payment engine provider/method.
// Only MANUAL/CASH/BANK_TRANSFER are active providers; CARD/ONLINE are recorded
// as manual entries until a real gateway is wired up (see payments/providers/registry.ts).
function toPaymentEngineMethod(method: OrderPaymentMethod): { provider: ProviderName; method: EnginePaymentMethod } {
  switch (method) {
    case 'CASH':   return { provider: 'CASH',   method: 'CASH' }
    case 'CARD':   return { provider: 'MANUAL', method: 'CREDIT_CARD' }
    case 'ONLINE': return { provider: 'MANUAL', method: 'WALLET' }
  }
}

// ─── 1. Open order ──────────────────────────────────────────────────────────
export async function openOrder(input: OpenOrderInput) {
  const order = await prisma.order.create({
    data: {
      cafeId:        input.cafeId,
      tableId:       input.tableId,
      customerPhone: input.customerPhone,
      createdById:   input.staffId,
      paymentMethod: input.paymentMethod,
      orderSource:   'POS_MANUAL',
      billStatus:    'OPENED',
      status:        'PENDING',
      totalPrice:    0,
    },
    include: { items: true },
  })

  eventBus.publish('PosOrderOpened', {
    orderId: order.id, cafeId: order.cafeId, tableId: order.tableId, staffId: input.staffId,
  }, 'pos-core')

  return order
}

// ─── 2. Add item ─────────────────────────────────────────────────────────────
export async function addItem(orderId: string, cafeId: string, input: AddItemInput) {
  if (input.quantity <= 0) throw new Error('quantity must be greater than 0')
  await getOrderOrThrow(orderId, cafeId)

  const product = await prisma.product.findUnique({ where: { id: input.productId } })
  if (!product) throw new Error(`Product ${input.productId} not found`)

  const item = await prisma.orderItem.create({
    data: {
      orderId,
      productId:      input.productId,
      quantity:       input.quantity,
      notes:          input.notes,
      unitPrice:      product.price,
      commissionRate: product.commissionRate,
    },
  })

  await recalcTotals(orderId)

  eventBus.publish('PosOrderItemAdded', {
    orderId, cafeId, itemId: item.id, productId: input.productId, quantity: input.quantity,
  }, 'pos-core')

  return item
}

// ─── 3. Update item quantity ─────────────────────────────────────────────────
export async function updateItemQuantity(orderId: string, cafeId: string, itemId: string, quantity: number) {
  if (quantity <= 0) throw new Error('quantity must be greater than 0')
  await getOrderOrThrow(orderId, cafeId)

  const item = await prisma.orderItem.update({
    where: { id: itemId },
    data:  { quantity },
  })

  await recalcTotals(orderId)

  eventBus.publish('PosOrderItemUpdated', { orderId, cafeId, itemId, quantity }, 'pos-core')

  return item
}

// ─── 4. Remove item ──────────────────────────────────────────────────────────
export async function removeItem(orderId: string, cafeId: string, itemId: string): Promise<void> {
  await getOrderOrThrow(orderId, cafeId)
  await prisma.orderItem.delete({ where: { id: itemId } })
  await recalcTotals(orderId)

  eventBus.publish('PosOrderItemRemoved', { orderId, cafeId, itemId }, 'pos-core')
}

// ─── 5. Apply discount ───────────────────────────────────────────────────────
export async function applyDiscount(orderId: string, cafeId: string, discount: DiscountInput) {
  const order    = await getOrderOrThrow(orderId, cafeId)
  const subtotal = computeSubtotal(order.items)

  const discountAmount = discount.type === 'PERCENT'
    ? subtotal * Math.min(100, Math.max(0, discount.value)) / 100
    : Math.max(0, discount.value)

  await prisma.order.update({ where: { id: orderId }, data: { discountAmount } })
  return recalcTotals(orderId)
}

// ─── 6. Calculate totals ─────────────────────────────────────────────────────
export async function calculateTotals(orderId: string, cafeId: string): Promise<OrderTotals> {
  const order    = await getOrderOrThrow(orderId, cafeId)
  const subtotal = computeSubtotal(order.items)
  const discountAmount = order.discountAmount ?? 0

  return {
    subtotal,
    discountAmount,
    totalPrice: Math.max(0, subtotal - discountAmount),
    itemCount:  order.items.reduce((sum, i) => sum + i.quantity, 0),
  }
}

// ─── 7. Close order ───────────────────────────────────────────────────────────
// Delegates payment capture to the existing payment engine (PaymentService) —
// this function never mutates PaymentTransaction rows itself.
export async function closeOrder(
  orderId: string,
  cafeId:  string,
  input:   { paymentMethod?: OrderPaymentMethod; staffId?: string; printReceipt?: boolean },
) {
  const order = await getOrderOrThrow(orderId, cafeId)
  if (order.isPaid) throw new Error('Order is already paid')

  const method  = input.paymentMethod ?? order.paymentMethod
  const totals  = await calculateTotals(orderId, cafeId)
  const { provider, method: engineMethod } = toPaymentEngineMethod(method)

  const tx = await createTransaction({
    orderId, tenantId: cafeId, module: 'POS',
    provider, method: engineMethod, amount: totals.totalPrice,
  })
  await markPaid(tx.id)

  const billStatus = input.printReceipt ? 'CLOSED_PRINTED' : 'CLOSED_VIRTUAL'
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      isPaid:          true,
      paymentMethod:   method,
      billStatus,
      totalCommission: computeCommission(order.items),
      status:          'COMPLETED',
    },
    include: { items: true },
  })

  logger.info({ msg: '[PosOrderService] order closed', orderId, cafeId, staffId: input.staffId, totalPrice: totals.totalPrice })
  eventBus.publish('PosOrderClosed', {
    orderId, cafeId, staffId: input.staffId, totalPrice: totals.totalPrice, transactionId: tx.id,
  }, 'pos-core')

  return updated
}
