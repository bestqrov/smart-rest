// ─── Smart Intelligence Notification Advisor — Contracts (K56) ─────────────
// Rule-based only, no AI. Reuses the existing core NotificationService
// (CoreNotification) as the sole persisted store — priority/category/
// dedupe/group/action data travels in that table's existing `metadata`
// JSON column, no new Prisma model.

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface NotificationAction {
  label: string
  url:   string
}

export interface IntelligenceNotificationInput {
  tenantId:    string
  category:    string             // e.g. "insight", "recommendation", "automation"
  priority:    NotificationPriority
  title:       string
  message:     string
  module?:     string
  entityId?:   string
  dedupeKey?:  string             // suppress repeats of the same signal within the dedupe window
  groupKey?:   string             // candidates sharing a groupKey may be merged before sending
  actions?:    NotificationAction[]
}

export interface QuietHoursConfig {
  startHour: number   // 0-23, inclusive
  endHour:   number   // 0-23, exclusive (wraps past midnight if startHour > endHour)
}

export interface NotificationPreferences {
  tenantId:        string
  minPriority:     NotificationPriority
  mutedCategories: string[]
  mutedModules:    string[]
  quietHours?:     QuietHoursConfig
}

export interface NotificationDispatchResult {
  sent:      boolean
  reason?:   string
  notificationId?: string
}
