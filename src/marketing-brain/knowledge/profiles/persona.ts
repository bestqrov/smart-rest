import type { Channel, Tone }    from '../../models/MessageTemplate'
import type { ObjectionCategory } from '../../models/Objection'
import type {
  TechComfort, DecisionSpeed, PriceSensitivity, TrustRequirement,
  ContentLength,
} from '../types'

// ─── Profile shape ─────────────────────────────────────────────────────────────

export interface PersonaEnrichment {
  techComfort:          TechComfort
  decisionSpeed:        DecisionSpeed
  priceSensitivity:     PriceSensitivity
  trustRequirement:     TrustRequirement
  idealChannel:         Channel
  contentLength:        ContentLength
  preferredTones:       Tone[]
  triggerWords:         string[]
  avoidWords:           string[]
  messagingPrinciples:  string[]
  typicalJourneyDays:   number
  nurtureTouchpoints:   number
  likelyObjections:     ObjectionCategory[]
}

// ─── Per-persona profiles ──────────────────────────────────────────────────────

export const PERSONA_PROFILES: Record<string, PersonaEnrichment> = {

  // Traditional restaurant owner (40–65, LOW tech, EMOTIONAL decision style)
  traditional_owner: {
    techComfort:      'BASIC',
    decisionSpeed:    'SLOW',
    priceSensitivity: 'HIGH',
    trustRequirement: 'HIGH',
    idealChannel:     'WHATSAPP',
    contentLength:    'SHORT',
    preferredTones:   ['FRIENDLY', 'EMPATHETIC', 'FORMAL'],
    triggerWords: [
      'أستاذ',         // respectful title
      'توفير الوقت',   // time-saving
      'بلا أخطاء',     // no errors
      'سهل',           // easy
      'الزبون',        // the customer
      'بدون تدريب',    // without training
      'جرب مجاناً',    // try free
    ],
    avoidWords: [
      'dashboard',
      'analytics',
      'KPI',
      'onboarding',
      'AI',
      'SaaS',
      'cloud',
      'integration',
      'API',
    ],
    messagingPrinciples: [
      'Lead with a concrete time or money benefit — never with technology',
      'Use "أستاذ" or respectful greeting before stating anything else',
      'Speak to the owner\'s daily frustration, not abstract business metrics',
      'Maximum 3 short paragraphs — anything longer will not be read',
      'End with a soft yes/no question, never a form or link as first CTA',
      'Reference what other local restaurant owners are doing (peer proof)',
      'Avoid any English tech jargon — even partially translated terms feel alien',
      'Voice the owner\'s own words back to them: "كل يوم تضيع وقت بسبب..."',
    ],
    typicalJourneyDays:  21,
    nurtureTouchpoints:  5,
    likelyObjections: ['TRUST', 'COMPLEXITY', 'NECESSITY', 'PRICE'],
  },

  // Young entrepreneur (22–38, HIGH tech, IMPULSIVE decision style)
  young_entrepreneur: {
    techComfort:      'ADVANCED',
    decisionSpeed:    'FAST',
    priceSensitivity: 'MEDIUM',
    trustRequirement: 'LOW',
    idealChannel:     'WHATSAPP',
    contentLength:    'SHORT',
    preferredTones:   ['PLAYFUL', 'FRIENDLY', 'URGENT'],
    triggerWords: [
      'ROI',
      '3x أسرع',       // 3x faster
      'طلبيات أكثر',   // more orders
      'بدون ورقة',      // paperless
      'في الموبايل',    // on mobile
      'جرب',           // try it
      'النتائج',        // the results
      'data',
    ],
    avoidWords: [
      'تقليدي',        // traditional (sounds old)
      'تدريجياً',       // gradually (too slow)
      'في المستقبل',    // in the future (not immediate)
      'استشارة',        // consultation (too slow/formal)
    ],
    messagingPrinciples: [
      'Skip the pleasantries — lead with the value number (3x orders, 40 minutes saved)',
      'One emoji maximum — playful but not childish',
      'Short sentences. Punchy. Direct.',
      'Peer comparison works: "مطاعم مثل ديالك استعملو SmartRestau و..."',
      'Link or demo available immediately — no waiting for a call',
      'FOMO is acceptable: limited trial, early adopter framing',
      'Mobile-first mindset: every CTA must be completable on a phone in 30 seconds',
      'Show the product, not just describe it — video or screenshot if supported by channel',
    ],
    typicalJourneyDays:  5,
    nurtureTouchpoints:  2,
    likelyObjections: ['PRICE', 'TIMING', 'COMPETITION'],
  },

  // Multi-branch manager (30–55, HIGH tech, ANALYTICAL decision style)
  multi_branch_manager: {
    techComfort:      'ADVANCED',
    decisionSpeed:    'MEDIUM',
    priceSensitivity: 'LOW',
    trustRequirement: 'MEDIUM',
    idealChannel:     'EMAIL',
    contentLength:    'LONG',
    preferredTones:   ['FORMAL', 'FRIENDLY', 'EMPATHETIC'],
    triggerWords: [
      'reporting',
      'consolidation',
      'per-branch',
      'real-time',
      'permissions',
      'multi-location',
      'ROI',
      'staff management',
      'standardisation',
    ],
    avoidWords: [
      'simple',   // implies it lacks features
      'basic',
      'easy',     // sounds under-powered for their complexity
      'starter',
    ],
    messagingPrinciples: [
      'Lead with multi-branch capability — single-branch features are irrelevant to them',
      'Use data: show how centralised reporting replaces N spreadsheets across N branches',
      'Professional email format: subject line, clear sections, specific call-to-action',
      'Address the manager as the decision-influencer, not sole decision-maker',
      'Reference ROI with conservative estimates: €X saved per month per branch',
      'Acknowledge their complexity: "we know 5 branches means 5x the coordination challenges"',
      'Offer a pilot on 1 branch first — reduces risk perception dramatically',
      'Reporting and analytics is their biggest hook — lead with the dashboard narrative',
    ],
    typicalJourneyDays:  30,
    nurtureTouchpoints:  4,
    likelyObjections: ['COMPLEXITY', 'TIMING', 'COMPETITION'],
  },

  // Hotel food & beverage manager (30–50, MEDIUM tech, ANALYTICAL)
  hotel_food_manager: {
    techComfort:      'COMFORTABLE',
    decisionSpeed:    'SLOW',
    priceSensitivity: 'LOW',
    trustRequirement: 'HIGH',
    idealChannel:     'EMAIL',
    contentLength:    'LONG',
    preferredTones:   ['FORMAL', 'EMPATHETIC', 'FRIENDLY'],
    triggerWords: [
      'guest experience',
      'room service',
      'property management system',
      'compliance',
      'audit',
      'multi-outlet',
      'integration',
      'procurement',
    ],
    avoidWords: [
      'hustle',
      'startup',
      'disruption',
      'hack',
      'growth hack',
    ],
    messagingPrinciples: [
      'Professional, formal tone at all times — this is an institutional buyer',
      'Hotel procurement involves multiple sign-offs — address the F&B manager, cc the GM',
      'Integration with PMS (Opera, Cloudbeds) is a key differentiator — mention it early',
      'Guest experience framing: "your guests deserve a seamless order experience"',
      'Compliance and audit trails matter — emphasise data logs and reporting',
      'Propose a formal demo + pilot structure — not a "try it now" CTA',
      'Contract and SLA expectations are high — mention uptime guarantees',
    ],
    typicalJourneyDays:  45,
    nurtureTouchpoints:  6,
    likelyObjections: ['TRUST', 'COMPLEXITY', 'COMPETITION', 'TIMING'],
  },

  // Traiteur / caterer owner (30–55, MEDIUM tech, SOCIAL decision style)
  traiteur_owner: {
    techComfort:      'COMFORTABLE',
    decisionSpeed:    'MEDIUM',
    priceSensitivity: 'MEDIUM',
    trustRequirement: 'HIGH',
    idealChannel:     'WHATSAPP',
    contentLength:    'MEDIUM',
    preferredTones:   ['FRIENDLY', 'EMPATHETIC', 'FORMAL'],
    triggerWords: [
      'حفلات',          // events
      'طلبيات الزفاف',   // wedding orders
      'كميات كبيرة',    // large quantities
      'ما ضيعتيش',      // don't lose it
      'التنظيم',         // organisation
      'قبل الحفلة',     // before the event
    ],
    avoidWords: [
      'طلبيات لحظية',   // instant orders (caterers plan ahead)
      'fast food',
      'delivery',       // not their model
    ],
    messagingPrinciples: [
      'Event-centric framing: focus on wedding season, Ramadan catering, corporate events',
      'Emphasise order management for large quantities — not per-table service',
      'Social proof from peer traiteurs in the same city is most effective',
      'WhatsApp first, but longer messages acceptable than for traditional_owner',
      'Reference upcoming wedding/Eid season as timely trigger',
      'Community matters: frame as "tool other traiteurs in [city] are using"',
      'The pain of a missed or confused large order (wedding disaster) is very visceral — use it',
    ],
    typicalJourneyDays:  14,
    nurtureTouchpoints:  3,
    likelyObjections: ['NECESSITY', 'COMPLEXITY', 'PRICE', 'TIMING'],
  },
}

// ─── Default fallback ─────────────────────────────────────────────────────────

export const DEFAULT_PERSONA_ENRICHMENT: PersonaEnrichment = {
  techComfort:         'BASIC',
  decisionSpeed:       'MEDIUM',
  priceSensitivity:    'MEDIUM',
  trustRequirement:    'MEDIUM',
  idealChannel:        'WHATSAPP',
  contentLength:       'SHORT',
  preferredTones:      ['FRIENDLY', 'EMPATHETIC'],
  triggerWords:        ['توفير', 'سهل', 'جرب'],
  avoidWords:          ['dashboard', 'analytics', 'API'],
  messagingPrinciples: ['Lead with benefits', 'Keep it short', 'Use a clear CTA'],
  typicalJourneyDays:  14,
  nurtureTouchpoints:  3,
  likelyObjections:    ['TRUST', 'COMPLEXITY'],
}
