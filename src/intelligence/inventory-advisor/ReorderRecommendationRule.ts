// ─── Smart Intelligence Inventory Advisor v1 — Recommendation Rule (K60) ───
// Ties reorder suggestions into K35's Recommendation Engine — same
// "Foundation shipped zero business rules" gap K53 filled for
// opportunities, now filled for inventory. Reuses getReorderSuggestions
// as-is, no new calculation.

import { getReorderSuggestions } from './ReorderSuggestions'
import type { RecommendationRuleDefinition } from '../recommendations/types'

export const inventoryReorderRecommendationRule: RecommendationRuleDefinition = {
  id:       'inventory-reorder-recommendation',
  name:     'Inventory Reorder Recommendation',
  category: 'inventory',
  async evaluate(context) {
    const suggestions = await getReorderSuggestions(context.tenant.tenantId)
    if (suggestions.length === 0) return null

    const top = suggestions[0]!
    const score = top.reason === 'PREDICTED_OUT_OF_STOCK' ? 90 : 70

    return {
      category:    'inventory',
      title:       `Reorder ${suggestions.length} ingredient(s)`,
      description: `"${top.ingredientName}" needs ~${top.suggestedReorderQty}${top.unit} restocked (${top.reason === 'PREDICTED_OUT_OF_STOCK' ? 'predicted to run out soon' : 'below minimum threshold'}).`,
      score,
      metadata: { count: suggestions.length, suggestions: suggestions.slice(0, 5) },
    }
  },
}
