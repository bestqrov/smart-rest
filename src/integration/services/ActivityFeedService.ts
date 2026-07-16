// ─── SmartSuite OS — Global Activity Feed ────────────────────────────────────
// One chronological timeline across all platform modules.
// Modules contribute via ActivitySource in their ModuleRegistration.

import { getModulesByCapability }            from '../registry/IntegrationRegistry'
import type { ActivityEntry, ActivitySource } from '../registry/IntegrationRegistry'

export type { ActivityEntry }

// ─── Aggregate feed from all registered modules ───────────────────────────────
export async function getActivityFeed(options?: {
  modules?:  string[]
  tenantId?: string
  limit?:    number
  since?:    string    // ISO timestamp
}): Promise<ActivityEntry[]> {
  const mods    = getModulesByCapability('activity')
  const filtered = options?.modules
    ? mods.filter(m => options.modules!.includes(m.id))
    : mods

  const limit   = options?.limit ?? 50
  const perMod  = Math.max(20, Math.ceil(limit / Math.max(filtered.length, 1)))

  const jobs = filtered.flatMap(mod =>
    (mod.activitySources ?? []).map(async (source: ActivitySource) => {
      try {
        return await Promise.race([
          source.getRecent(perMod, options?.tenantId),
          new Promise<ActivityEntry[]>(resolve => setTimeout(() => resolve([]), 2000)),
        ])
      } catch {
        return []
      }
    })
  )

  let entries = (await Promise.all(jobs)).flat()

  // Filter by `since` if provided
  if (options?.since) {
    entries = entries.filter(e => e.occurredAt >= options.since!)
  }

  // Sort chronologically descending
  entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  return entries.slice(0, limit)
}

// ─── Feed for a specific tenant ───────────────────────────────────────────────
export async function getTenantFeed(tenantId: string, limit = 30): Promise<ActivityEntry[]> {
  return getActivityFeed({ tenantId, limit })
}

// ─── Platform-wide feed (SuperAdmin) ─────────────────────────────────────────
export async function getPlatformFeed(limit = 100): Promise<ActivityEntry[]> {
  return getActivityFeed({ limit })
}
