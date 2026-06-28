import type { RulePack } from '../../types'

// Placeholder pack — regulatory and compliance rules will be added in a future phase.
// Example future rules: data retention policy, GDPR opt-in completeness, VAT configuration.
export const COMPLIANCE_PACK: RulePack = {
  id:          'compliance-pack',
  name:        'Compliance Pack',
  description: 'Regulatory compliance, data retention, and policy adherence rules.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['compliance', 'regulatory', 'gdpr'],
  rules:       [],
  evaluators:  {},
}
