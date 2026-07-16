// ─── Smart Intelligence Notification Advisor — History (K56) ───────────────
// Thin pass-through to the existing core NotificationService — no second
// history store, no new query logic.

import { NotificationService } from '../../core'
import type { NotificationFilter } from '../../core'

export async function getIntelligenceNotificationHistory(tenantId: string, filter: NotificationFilter = {}) {
  return NotificationService.getNotifications(tenantId, filter)
}

export async function markIntelligenceNotificationRead(id: string): Promise<void> {
  return NotificationService.markRead(id)
}

export async function markAllIntelligenceNotificationsRead(tenantId: string): Promise<void> {
  return NotificationService.markAllRead(tenantId)
}

export async function countUnreadIntelligenceNotifications(tenantId: string): Promise<number> {
  return NotificationService.countUnread(tenantId)
}
