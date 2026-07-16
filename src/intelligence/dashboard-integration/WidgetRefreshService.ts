// ─── Smart Intelligence Dashboard Integration — Widget Refresh Service (K57) ─
// Reuses K44's short-term Memory Engine as the per-widget cache — same
// 5-minute pattern K53/K54/K55/K56 already use, no new cache.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall, forget } from '../memory'
import { getWidget } from './WidgetRegistry'
import type { WidgetResult } from './types'

const NAMESPACE = 'dashboard-widgets'
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_TENANT_SCOPE = 'platform' // Memory Engine keys are tenant-scoped; widgets cache under a fixed namespace key per widget+tenant instead

function ensureWidgetCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Intelligence dashboard widget data',
  })
}

function cacheKey(widgetId: string, tenantId?: string): string {
  return `${widgetId}:${tenantId ?? 'platform'}`
}

export async function getWidgetData(widgetId: string, tenantId?: string): Promise<WidgetResult> {
  ensureWidgetCacheNamespace()
  const widget = getWidget(widgetId)
  if (!widget) return { widgetId, error: 'widget not registered' }
  if (widget.tenantScoped && !tenantId) return { widgetId, error: 'tenantId required for this widget' }

  const cacheTenant = tenantId ?? CACHE_TENANT_SCOPE
  const key = cacheKey(widgetId, tenantId)

  const cached = await recall(cacheTenant, NAMESPACE, key)
  if (typeof cached === 'string') {
    try { return { widgetId, data: JSON.parse(cached) } } catch { /* fall through to recompute */ }
  }

  try {
    const data = await widget.getData(tenantId)
    await remember(cacheTenant, NAMESPACE, key, JSON.stringify(data))
    return { widgetId, data }
  } catch (err: any) {
    return { widgetId, error: err?.message ?? 'widget data fetch failed' }
  }
}

export async function refreshWidget(widgetId: string, tenantId?: string): Promise<WidgetResult> {
  ensureWidgetCacheNamespace()
  await forget(tenantId ?? CACHE_TENANT_SCOPE, NAMESPACE, cacheKey(widgetId, tenantId))
  return getWidgetData(widgetId, tenantId)
}

export async function getDashboardData(widgetIds: string[], tenantId?: string): Promise<WidgetResult[]> {
  return Promise.all(widgetIds.map(id => getWidgetData(id, tenantId)))
}
