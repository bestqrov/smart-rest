// ─── Smart Intelligence Notification Advisor — Service (K56) ───────────────
// The one entrypoint for turning a rule-based Intelligence signal into a
// notification. Reuses the existing core NotificationService.createNotification
// as the sole write path — this module only decides whether/how to call it
// (preferences, quiet hours, dedupe, grouping), never a second persistence
// mechanism. No AI generation anywhere in this file.

import { NotificationService } from '../../core'
import { getNotificationPreferences } from './NotificationPreferenceStore'
import { isWithinQuietHours } from './QuietHours'
import { isDuplicateNotification, markNotificationSent } from './Deduplication'
import { groupNotificationCandidates } from './Grouping'
import { buildActionableMetadata } from './ActionableNotifications'
import { priorityAtLeast, priorityToNotificationLevel } from './NotificationPriorityEngine'
import type { IntelligenceNotificationInput, NotificationDispatchResult } from './types'

export async function notify(input: IntelligenceNotificationInput): Promise<NotificationDispatchResult> {
  const prefs = await getNotificationPreferences(input.tenantId)

  if (prefs.mutedCategories.includes(input.category)) {
    return { sent: false, reason: 'category muted' }
  }
  if (input.module && prefs.mutedModules.includes(input.module)) {
    return { sent: false, reason: 'module muted' }
  }
  if (!priorityAtLeast(input.priority, prefs.minPriority)) {
    return { sent: false, reason: 'below minimum priority' }
  }
  if (input.priority !== 'URGENT' && isWithinQuietHours(prefs.quietHours)) {
    return { sent: false, reason: 'quiet hours' }
  }

  const dedupeKey = input.dedupeKey ?? `${input.category}:${input.module ?? ''}:${input.entityId ?? input.title}`
  if (await isDuplicateNotification(input.tenantId, dedupeKey)) {
    return { sent: false, reason: 'duplicate' }
  }

  const notification = await NotificationService.createNotification({
    level:    priorityToNotificationLevel(input.priority),
    title:    input.title,
    message:  input.message,
    module:   input.module,
    entityId: input.entityId,
    targetId: input.tenantId,
    metadata: buildActionableMetadata(input),
  })

  await markNotificationSent(input.tenantId, dedupeKey)
  return { sent: true, notificationId: notification.id }
}

export async function notifyBatch(candidates: IntelligenceNotificationInput[]): Promise<NotificationDispatchResult[]> {
  const grouped = groupNotificationCandidates(candidates)
  const results: NotificationDispatchResult[] = []
  for (const candidate of grouped) {
    results.push(await notify(candidate))
  }
  return results
}
