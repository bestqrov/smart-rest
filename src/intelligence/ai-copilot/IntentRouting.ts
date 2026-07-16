// ─── Smart Intelligence AI Chat Copilot Foundation — Intent Routing (K67-K68) ─
// Rule-based keyword classification, deterministic and free — routing
// itself never calls the AI Provider Layer, only the eventual reply does.
// K68 adds: multi-intent detection (a question can touch more than one
// module) and follow-up resolution (an ambiguous message reuses the
// previous turn's intents instead of falling back to 'general').

import type { CopilotIntent } from './types'

const KEYWORDS: Record<Exclude<CopilotIntent, 'general' | 'business'>, string[]> = {
  inventory:   ['stock', 'inventory', 'ingredient', 'reorder', 'overstock', 'out of stock'],
  customer:    ['customer', 'churn', 'vip', 'retention', 'loyal'],
  marketing:   ['marketing', 'campaign', 'promo', 'promotion', 'email', 'whatsapp', 'social post'],
  reservation: ['reservation', 'booking', 'table', 'no-show', 'no show'],
  staff:       ['staff', 'employee', 'shift', 'overtime', 'waiter', 'productivity'],
  financial:   ['profit', 'expense', 'margin', 'cash flow', 'cashflow', 'financial'],
  executive:   ['briefing', 'top priorit', 'critical alert', 'cross-module', 'everything going on', 'overall'],
  sales:       ['sales', 'orders today', 'how many orders', 'best seller', 'best-seller', 'revenue'],
}

const FOLLOW_UP_PATTERN = /^(and|also|what about|what else|why|how come|ok(ay)?,?\s|more|continue)\b/i

function matchIntents(message: string): CopilotIntent[] {
  const lower = message.toLowerCase()
  const matched: CopilotIntent[] = []

  for (const [intent, keywords] of Object.entries(KEYWORDS) as [CopilotIntent, string[]][]) {
    if (keywords.some(k => lower.includes(k))) matched.push(intent)
  }

  if (matched.length === 0 && /summary|overview|health|how('?s| is) (my|the) business|priorit/.test(lower)) {
    matched.push('business')
  }

  return matched
}

// Single-intent classification, kept for backward compatibility with any
// existing caller — returns the first detected intent, or 'general'.
export function classifyIntent(message: string): CopilotIntent {
  return matchIntents(message)[0] ?? 'general'
}

// Multi-intent classification with follow-up resolution: if the message
// is short/ambiguous (matches FOLLOW_UP_PATTERN) or has no keyword match
// at all, and a previous turn's intents are known, reuse those instead
// of falling back to 'general' — same idea a human would use to keep a
// conversation on topic.
export function classifyIntents(message: string, previousIntents: CopilotIntent[] = []): CopilotIntent[] {
  const matched = matchIntents(message)
  if (matched.length > 0) return matched

  if (previousIntents.length > 0 && (FOLLOW_UP_PATTERN.test(message.trim()) || message.trim().split(/\s+/).length <= 4)) {
    return previousIntents
  }

  return ['general']
}
