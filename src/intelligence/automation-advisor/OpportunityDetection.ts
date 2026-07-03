// ─── Smart Intelligence Automation Advisor — Opportunity Detection (K54) ───
// Reuses K31's persisted IntelligenceEventLog (replayEvents) — same idiom
// K51's ErrorAggregation/ProviderPerformanceMetrics already use — instead
// of a new recurrence tracker. A recurring IntelInsightCreated for the
// same ruleId is read as "this kept needing a human to notice it."

import { replayEvents } from '../EventPersistence'
import type { AutomationOpportunity } from './types'

const WINDOW_DAYS = 30
const MIN_OCCURRENCES = 3

export async function detectAutomationOpportunities(tenantId: string): Promise<AutomationOpportunity[]> {
  const events = await replayEvents({
    tenantId, eventName: 'IntelInsightCreated',
    from: new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000),
    limit: 500,
  })

  const byRule = new Map<string, { category: string; severities: string[] }>()
  for (const event of events) {
    const ruleId   = String(event.metadata['ruleId'] ?? 'unknown')
    const category = String(event.metadata['category'] ?? 'other')
    const severity = String(event.metadata['severity'] ?? 'INFO')
    const entry = byRule.get(ruleId) ?? { category, severities: [] }
    entry.severities.push(severity)
    byRule.set(ruleId, entry)
  }

  const opportunities: AutomationOpportunity[] = []
  for (const [ruleId, entry] of byRule) {
    if (entry.severities.length < MIN_OCCURRENCES) continue
    opportunities.push({
      ruleId, category: entry.category, occurrences: entry.severities.length, windowDays: WINDOW_DAYS,
      description: `"${ruleId}" fired ${entry.severities.length} times in the last ${WINDOW_DAYS} days — a recurring pattern worth automating.`,
      severities: [...new Set(entry.severities)],
    })
  }

  return opportunities.sort((a, b) => b.occurrences - a.occurrences)
}
