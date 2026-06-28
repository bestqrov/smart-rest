import { scoreBoolean } from '../../scoring/ScoringEngine'
import type { RulePack, EvidenceInput } from '../../types'

// Depends on customer-pack — marketing is only meaningful with customers.
export const MARKETING_PACK: RulePack = {
  id:          'marketing-pack',
  name:        'Marketing Pack',
  description: 'Marketing Brain usage and campaign configuration rules.',
  version:     '1.0',
  enabled:     true,
  dependencies: ['customer-pack'],
  tags:        ['marketing', 'campaigns', 'ai'],

  rules: [
    {
      id:             'MARKETING_CONFIGURED',
      category:       'MARKETING',
      title:          'Marketing Campaign Run',
      description:    'At least one Marketing Brain campaign must have been completed.',
      weight:         8,
      required:       false,
      enabled:        true,
      evaluationType: 'BOOLEAN',
    },
  ],

  evaluators: {
    MARKETING_CONFIGURED: async (_rule, data): Promise<EvidenceInput> =>
      scoreBoolean((data.marketingCount as number) > 0, true),
  },
}
