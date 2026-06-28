import type { RulePack } from '../../types'

// Placeholder pack — AI-specific rules will be added in a future phase.
export const AI_PACK: RulePack = {
  id:          'ai-pack',
  name:        'AI Pack',
  description: 'AI Center usage, job success rates, and model quality rules.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['ai', 'ai-center', 'ml'],
  rules:       [],
  evaluators:  {},
}
