// ─── POS Core Service (K11 Foundation) ─────────────────────────────────────
// Order lifecycle primitives for staff-entered POS orders: open, add/update/
// remove item, apply discount, calculate totals, close. Builds directly on
// the existing Order/OrderItem models (same ones used by the QR ordering
// flow in routes/orders.ts and routes/pos/orders.ts) — no parallel schema.
// Payment processing is delegated to the existing payment engine; this
// service never touches PaymentTransaction directly beyond calling it.

import prisma from '../prisma'
import logger from '../logger'
import { eventBus, publishStandardEvent } from '../core'
import { createTransaction, markPaid } from '../payments/services/PaymentService'
import { deductInventoryForOrder } from '../services/inventoryDeduction'
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

  // Best-effort: payment already captured above, so a deduction failure here
  // must not undo the completed order — log and move on (existing
  // deductInventoryForOrder is a no-op when Smart Inventory isn't enabled).
  try {
    await prisma.$transaction(tx => deductInventoryForOrder(tx, cafeId, orderId))
  } catch (err) {
    logger.error({ msg: '[PosOrderService] inventory deduction failed', orderId, cafeId, err })
  }

  logger.info({ msg: '[PosOrderService] order closed', orderId, cafeId, staffId: input.staffId, totalPrice: totals.totalPrice })
  eventBus.publish('PosOrderClosed', {
    orderId, cafeId, staffId: input.staffId, totalPrice: totals.totalPrice, transactionId: tx.id,
  }, 'pos-core')

  return updated
}

// ─── 8. Hold / Resume order ───────────────────────────────────────────────────
// Parks an order without changing its workflow status/billStatus — orthogonal
// to both, so existing status-based queries elsewhere are unaffected.
export async function holdOrder(orderId: string, cafeId: string) {
  const order = await getOrderOrThrow(orderId, cafeId)
  if (order.isPaid) throw new Error('Cannot hold a paid order')
  if (order.heldAt) return order

  const updated = await prisma.order.update({ where: { id: orderId }, data: { heldAt: new Date() }, include: { items: true } })
  publishStandardEvent('PosOrderHeld', { tenantId: cafeId, resourceId: orderId, metadata: {} }, 'pos-core')
  return updated
}

export async function resumeOrder(orderId: string, cafeId: string) {
  await getOrderOrThrow(orderId, cafeId)
  const updated = await prisma.order.update({ where: { id: orderId }, data: { heldAt: null }, include: { items: true } })
  publishStandardEvent('PosOrderResumed', { tenantId: cafeId, resourceId: orderId, metadata: {} }, 'pos-core')
  return updated
}

// ─── 9. Order-level notes ────────────────────────────────────────────────────
// Distinct from AddItemInput.notes, which is already per-item.
export async function setOrderNotes(orderId: string, cafeId: string, notes: string) {
  await getOrderOrThrow(orderId, cafeId)
  const updated = await prisma.order.update({ where: { id: orderId }, data: { notes }, include: { items: true } })
  publishStandardEvent('PosOrderNotesUpdated', { tenantId: cafeId, resourceId: orderId, metadata: { notes } }, 'pos-core')
  return updated
}

// ─── 10. Split bill ───────────────────────────────────────────────────────────
// Moves a subset of an order's items into a brand-new order (same table/
// customer/staff/paymentMethod), recalculating totals on both. Distinct from
// routes/pos/checkoutBySeats.ts, which closes already-separate per-seat
// orders — this splits a single order's items after the fact.
export async function splitBill(orderId: string, cafeId: string, itemIds: string[]) {
  if (itemIds.length === 0) throw new Error('itemIds must not be empty')
  const order = await getOrderOrThrow(orderId, cafeId)
  if (order.isPaid) throw new Error('Cannot split a paid order')

  const itemsToMove = order.items.filter(i => itemIds.includes(i.id))
  if (itemsToMove.length === 0) throw new Error('None of the given itemIds belong to this order')
  if (itemsToMove.length === order.items.length) throw new Error('Cannot split all items — order would be left empty')

  const newOrder = await openOrder({
    cafeId,
    tableId:       order.tableId ?? undefined,
    customerPhone: order.customerPhone ?? undefined,
    staffId:       order.createdById ?? undefined,
    paymentMethod: order.paymentMethod as OrderPaymentMethod,
  })

  await prisma.orderItem.updateMany({
    where: { id: { in: itemsToMove.map(i => i.id) } },
    data:  { orderId: newOrder.id },
  })

  const [updatedOriginal, updatedNew] = await Promise.all([
    recalcTotals(orderId),
    recalcTotals(newOrder.id),
  ])

  publishStandardEvent('PosOrderSplit', {
    tenantId: cafeId, resourceId: orderId, metadata: { newOrderId: newOrder.id, movedItemIds: itemIds },
  }, 'pos-core')

  return { original: updatedOriginal, split: updatedNew }
}

// ─── 11. Merge orders ─────────────────────────────────────────────────────────
// Moves all items from source orders into a target order, then cancels the
// now-empty source orders. Distinct from table merge (routes/tables.ts,
// permanent/structural) and from pos/orders.ts's append-on-create — this
// combines already-separate, already-created orders.
export async function mergeOrders(cafeId: string, targetOrderId: string, sourceOrderIds: string[]) {
  const ids = sourceOrderIds.filter(id => id !== targetOrderId)
  if (ids.length === 0) throw new Error('sourceOrderIds must contain at least one order other than the target')

  const target = await getOrderOrThrow(targetOrderId, cafeId)
  if (target.isPaid) throw new Error('Cannot merge into a paid order')

  const sources = await prisma.order.findMany({ where: { id: { in: ids }, cafeId } })
  if (sources.length !== ids.length) throw new Error('One or more source orders not found for this cafe')
  if (sources.some(o => o.isPaid)) throw new Error('Cannot merge a paid order')

  await prisma.orderItem.updateMany({
    where: { orderId: { in: ids } },
    data:  { orderId: targetOrderId },
  })
  await prisma.order.updateMany({
    where: { id: { in: ids } },
    data:  { status: 'CANCELLED' },
  })

  const updated = await recalcTotals(targetOrderId)

  publishStandardEvent('PosOrdersMerged', {
    tenantId: cafeId, resourceId: targetOrderId, metadata: { mergedOrderIds: ids },
  }, 'pos-core')

  return updated
}

// ─── 12. Receipt reprint ──────────────────────────────────────────────────────
// API-first hook: returns the receipt data for an already-closed order and
// emits an event; no physical printer integration here.
export async function reprintReceipt(orderId: string, cafeId: string) {
  const order = await getOrderOrThrow(orderId, cafeId)
  if (!order.isPaid) throw new Error('Cannot reprint a receipt for an unpaid order')

  publishStandardEvent('PosReceiptReprinted', {
    tenantId: cafeId, resourceId: orderId, metadata: { totalPrice: order.totalPrice },
  }, 'pos-core')

  return order
}
