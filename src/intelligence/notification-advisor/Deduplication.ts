// ─── Smart Intelligence Notification Advisor — Deduplication (K56) ─────────
// Reuses K44's short-term Memory Engine as the dedupe window tracker — no
// new cache.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'

const NAMESPACE = 'notification-dedupe'
const DEDUPE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function ensureDedupeNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: DEDUPE_WINDOW_MS,
    description: 'Recently-sent Intelligence notification dedupe keys',
  })
}

export async function isDuplicateNotification(tenantId: string, dedupeKey: string): Promise<boolean> {
  ensureDedupeNamespace()
  const seen = await recall(tenantId, NAMESPACE, dedupeKey)
  return seen !== undefined
}

export async function markNotificationSent(tenantId: string, dedupeKey: string): Promise<void> {
  ensureDedupeNamespace()
  await remember(tenantId, NAMESPACE, dedupeKey, true)
}
