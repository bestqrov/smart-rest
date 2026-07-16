// ─── SmartSuite OS — Integration Registry ────────────────────────────────────
// Every engine registers itself here. No hardcoded module names anywhere else.

export type Capability =
  | 'search'
  | 'events'
  | 'widgets'
  | 'hooks'
  | 'commands'
  | 'notifications'
  | 'analytics'
  | 'activity'

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface ModuleHealth {
  status:     HealthStatus
  latencyMs?: number
  message?:   string
  checkedAt:  string
}

export interface SearchProvider {
  entityType: string
  labelAr:    string
  labelEn:    string
  search(query: string, tenantId?: string): Promise<SearchResult[]>
}

export interface SearchResult {
  id:         string
  entityType: string
  moduleId:   string
  title:      string
  subtitle?:  string
  url?:       string
  score?:     number
  metadata?:  Record<string, unknown>
}

export interface ActivitySource {
  sourceId: string
  labelAr:  string
  labelEn:  string
  getRecent(limit: number, tenantId?: string): Promise<ActivityEntry[]>
}

export interface ActivityEntry {
  id:         string
  sourceId:   string
  moduleId:   string
  type:       string
  titleAr:    string
  titleEn?:   string
  entityId?:  string
  entityType?: string
  tenantId?:  string
  level:      'info' | 'success' | 'warning' | 'error'
  occurredAt: string
  metadata?:  Record<string, unknown>
}

export interface CommandDefinition {
  id:          string
  labelAr:     string
  labelEn:     string
  description: string
  requiresSA:  boolean
  execute(params?: Record<string, unknown>): Promise<CommandResult>
}

export interface CommandResult {
  ok:       boolean
  message?: string
  data?:    unknown
}

export interface WidgetDefinition {
  id:       string
  moduleId: string
  labelAr:  string
  labelEn:  string
  type:     'stat' | 'chart' | 'list' | 'table' | 'custom'
  size:     'sm' | 'md' | 'lg' | 'xl'
  requiresSA: boolean
  getData(tenantId?: string): Promise<unknown>
}

export interface HookDefinition {
  event:    string
  moduleId: string
  phase:    'before' | 'after'
  handler(context: Record<string, unknown>): Promise<void>
}

export interface ModuleRegistration {
  id:           string
  name:         string
  nameAr:       string
  version:      string
  capabilities: Capability[]
  enabled:      boolean
  healthCheck?(): Promise<ModuleHealth>
  searchProviders?: SearchProvider[]
  activitySources?: ActivitySource[]
  commands?:        CommandDefinition[]
  widgets?:         WidgetDefinition[]
  hooks?:           HookDefinition[]
}

// ─── Singleton Registry ───────────────────────────────────────────────────────

const registry = new Map<string, ModuleRegistration>()

export function registerModule(mod: ModuleRegistration): void {
  if (registry.has(mod.id)) {
    // Allow re-registration (idempotent update)
    registry.set(mod.id, { ...registry.get(mod.id)!, ...mod })
    return
  }
  registry.set(mod.id, mod)
}

export function getModule(id: string): ModuleRegistration | undefined {
  return registry.get(id)
}

export function listModules(): ModuleRegistration[] {
  return Array.from(registry.values())
}

export function isEnabled(id: string): boolean {
  return registry.get(id)?.enabled ?? false
}

export function getCapabilities(id: string): Capability[] {
  return registry.get(id)?.capabilities ?? []
}

export function getModulesByCapability(cap: Capability): ModuleRegistration[] {
  return listModules().filter(m => m.enabled && m.capabilities.includes(cap))
}

export async function getHealth(): Promise<Record<string, ModuleHealth>> {
  const result: Record<string, ModuleHealth> = {}
  const checks = listModules().map(async mod => {
    if (mod.healthCheck) {
      try {
        result[mod.id] = await Promise.race([
          mod.healthCheck(),
          new Promise<ModuleHealth>(resolve =>
            setTimeout(() => resolve({ status: 'down', message: 'Timeout', checkedAt: new Date().toISOString() }), 3000)
          ),
        ])
      } catch {
        result[mod.id] = { status: 'down', message: 'Health check threw', checkedAt: new Date().toISOString() }
      }
    } else {
      result[mod.id] = { status: mod.enabled ? 'healthy' : 'unknown', checkedAt: new Date().toISOString() }
    }
  })
  await Promise.all(checks)
  return result
}
