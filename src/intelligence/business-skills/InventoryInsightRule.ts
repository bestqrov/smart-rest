// ─── Business Skills Pack v1 — Inventory Insight Rule (K52) ────────────────
// Rule-based only, no LLM. Triggered on StockLow (K13 Inventory
// Intelligence, existing event) — reads StockItem, no new storage.

import prisma from '../../prisma'
import type { InsightRuleDefinition } from '../insights/types'

export const inventoryInsightRule: InsightRuleDefinition = {
  id:       'inventory-insight',
  name:     'Low Stock Insight',
  category: 'inventory',
  events:   ['StockLow'],
  async evaluate(event) {
    const tenantId = event.tenantId
    if (!tenantId) return null

    const lowItems = await prisma.stockItem.findMany({
      where:  { cafeId: tenantId, isLow: true },
      select: { ingredientName: true },
      take:   20,
    })

    if (lowItems.length === 0) return null

    return {
      category:    'inventory',
      severity:    lowItems.length >= 5 ? 'CRITICAL' : 'WARNING',
      title:       `${lowItems.length} ingredient(s) running low`,
      description: `Below minimum threshold: ${lowItems.map(i => i.ingredientName).join(', ')}.`,
      metadata:    { count: lowItems.length, ingredients: lowItems.map(i => i.ingredientName) },
    }
  },
}
