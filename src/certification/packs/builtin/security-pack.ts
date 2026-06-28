import type { RulePack } from '../../types'

// Placeholder pack — security and access control rules will be added in a future phase.
export const SECURITY_PACK: RulePack = {
  id:          'security-pack',
  name:        'Security Pack',
  description: 'Staff access control, audit trail completeness, and fraud detection rules.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['security', 'access-control', 'audit'],
  rules:       [],
  evaluators:  {},
}
