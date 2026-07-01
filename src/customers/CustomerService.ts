// ─── CRM Foundation (K19) ───────────────────────────────────────────────────
// CafeCustomer (phone-keyed opt-in record) already exists — reused as the
// customer profile, not replaced. Order/visit history are derived from the
// existing Order model (Order.customerPhone) rather than duplicated into a
// second log. Loyalty points are read from the existing LoyaltyAccount.
// Genuinely new: tags, notes, favorite items, and admin-facing search.

import prisma from '../prisma'
import { publishStandardEvent } from '../core'

async function getCustomerOrThrow(cafeId: string, phone: string) {
  const customer = await prisma.cafeCustomer.findUnique({ where: { cafeId_phone: { cafeId, phone } } })
  if (!customer) throw new Error(`Customer ${phone} not found for cafe ${cafeId}`)
  return customer
}

// ─── Full profile: identity + derived order/visit history + loyalty ────────
export async function getCustomerProfile(cafeId: string, phone: string) {
  const [customer, orders, loyalty] = await Promise.all([
    getCustomerOrThrow(cafeId, phone),
    prisma.order.findMany({
      where:   { cafeId, customerPhone: phone },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, createdAt: true, totalPrice: true, status: true, isPaid: true },
    }),
    prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone } }, select: { points: true } }),
  ])

  // Visit history derived from order dates (one visit per calendar day with an order) —
  // avoids maintaining a separate, potentially-drifting visit log.
  const visitDays = [...new Set(orders.map(o => o.createdAt.toISOString().slice(0, 10)))].sort().reverse()

  return {
    customer,
    orderHistory: orders,
    visitHistory: visitDays,
    loyaltyPoints: loyalty?.points ?? 0,
  }
}

// ─── Search ───────────────────────────────────────────────────────────────
export async function searchCustomers(
  cafeId: string,
  filter: { search?: string; tag?: string; page?: number; limit?: number } = {},
) {
  const page  = Math.max(1, filter.page ?? 1)
  const limit = Math.min(100, filter.limit ?? 20)
  const skip  = (page - 1) * limit
  const s     = filter.search?.trim()

  const where = {
    cafeId,
    ...(filter.tag ? { tags: { has: filter.tag } } : {}),
    ...(s ? {
      OR: [
        { name:  { contains: s, mode: 'insensitive' as const } },
        { phone: { contains: s } },
      ],
    } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.cafeCustomer.findMany({ where, orderBy: { lastVisit: 'desc' }, skip, take: limit }),
    prisma.cafeCustomer.count({ where }),
  ])

  return { items, total, page, limit, pages: Math.ceil(total / limit) }
}

// ─── Tags ───────────────────────────────────────────────────────────────────
export async function addTag(cafeId: string, phone: string, tag: string) {
  const customer = await getCustomerOrThrow(cafeId, phone)
  if (customer.tags.includes(tag)) return customer

  const updated = await prisma.cafeCustomer.update({
    where: { cafeId_phone: { cafeId, phone } },
    data:  { tags: { push: tag } },
  })
  publishStandardEvent('CustomerTagged', { tenantId: cafeId, resourceId: customer.id, metadata: { phone, tag } }, 'customers')
  return updated
}

export async function removeTag(cafeId: string, phone: string, tag: string) {
  const customer = await getCustomerOrThrow(cafeId, phone)
  const updated = await prisma.cafeCustomer.update({
    where: { cafeId_phone: { cafeId, phone } },
    data:  { tags: customer.tags.filter(t => t !== tag) },
  })
  publishStandardEvent('CustomerUntagged', { tenantId: cafeId, resourceId: customer.id, metadata: { phone, tag } }, 'customers')
  return updated
}

// ─── Notes ───────────────────────────────────────────────────────────────────
export async function setNotes(cafeId: string, phone: string, notes: string) {
  const customer = await getCustomerOrThrow(cafeId, phone)
  const updated = await prisma.cafeCustomer.update({
    where: { cafeId_phone: { cafeId, phone } },
    data:  { notes },
  })
  publishStandardEvent('CustomerNoteUpdated', { tenantId: cafeId, resourceId: customer.id, metadata: { phone } }, 'customers')
  return updated
}

// ─── Favorite items ───────────────────────────────────────────────────────────
export async function addFavorite(cafeId: string, phone: string, productId: string) {
  const customer = await getCustomerOrThrow(cafeId, phone)
  if (customer.favoriteProductIds.includes(productId)) return customer

  const updated = await prisma.cafeCustomer.update({
    where: { cafeId_phone: { cafeId, phone } },
    data:  { favoriteProductIds: { push: productId } },
  })
  publishStandardEvent('CustomerFavoriteAdded', { tenantId: cafeId, resourceId: customer.id, metadata: { phone, productId } }, 'customers')
  return updated
}

export async function removeFavorite(cafeId: string, phone: string, productId: string) {
  const customer = await getCustomerOrThrow(cafeId, phone)
  const updated = await prisma.cafeCustomer.update({
    where: { cafeId_phone: { cafeId, phone } },
    data:  { favoriteProductIds: customer.favoriteProductIds.filter(id => id !== productId) },
  })
  publishStandardEvent('CustomerFavoriteRemoved', { tenantId: cafeId, resourceId: customer.id, metadata: { phone, productId } }, 'customers')
  return updated
}
