import { scoreBoolean, scoreNumber } from '../../scoring/ScoringEngine'
import type { RulePack, EvidenceInput } from '../../types'

export const OPERATIONS_PACK: RulePack = {
  id:          'operations-pack',
  name:        'Operations Pack',
  description: 'Core operational rules: menu content, physical setup, and order activity.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['operations', 'core', 'f&b'],

  rules: [
    {
      id:             'MENU_ITEMS_COUNT',
      category:       'CONTENT',
      title:          'Menu Items',
      description:    'The menu must contain at least 5 items for customers to order from.',
      weight:         12,
      required:       true,
      enabled:        true,
      evaluationType: 'NUMBER',
      expectedValue:  5,
    },
    {
      id:             'MENU_CATEGORIES',
      category:       'CONTENT',
      title:          'Menu Categories',
      description:    'Items must be organised into at least 2 categories.',
      weight:         8,
      required:       true,
      enabled:        true,
      evaluationType: 'NUMBER',
      expectedValue:  2,
    },
    {
      id:             'TABLES_CONFIGURED',
      category:       'SETUP',
      title:          'Tables Configured',
      description:    'At least one table must be set up in the floor plan.',
      weight:         10,
      required:       true,
      enabled:        true,
      evaluationType: 'NUMBER',
      expectedValue:  1,
    },
    {
      id:             'STAFF_REGISTERED',
      category:       'SETUP',
      title:          'Staff Registered',
      description:    'At least one staff member must be added.',
      weight:         10,
      required:       true,
      enabled:        true,
      evaluationType: 'NUMBER',
      expectedValue:  1,
    },
    {
      id:             'ORDERS_LAST_30_DAYS',
      category:       'ACTIVITY',
      title:          'Recent Order Activity',
      description:    'At least 10 orders must have been processed in the last 30 days.',
      weight:         20,
      required:       false,
      enabled:        true,
      evaluationType: 'NUMBER',
      expectedValue:  10,
    },
    {
      id:             'WEEKLY_ORDER_VOLUME',
      category:       'ACTIVITY',
      title:          'Weekly Order Volume',
      description:    'Weekly order count should reach at least 20 orders.',
      weight:         10,
      required:       false,
      enabled:        true,
      evaluationType: 'NUMBER',
      expectedValue:  20,
    },
  ],

  evaluators: {
    MENU_ITEMS_COUNT: async (rule, data): Promise<EvidenceInput> =>
      scoreNumber(data.menuItemCount as number, rule.expectedValue as number, true),

    MENU_CATEGORIES: async (rule, data): Promise<EvidenceInput> =>
      scoreNumber(data.categoryCount as number, rule.expectedValue as number, false),

    TABLES_CONFIGURED: async (rule, data): Promise<EvidenceInput> =>
      scoreNumber(data.tableCount as number, rule.expectedValue as number, false),

    STAFF_REGISTERED: async (rule, data): Promise<EvidenceInput> =>
      scoreNumber(data.staffCount as number, rule.expectedValue as number, false),

    ORDERS_LAST_30_DAYS: async (rule, data): Promise<EvidenceInput> =>
      scoreNumber(data.orderCount30d as number, rule.expectedValue as number, true),

    WEEKLY_ORDER_VOLUME: async (rule, data): Promise<EvidenceInput> =>
      scoreNumber(data.weeklyOrderCount as number, rule.expectedValue as number, true),
  },
}
