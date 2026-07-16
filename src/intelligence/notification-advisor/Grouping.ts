// ─── Smart Intelligence Notification Advisor — Grouping (K56) ──────────────
// Pure function: merges candidates sharing a groupKey into one notification
// before anything is sent — reduces notification volume for a burst of
// related signals (e.g. several low-stock insights in one evaluation pass).

import type { IntelligenceNotificationInput } from './types'
import { priorityAtLeast } from './NotificationPriorityEngine'

export function groupNotificationCandidates(candidates: IntelligenceNotificationInput[]): IntelligenceNotificationInput[] {
  const grouped = new Map<string, IntelligenceNotificationInput[]>()
  const ungrouped: IntelligenceNotificationInput[] = []

  for (const candidate of candidates) {
    if (!candidate.groupKey) { ungrouped.push(candidate); continue }
    const key = `${candidate.tenantId}:${candidate.groupKey}`
    const list = grouped.get(key) ?? []
    list.push(candidate)
    grouped.set(key, list)
  }

  const merged: IntelligenceNotificationInput[] = []
  for (const list of grouped.values()) {
    if (list.length === 1) { merged.push(list[0]!); continue }

    const highestPriority = list.reduce((top, c) => (priorityAtLeast(c.priority, top.priority) ? c : top), list[0]!)
    merged.push({
      ...highestPriority,
      title:   `${list.length} ${highestPriority.category} alerts`,
      message: list.map(c => `• ${c.title}`).join('\n'),
      actions: highestPriority.actions,
    })
  }

  return [...ungrouped, ...merged]
}
