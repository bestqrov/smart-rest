// ─── Smart Intelligence Inventory Advisor v1 — Consumption Rate (K60) ──────
// The single ingredient-usage calculation every detector below reuses — no
// duplicate aggregation. Mirrors the exact join
// (Order -> OrderItem -> Recipe, Smart_Costing only) that
// services/inventoryDeduction.ts already uses per-order, summed here over
// a historical window instead of one order.

import prisma from '../../prisma'
import type { IngredientConsumption, StockItemMovement } from './types'

const DEFAULT_WINDOW_DAYS = 14

export async function computeIngredientConsumption(
  tenantId: string, windowDays = DEFAULT_WINDOW_DAYS,
): Promise<Map<string, IngredientConsumption>> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const orderItems = await prisma.orderItem.findMany({
    where:  { order: { cafeId: tenantId, status: 'COMPLETED', createdAt: { gte: since } } },
    select: { productId: true, quantity: true },
  })
  if (orderItems.length === 0) return new Map()

  const productIds = [...new Set(orderItems.map(i => i.productId))]
  const recipes = await prisma.recipe.findMany({
    where:  { cafeId: tenantId, productId: { in: productIds }, costingMode: 'Smart_Costing' },
    select: { productId: true, ingredients: true },
  })
  const recipeByProduct = new Map(recipes.map(r => [r.productId, r.ingredients]))

  const totals = new Map<string, number>()
  for (const item of orderItems) {
    const ingredients = recipeByProduct.get(item.productId)
    if (!ingredients) continue
    for (const ing of ingredients) {
      totals.set(ing.ingredientName, (totals.get(ing.ingredientName) ?? 0) + ing.quantityGramsOrMl * item.quantity)
    }
  }

  const result = new Map<string, IngredientConsumption>()
  for (const [ingredientName, totalQty] of totals) {
    result.set(ingredientName, { ingredientName, totalQty, avgDailyQty: totalQty / windowDays })
  }
  return result
}

export async function getStockItemMovement(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<StockItemMovement[]> {
  const [consumption, stockItems] = await Promise.all([
    computeIngredientConsumption(tenantId, windowDays),
    prisma.stockItem.findMany({ where: { cafeId: tenantId } }),
  ])

  return stockItems.map(item => ({
    id: item.id, ingredientName: item.ingredientName, unit: item.unit,
    currentQty: item.currentQty, minimumThreshold: item.minimumThreshold, isLow: item.isLow,
    avgDailyQty: consumption.get(item.ingredientName)?.avgDailyQty ?? 0,
  }))
}
