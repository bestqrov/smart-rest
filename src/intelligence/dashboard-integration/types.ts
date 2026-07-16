// ─── Smart Intelligence Dashboard Integration — Contracts (K57) ────────────
// Native Map-based widget registry, same idiom as every other Intelligence
// registry (K40/K47/K49...). A generic widget registry already exists at
// src/integration/registry/IntegrationRegistry.ts + WidgetRegistryService.ts
// — it is untracked (never committed) and referenced nowhere else in the
// codebase, so depending on it would add a hard dependency on code that
// isn't part of the reviewed/stable tree. This module is shaped similarly
// (id/module/type/size/getData) so it could be bridged to that system
// later if it's ever formally adopted, without a dependency today.

import type { UserContext } from '../context'

export type WidgetType = 'stat' | 'chart' | 'list' | 'table' | 'custom'
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl'

export interface WidgetDefinition {
  id:             string
  module:         string
  name:           string
  type:           WidgetType
  size:           WidgetSize
  visibleToRoles: UserContext['type'][]   // reuses K33's UserContext role vocabulary — no new role enum
  tenantScoped:   boolean                 // true = getData requires a tenantId
  getData:        (tenantId?: string) => Promise<unknown>
}

export interface DashboardLayoutSection {
  id:        string
  title:     string
  widgetIds: string[]
}

export interface DashboardLayoutConfig {
  id:       string
  name:     string
  sections: DashboardLayoutSection[]
}

export interface WidgetResult {
  widgetId: string
  data?:    unknown
  error?:   string
}
