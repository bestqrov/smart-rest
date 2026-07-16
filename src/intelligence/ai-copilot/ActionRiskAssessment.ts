// ─── Smart Intelligence AI Copilot — Action Risk Assessment (K69) ──────────
// Rule-based, category keyword driven — no execution history to learn
// from yet (zero executors registered), so this stays a simple, honest
// heuristic rather than a scoring model with no data behind it.

import type { ActionExecutorDefinition } from '../actions'

export type ActionRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

const HIGH_RISK_KEYWORDS = ['payment', 'refund', 'delete', 'charge', 'cancel-subscription']
const LOW_RISK_KEYWORDS  = ['notification', 'email', 'reminder', 'report']

export function assessActionRisk(executor: ActionExecutorDefinition): ActionRiskLevel {
  const category = executor.category.toLowerCase()

  if (HIGH_RISK_KEYWORDS.some(k => category.includes(k))) return 'HIGH'
  if (LOW_RISK_KEYWORDS.some(k => category.includes(k))) return 'LOW'
  return 'MEDIUM'
}
