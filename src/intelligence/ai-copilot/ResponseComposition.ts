// ─── Smart Intelligence AI Chat Copilot Foundation — Response Composition (K68) ─
// Pure formatting over the already-fetched ModuleGrounding list — no new
// data retrieval, no advisor logic. Produces the labeled grounding block
// the prompt uses and the source-attribution list the response returns.

import type { ModuleGrounding } from './AdvisorIntegration'

export function composeGroundingText(groundings: ModuleGrounding[]): string {
  if (groundings.length === 0) return '{}'
  return groundings.map(g => `[${g.module}]\n${g.data}`).join('\n\n')
}

export function attributeSources(groundings: ModuleGrounding[]): string[] {
  return groundings.map(g => g.module)
}
