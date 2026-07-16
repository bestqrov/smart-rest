// ─── Smart Intelligence Notification Advisor — Public API (K56) ────────────

export type {
  NotificationPriority, NotificationAction, IntelligenceNotificationInput,
  QuietHoursConfig, NotificationPreferences, NotificationDispatchResult,
} from './types'

export {
  priorityAtLeast, priorityFromInsightSeverity, priorityFromRecommendationPriority, priorityToNotificationLevel,
} from './NotificationPriorityEngine'

export { getNotificationPreferences, setNotificationPreferences } from './NotificationPreferenceStore'

export { isWithinQuietHours } from './QuietHours'

export { isDuplicateNotification, markNotificationSent } from './Deduplication'

export { groupNotificationCandidates } from './Grouping'

export { buildActionableMetadata } from './ActionableNotifications'

export {
  getIntelligenceNotificationHistory, markIntelligenceNotificationRead,
  markAllIntelligenceNotificationsRead, countUnreadIntelligenceNotifications,
} from './NotificationHistoryService'

export { notify, notifyBatch } from './IntelligenceNotificationService'

export { registerNotificationAdvisorAgent } from './NotificationAdvisorAgent'
