// ─── Smart Intelligence Notification Advisor — Actionable Notifications (K56) ─
// Attaches suggested next-step links into the existing notification
// metadata JSON — no new field, no new table.

import type { IntelligenceNotificationInput, NotificationAction } from './types'

const DEFAULT_DASHBOARD_ACTION: NotificationAction = {
  label: 'View Executive Dashboard',
  url:   '/api/superadmin/intelligence/executive-dashboard',
}

export function buildActionableMetadata(input: IntelligenceNotificationInput): Record<string, unknown> {
  const actions = input.actions && input.actions.length > 0 ? input.actions : [DEFAULT_DASHBOARD_ACTION]

  return {
    priority:  input.priority,
    category:  input.category,
    dedupeKey: input.dedupeKey,
    groupKey:  input.groupKey,
    actions,
    source:    'notification-advisor',
  }
}
