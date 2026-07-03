// ─── Smart Intelligence Notification Advisor — Priority Engine (K56) ───────
// Pure rule-based mapping — no scoring model, no AI.

import type { NotificationPriority } from './types'

const PRIORITY_ORDER: Record<NotificationPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 }

export function priorityAtLeast(a: NotificationPriority, b: NotificationPriority): boolean {
  return PRIORITY_ORDER[a] >= PRIORITY_ORDER[b]
}

export function priorityFromInsightSeverity(severity: string): NotificationPriority {
  switch (severity) {
    case 'CRITICAL': return 'URGENT'
    case 'WARNING':  return 'HIGH'
    default:         return 'MEDIUM'
  }
}

export function priorityFromRecommendationPriority(priority: string): NotificationPriority {
  if (priority === 'URGENT' || priority === 'HIGH' || priority === 'MEDIUM' || priority === 'LOW') return priority
  return 'MEDIUM'
}

export function priorityToNotificationLevel(priority: NotificationPriority): 'ERROR' | 'WARNING' | 'INFO' {
  if (priority === 'URGENT') return 'ERROR'
  if (priority === 'HIGH')   return 'WARNING'
  return 'INFO'
}
