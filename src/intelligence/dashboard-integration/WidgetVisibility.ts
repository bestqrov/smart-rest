// ─── Smart Intelligence Dashboard Integration — Role-Based Visibility (K57) ─
// Pure filter over K33's existing UserContext role vocabulary.

import type { UserContext } from '../context'
import type { WidgetDefinition } from './types'

export function filterWidgetsForRole(widgets: WidgetDefinition[], role: UserContext['type']): WidgetDefinition[] {
  return widgets.filter(w => w.visibleToRoles.includes(role))
}
