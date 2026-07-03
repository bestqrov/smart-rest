// ─── Smart Intelligence Notification Advisor — Preference Store (K56) ──────
// Durable, tenant-scoped preferences — no new storage: long-term memory
// (K44) is itself the K39 Knowledge Engine, addressed through a "memory:"
// key namespace. No LONG_TERM entry ever expires, matching "preferences
// persist until changed."

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import type { NotificationPreferences } from './types'

const NAMESPACE = 'notification-preferences'
const KEY = 'preferences'

function ensurePreferencesNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'LONG_TERM', ttlMs: 0,
    description: 'Tenant Intelligence notification preferences (muted categories/modules, quiet hours, min priority)',
  })
}

function defaultPreferences(tenantId: string): NotificationPreferences {
  return { tenantId, minPriority: 'LOW', mutedCategories: [], mutedModules: [] }
}

export async function getNotificationPreferences(tenantId: string): Promise<NotificationPreferences> {
  ensurePreferencesNamespace()
  const raw = await recall(tenantId, NAMESPACE, KEY)
  if (typeof raw !== 'string') return defaultPreferences(tenantId)

  try {
    const parsed = JSON.parse(raw) as NotificationPreferences
    return { ...defaultPreferences(tenantId), ...parsed, tenantId }
  } catch {
    return defaultPreferences(tenantId)
  }
}

export async function setNotificationPreferences(tenantId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  ensurePreferencesNamespace()
  const current = await getNotificationPreferences(tenantId)
  const updated: NotificationPreferences = { ...current, ...prefs, tenantId }
  await remember(tenantId, NAMESPACE, KEY, JSON.stringify(updated))
  return updated
}
