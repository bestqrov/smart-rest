// ─── Smart Intelligence Event Hub — Event Categorization (K31) ─────────────
// Derives a module/category for any PlatformEventName from its existing
// naming convention (every event added since K11's standardization sprint
// is prefixed by its domain — Billing*, Pos*, Kitchen*, Loyalty*, ...) —
// avoids hand-maintaining a 90-entry map that would drift from
// core/types/index.ts's PlatformEventName union.

import type { PlatformEventName } from '../core'

// Ordered longest-prefix-first where overlaps exist (e.g. "Subscription"
// before "Support" isn't needed here, but keep alpha-independent ordering
// explicit rather than relying on object key order).
const PREFIX_MODULE_MAP: [prefix: string, module: string][] = [
  ['Subscription',  'billing'],
  ['Invoice',       'billing'],
  ['Quota',         'billing'],
  ['TrialEnding',   'billing'],
  ['Plan',          'billing'],
  ['Billing',       'billing'],
  ['PosOrder',      'pos'],
  ['Order',         'orders'],
  ['KitchenOrder',  'kitchen'],
  ['Stock',         'inventory'],
  ['Table',         'tables'],
  ['Reservation',   'reservations'],
  ['Branch',        'branches'],
  ['Customer',      'crm'],
  ['Loyalty',       'loyalty'],
  ['Review',        'reviews'],
  ['GoogleReview',  'reviews'],
  ['Feedback',      'feedback'],
  ['SupportTicket', 'feedback'],
  ['WhatsApp',      'whatsapp'],
  ['Email',         'email'],
  ['SocialPost',    'social'],
  ['Affiliate',     'affiliate'],
  ['Referral',      'affiliate'],
  ['Commission',    'affiliate'],
  ['Gbp',           'seo'],
  ['Citation',      'seo'],
  ['SeoScore',      'seo'],
  ['Tenant',        'tenant'],
  ['Restaurant',    'tenant'],
  ['Cafe',          'tenant'],
  ['Marketplace',   'marketplace'],
  ['Recommendation','marketplace'],
  ['Bundle',        'marketplace'],
  ['Payment',       'payments'],
  ['Certificate',   'certification'],
  ['Campaign',      'marketing'],
  ['AIGeneration',  'ai'],
  ['Automation',    'automation'],
  ['DemoRequest',   'demo'],
  ['DemoActivated', 'demo'],
  ['UserPassword',  'auth'],
  ['Notification',  'notifications'],
  ['IntelRecommendation', 'intelligence'],
]

export function categorizeEvent(eventName: PlatformEventName): string {
  const match = PREFIX_MODULE_MAP.find(([prefix]) => eventName.startsWith(prefix))
  return match?.[1] ?? 'other'
}
