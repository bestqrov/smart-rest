// ─── SmartSuite OS — Widget Registry ─────────────────────────────────────────
// Every engine contributes dashboard widgets. SuperAdmin chooses layout.
// Data is fetched lazily when the dashboard requests it.

import { listModules, getModulesByCapability } from '../registry/IntegrationRegistry'
import type { WidgetDefinition }               from '../registry/IntegrationRegistry'

export type { WidgetDefinition }

// ─── List all registered widgets ─────────────────────────────────────────────
export function listWidgets(options?: {
  requiresSA?: boolean
  size?:       WidgetDefinition['size']
  type?:       WidgetDefinition['type']
}): Array<WidgetDefinition & { moduleId: string }> {
  const all = listModules().flatMap(mod =>
    (mod.widgets ?? []).map(w => ({ ...w, moduleId: mod.id }))
  )
  return all.filter(w => {
    if (options?.requiresSA !== undefined && w.requiresSA !== options.requiresSA) return false
    if (options?.size && w.size !== options.size) return false
    if (options?.type && w.type !== options.type) return false
    return true
  })
}

// ─── Fetch data for one widget ────────────────────────────────────────────────
export async function getWidgetData(
  widgetId:  string,
  tenantId?: string,
): Promise<{ widgetId: string; data: unknown; error?: string }> {
  for (const mod of listModules()) {
    const widget = (mod.widgets ?? []).find(w => w.id === widgetId)
    if (widget) {
      try {
        const data = await Promise.race([
          widget.getData(tenantId),
          new Promise(resolve => setTimeout(() => resolve(null), 3000)),
        ])
        return { widgetId, data }
      } catch (err: any) {
        return { widgetId, data: null, error: err?.message }
      }
    }
  }
  return { widgetId, data: null, error: 'Widget not found' }
}

// ─── Fetch data for multiple widgets (dashboard load) ─────────────────────────
export async function getDashboardData(
  widgetIds: string[],
  tenantId?: string,
): Promise<Record<string, { data: unknown; error?: string }>> {
  const results = await Promise.all(
    widgetIds.map(id => getWidgetData(id, tenantId))
  )
  return Object.fromEntries(
    results.map(r => [r.widgetId, { data: r.data, error: r.error }])
  )
}
