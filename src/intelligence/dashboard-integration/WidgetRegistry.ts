// ─── Smart Intelligence Dashboard Integration — Widget Registry (K57) ──────
// Same registry-of-definitions idiom as every other Intelligence module.

import type { WidgetDefinition } from './types'

const registry = new Map<string, WidgetDefinition>()

export function registerWidget(widget: WidgetDefinition): void {
  registry.set(widget.id, widget)
}

export function getWidget(id: string): WidgetDefinition | undefined {
  return registry.get(id)
}

export function getAllWidgets(): WidgetDefinition[] {
  return [...registry.values()]
}

export function getWidgetsByModule(module: string): WidgetDefinition[] {
  return getAllWidgets().filter(w => w.module === module)
}
