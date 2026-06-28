import { scoreBoolean } from '../../scoring/ScoringEngine'
import type { RulePack, EvidenceInput } from '../../types'

export const BILLING_PACK: RulePack = {
  id:          'billing-pack',
  name:        'Billing Pack',
  description: 'Ensures the tenant has an active billing account.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['billing', 'compliance', 'core'],

  rules: [
    {
      id:             'BILLING_ACTIVE',
      category:       'COMPLIANCE',
      title:          'Billing Account Active',
      description:    'The billing account must be active (collecting debt or in grace period).',
      weight:         20,
      required:       true,
      enabled:        true,
      evaluationType: 'BOOLEAN',
    },
  ],

  evaluators: {
    BILLING_ACTIVE: async (_rule, data): Promise<EvidenceInput> => {
      const active = ['COLLECTING_DEBT', 'GRACE_PERIOD'].includes(data.billingStatus as string)
      return scoreBoolean(active, true)
    },
  },
}
