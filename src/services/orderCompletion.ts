/**
 * Shared COMPLETED-order pipeline — the exact sequence orders.ts already runs
 * when an order reaches COMPLETED (billing commission, inventory deduction,
 * best-effort loyalty). Every checkout path (customer orders, POS, POS
 * split-bill, waiter "served") must call this instead of re-implementing the
 * pipeline, so the three effects can never drift out of sync between paths.
 */

import { Prisma } from '@prisma/client'
import logger from '../logger'
import { applyOrderFee } from './billing'
import { deductInventoryForOrder } from './inventoryDeduction'
import { earnPoints } from '../loyalty/LoyaltyService'

// ─── completeOrderFinancials — call inside the same $transaction that sets
// order.status = 'COMPLETED' ─────────────────────────────────────────────────

export async function completeOrderFinancials(
  tx:         Prisma.TransactionClient,
  cafeId:     string,
  orderId:    string,
  orderTotal: number,
  country:    string,
  itemCount:  number
): Promise<void> {
  await applyOrderFee(tx, cafeId, orderId, orderTotal, country, false, itemCount)
  await deductInventoryForOrder(tx, cafeId, orderId)
}

// ─── awardLoyaltyBestEffort — call AFTER the transaction commits, never
// inside it. Awarding points must not undo a completed, already-paid order,
// so a loyalty-service failure here is logged and swallowed rather than
// turning a genuinely completed order into a 500. ────────────────────────────

export async function awardLoyaltyBestEffort(
  cafeId:        string,
  customerPhone: string | null | undefined,
  orderTotal:    number,
  orderId:       string
): Promise<void> {
  if (!customerPhone) return
  try {
    await earnPoints(cafeId, customerPhone, orderTotal, orderId)
  } catch (err) {
    logger.error({ msg: 'Order completion: loyalty earn failed', orderId, cafeId, err })
  }
}
