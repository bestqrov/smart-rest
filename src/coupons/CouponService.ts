// ─── Discount coupons ────────────────────────────────────────────────────────
// Restaurant-created codes (e.g. sent in a WhatsApp campaign) that guests type
// in the QR cart. The discount is ALWAYS computed server-side at order time;
// the preview endpoint is informational only.

import { Prisma } from '@prisma/client'
import prisma from '../prisma'

export type CouponType = 'PERCENT' | 'FIXED'

export type CouponErrorCode =
  | 'NOT_FOUND' | 'INACTIVE' | 'NOT_STARTED' | 'EXPIRED' | 'USED_UP' | 'MIN_ORDER'

export class CouponError extends Error {
  constructor(public code: CouponErrorCode, public minOrder?: number) { super(code) }
}

export function normalizeCode(code: unknown): string {
  return String(code ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

type CouponRow = {
  id: string; type: string; value: number; minOrder: number; maxDiscount: number | null
  maxUses: number | null; usedCount: number; startsAt: Date | null; endsAt: Date | null; isActive: boolean
}

/** Pure: validate a coupon against a subtotal and return the discount amount. */
export function evaluateCoupon(c: CouponRow, subtotal: number, now = new Date()): number {
  if (!c.isActive)                                  throw new CouponError('INACTIVE')
  if (c.startsAt && c.startsAt > now)               throw new CouponError('NOT_STARTED')
  if (c.endsAt && c.endsAt < now)                   throw new CouponError('EXPIRED')
  if (c.maxUses != null && c.usedCount >= c.maxUses) throw new CouponError('USED_UP')
  if (subtotal < c.minOrder)                        throw new CouponError('MIN_ORDER', c.minOrder)

  let discount = c.type === 'PERCENT'
    ? subtotal * Math.min(100, Math.max(0, c.value)) / 100
    : Math.max(0, c.value)
  if (c.type === 'PERCENT' && c.maxDiscount != null) discount = Math.min(discount, c.maxDiscount)
  discount = Math.min(discount, subtotal)
  return Math.round(discount * 100) / 100
}

export async function previewCoupon(cafeId: string, rawCode: string, subtotal: number) {
  const code   = normalizeCode(rawCode)
  const coupon = code ? await prisma.coupon.findUnique({ where: { cafeId_code: { cafeId, code } } }) : null
  if (!coupon) throw new CouponError('NOT_FOUND')
  return { code, type: coupon.type, value: coupon.value, discount: evaluateCoupon(coupon, subtotal) }
}

/**
 * Validate + consume one use, inside the caller's order-creation transaction.
 * The usage increment is guarded on the usedCount we read, so two guests
 * racing for the last use of a limited coupon can't both get it.
 */
export async function redeemCoupon(
  tx: Prisma.TransactionClient, cafeId: string, rawCode: string, subtotal: number,
): Promise<{ code: string; discount: number }> {
  const code = normalizeCode(rawCode)
  for (let attempt = 0; attempt < 3; attempt++) {
    const coupon = await tx.coupon.findUnique({ where: { cafeId_code: { cafeId, code } } })
    if (!coupon) throw new CouponError('NOT_FOUND')
    const discount = evaluateCoupon(coupon, subtotal)
    const claimed  = await tx.coupon.updateMany({
      where: { id: coupon.id, usedCount: coupon.usedCount },
      data:  { usedCount: { increment: 1 } },
    })
    if (claimed.count === 1) return { code, discount }
  }
  throw new CouponError('USED_UP')
}
