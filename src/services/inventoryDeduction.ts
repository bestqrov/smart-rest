/**
 * Smart Inventory Deduction Service
 *
 * Called inside the existing DB transaction when an order status changes to COMPLETED.
 * Checks the feature gate, looks up each product's recipe, and atomically decrements
 * StockItem.currentQty for every ingredient consumed. Creates low-stock notifications
 * when any ingredient falls below its minimumThreshold.
 *
 * IMPORTANT: `tx` is a Prisma transaction client — all writes are part of the caller's
 * transaction so a failure here rolls back the entire order status update.
 */

import { Prisma } from '@prisma/client'
import logger from '../logger'

type TxClient = Prisma.TransactionClient

interface DeductionResult {
  deducted:     { ingredientName: string; qty: number; unit: string }[]
  lowStockItems: { id: string; ingredientName: string; currentQty: number; minimumThreshold: number }[]
  skipped:       string[]  // ingredient names with no matching StockItem
}

export async function deductInventoryForOrder(
  tx:      TxClient,
  cafeId:  string,
  orderId: string
): Promise<DeductionResult | null> {

  // ── Gate check ──────────────────────────────────────────────────────────────
  const cafe = await tx.cafe.findUnique({
    where:  { id: cafeId },
    select: { isSmartInventoryEnabled: true }
  })
  if (!cafe?.isSmartInventoryEnabled) return null

  // ── Fetch order items with their product IDs ────────────────────────────────
  const orderItems = await tx.orderItem.findMany({
    where:   { orderId },
    select:  { productId: true, quantity: true }
  })
  if (orderItems.length === 0) return null

  // ── Aggregate total ingredient quantities across all items in the order ──────
  // Map: ingredientName → total quantity needed (in grams/ml/pcs)
  const ingredientTotals = new Map<string, number>()

  for (const item of orderItems) {
    const recipe = await tx.recipe.findFirst({
      where:  { cafeId, productId: item.productId },
      select: { ingredients: true, costingMode: true }
    })
    if (!recipe || recipe.costingMode !== 'Smart_Costing') continue

    for (const ing of recipe.ingredients) {
      const prev = ingredientTotals.get(ing.ingredientName) ?? 0
      ingredientTotals.set(ing.ingredientName, prev + ing.quantityGramsOrMl * item.quantity)
    }
  }

  if (ingredientTotals.size === 0) return null

  const result: DeductionResult = { deducted: [], lowStockItems: [], skipped: [] }

  // ── Decrement each StockItem atomically ─────────────────────────────────────
  for (const [ingredientName, totalQty] of ingredientTotals.entries()) {
    const stockItem = await tx.stockItem.findUnique({
      where: { cafeId_ingredientName: { cafeId, ingredientName } }
    })

    if (!stockItem) {
      result.skipped.push(ingredientName)
      logger.warn({ msg: 'inventory: no StockItem for ingredient', cafeId, ingredientName })
      continue
    }

    const newQty   = Math.max(0, stockItem.currentQty - totalQty)
    const isNowLow = newQty < stockItem.minimumThreshold

    await tx.stockItem.update({
      where: { id: stockItem.id },
      data:  {
        currentQty: newQty,
        isLow:      isNowLow,
        updatedAt:  new Date()
      }
    })

    result.deducted.push({ ingredientName, qty: totalQty, unit: stockItem.unit })

    if (isNowLow) {
      result.lowStockItems.push({
        id:               stockItem.id,
        ingredientName,
        currentQty:       newQty,
        minimumThreshold: stockItem.minimumThreshold
      })

      // Create an in-app low-stock notification (idempotent — one per ingredient per day)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const existing = await tx.systemNotification.findFirst({
        where: {
          cafeId,
          type:    'LOW_STOCK',
          refId:   stockItem.id,
          createdAt: { gte: today }
        }
      })

      if (!existing) {
        await tx.systemNotification.create({
          data: {
            cafeId,
            type:    'LOW_STOCK',
            title:   `Low Stock: ${ingredientName}`,
            body:    `Only ${newQty.toFixed(1)} ${stockItem.unit} remaining (threshold: ${stockItem.minimumThreshold} ${stockItem.unit}). Consider placing a new purchase order.`,
            refId:   stockItem.id,
            refType: 'stock_item'
          }
        })
      }
    }
  }

  logger.info({
    msg:     'inventory: deduction complete',
    cafeId,
    orderId,
    deducted: result.deducted.length,
    lowStock: result.lowStockItems.length,
    skipped:  result.skipped.length
  })

  return result
}
