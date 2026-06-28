import { scoreBoolean } from '../../scoring/ScoringEngine'
import type { RulePack, EvidenceInput } from '../../types'

export const INVENTORY_PACK: RulePack = {
  id:          'inventory-pack',
  name:        'Inventory Pack',
  description: 'Smart Inventory module activation rules.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['inventory', 'stock', 'operations'],

  rules: [
    {
      id:             'INVENTORY_ACTIVE',
      category:       'FEATURES',
      title:          'Smart Inventory Enabled',
      description:    'The Smart Inventory module must be enabled for the tenant.',
      weight:         5,
      required:       false,
      enabled:        true,
      evaluationType: 'BOOLEAN',
    },
  ],

  evaluators: {
    INVENTORY_ACTIVE: async (_rule, data): Promise<EvidenceInput> =>
      scoreBoolean(data.inventoryEnabled as boolean, true),
  },
}
