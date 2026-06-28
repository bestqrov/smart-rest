import { scoreBoolean } from '../../scoring/ScoringEngine'
import type { RulePack, EvidenceInput } from '../../types'

export const AUTOMATION_PACK: RulePack = {
  id:          'automation-pack',
  name:        'Automation Pack',
  description: 'Digital order channels and workflow automation rules.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['automation', 'qr', 'digital'],

  rules: [
    {
      id:             'QR_ORDERS_ENABLED',
      category:       'FEATURES',
      title:          'QR Code Orders Active',
      description:    'At least one QR-sourced order must have been received in the last 30 days.',
      weight:         10,
      required:       false,
      enabled:        true,
      evaluationType: 'BOOLEAN',
    },
  ],

  evaluators: {
    QR_ORDERS_ENABLED: async (_rule, data): Promise<EvidenceInput> =>
      scoreBoolean((data.qrOrderCount30d as number) > 0, true),
  },
}
