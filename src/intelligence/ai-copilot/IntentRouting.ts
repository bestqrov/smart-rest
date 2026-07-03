// ─── Smart Intelligence AI Chat Copilot Foundation — Intent Routing (K67) ──
// Rule-based keyword classification, deterministic and free — routing
// itself never calls the AI Provider Layer, only the eventual reply does.

import type { CopilotIntent } from './types'

const KEYWORDS: Record<Exclude<CopilotIntent, 'general' | 'business'>, string[]> = {
  inventory:   ['stock', 'inventory', 'ingredient', 'reorder', 'overstock', 'out of stock'],
  customer:    ['customer', 'churn', 'vip', 'retention', 'loyal'],
  marketing:   ['marketing', 'campaign', 'promo', 'promotion', 'email', 'whatsapp', 'social post'],
  reservation: ['reservation', 'booking', 'table', 'no-show', 'no show'],
  staff:       ['staff', 'employee', 'shift', 'overtime', 'waiter', 'productivity'],
  financial:   ['revenue', 'profit', 'expense', 'margin', 'cash flow', 'cashflow', 'financial'],
}

export function classifyIntent(message: string): CopilotIntent {
  const lower = message.toLowerCase()

  for (const [intent, keywords] of Object.entries(KEYWORDS) as [CopilotIntent, string[]][]) {
    if (keywords.some(k => lower.includes(k))) return intent
  }

  if (/summary|overview|health|how('?s| is) (my|the) business|priorit/.test(lower)) return 'business'
  return 'general'
}
