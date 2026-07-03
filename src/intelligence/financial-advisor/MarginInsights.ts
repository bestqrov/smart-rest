// ─── Smart Intelligence Financial Advisor v1 — Margin Insights (K65) ───────
// Product has no direct cafeId (scoped via Category.cafeId) — query
// through that relation, same as the rest of the menu system already
// does. Prefers Recipe.calculatedCost (Smart_Costing, ingredient-based,
// same source K60's ConsumptionRate already trusts) and falls back to
// Product.costPrice (manual Level-1 costing) when no Smart_Costing
// recipe exists — no recomputation of either cost source.

import prisma from '../../prisma'
import type { MarginInsights, ProductMargin } from './types'

const LOW_MARGIN_THRESHOLD_PCT = 20

export async function getMarginInsights(tenantId: string, limit = 5): Promise<MarginInsights> {
  const products = await prisma.product.findMany({
    where:  { category: { cafeId: tenantId }, status: 'published' },
    select: {
      id: true, nameEn: true, price: true, costPrice: true,
      recipe: { select: { calculatedCost: true, costingMode: true } },
    },
  })

  const margins: ProductMargin[] = []
  for (const product of products) {
    const cost = product.recipe?.costingMode === 'Smart_Costing'
      ? product.recipe.calculatedCost
      : product.costPrice

    if (cost === null || cost === undefined || product.price <= 0) continue

    margins.push({
      productId: product.id, productName: product.nameEn, price: product.price, cost,
      marginPct: Math.round(((product.price - cost) / product.price) * 1000) / 10,
    })
  }

  if (margins.length === 0) {
    return { avgMarginPct: 0, bestMargin: null, worstMargin: null, lowMarginProducts: [] }
  }

  const sorted = [...margins].sort((a, b) => b.marginPct - a.marginPct)
  const avgMarginPct = Math.round((margins.reduce((sum, m) => sum + m.marginPct, 0) / margins.length) * 10) / 10

  return {
    avgMarginPct,
    bestMargin: sorted[0] ?? null,
    worstMargin: sorted[sorted.length - 1] ?? null,
    lowMarginProducts: margins.filter(m => m.marginPct < LOW_MARGIN_THRESHOLD_PCT).sort((a, b) => a.marginPct - b.marginPct).slice(0, limit),
  }
}
