import type { RuntimeSetting, SettingType } from '../types'

// ─── Default runtime settings ─────────────────────────────────────────────────

interface SettingDef {
  type:        SettingType
  description: string
  category:    string
  readonly?:   boolean
  default:     unknown
}

const SETTING_DEFS: Record<string, SettingDef> = {
  'system.maintenance_mode': {
    type: 'boolean', default: false, category: 'system',
    description: 'When enabled, non-superadmin requests return 503',
  },
  'system.debug_mode': {
    type: 'boolean', default: false, category: 'system',
    description: 'Enable verbose logging and diagnostic headers',
  },
  'ai.timeout_ms': {
    type: 'number', default: 60000, category: 'ai',
    description: 'Maximum time (ms) for a single AI generation request',
  },
  'ai.max_retries': {
    type: 'number', default: 3, category: 'ai',
    description: 'Number of retry attempts for failed AI jobs',
  },
  'ai.job_concurrency': {
    type: 'number', default: 5, category: 'ai',
    description: 'Maximum concurrent AI jobs per worker',
  },
  'billing.grace_period_days': {
    type: 'number', default: 7, category: 'billing',
    description: 'Days before PAST_DUE account becomes SUSPENDED',
  },
  'certification.validity_days': {
    type: 'number', default: 90, category: 'certification',
    description: 'Default number of days a certification remains valid',
  },
  'analytics.snapshot_retention_days': {
    type: 'number', default: 90, category: 'analytics',
    description: 'Number of days to retain metric snapshots',
  },
  'marketing.max_campaigns_per_day': {
    type: 'number', default: 10, category: 'marketing',
    description: 'Maximum marketing campaigns a restaurant can create per day',
  },
  'ops.diagnostics_enabled': {
    type: 'boolean', default: true, category: 'ops',
    description: 'Enable automated diagnostics checks',
  },
}

// ─── In-memory cache (loaded from DB on first access) ────────────────────────

const cache = new Map<string, unknown>()
let cacheLoaded = false

async function loadCache(): Promise<void> {
  if (cacheLoaded) return
  try {
    const { default: prisma } = await import('../../prisma')
    const rows = await (prisma as any).runtimeSetting.findMany()
    for (const row of rows) {
      try {
        cache.set(row.key, JSON.parse(row.value))
      } catch {
        cache.set(row.key, row.value)
      }
    }
  } catch { /* DB might not have model yet */ }
  // Apply defaults for any missing key
  for (const [key, def] of Object.entries(SETTING_DEFS)) {
    if (!cache.has(key)) cache.set(key, def.default)
  }
  cacheLoaded = true
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAllSettings(): Promise<RuntimeSetting[]> {
  await loadCache()
  const now = new Date()
  return Object.entries(SETTING_DEFS).map(([key, def]) => ({
    key,
    value:       cache.get(key) ?? def.default,
    type:        def.type,
    description: def.description,
    category:    def.category,
    updatedAt:   now,
    readonly:    def.readonly,
  }))
}

export async function getSetting<T = unknown>(key: string): Promise<T> {
  await loadCache()
  if (!SETTING_DEFS[key]) throw new Error(`RuntimeConfig: unknown setting "${key}"`)
  return (cache.get(key) ?? SETTING_DEFS[key].default) as T
}

export async function updateSetting(key: string, value: unknown, updatedBy = 'system'): Promise<RuntimeSetting> {
  if (!SETTING_DEFS[key]) throw new Error(`RuntimeConfig: unknown setting "${key}"`)
  const def = SETTING_DEFS[key]
  if (def.readonly) throw new Error(`RuntimeConfig: setting "${key}" is read-only`)

  cache.set(key, value)

  // Persist to DB
  try {
    const { default: prisma } = await import('../../prisma')
    await (prisma as any).runtimeSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value), updatedBy, updatedAt: new Date() },
      create: { key, value: JSON.stringify(value), updatedBy, updatedAt: new Date() },
    })
  } catch { /* cache update still valid if DB fails */ }

  return {
    key,
    value,
    type:        def.type,
    description: def.description,
    category:    def.category,
    updatedAt:   new Date(),
    updatedBy,
  }
}

// Convenience — check maintenance mode without loading everything
export async function isMaintenanceMode(): Promise<boolean> {
  return getSetting<boolean>('system.maintenance_mode')
}
