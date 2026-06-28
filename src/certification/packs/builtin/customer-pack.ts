import { scoreBoolean } from '../../scoring/ScoringEngine'
import type { RulePack, EvidenceInput } from '../../types'

export const CUSTOMER_PACK: RulePack = {
  id:          'customer-pack',
  name:        'Customer Pack',
  description: 'Loyalty and customer engagement rules.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['customer', 'loyalty', 'engagement'],

  rules: [
    {
      id:             'LOYALTY_CUSTOMERS',
      category:       'ENGAGEMENT',
      title:          'Loyalty Programme Active',
      description:    'At least one customer must have opted into the loyalty programme.',
      weight:         5,
      required:       false,
      enabled:        true,
      evaluationType: 'BOOLEAN',
    },
  ],

  evaluators: {
    LOYALTY_CUSTOMERS: async (_rule, data): Promise<EvidenceInput> =>
      scoreBoolean((data.loyaltyCount as number) > 0, true),
  },
}
