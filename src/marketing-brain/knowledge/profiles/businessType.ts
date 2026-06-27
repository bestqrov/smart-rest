import type {
  StaffSize, Seasonality, DecisionMaker, DigitalAdoption, BudgetCycle, Complexity,
} from '../types'

// ─── Profile shape ─────────────────────────────────────────────────────────────

export interface BusinessTypeEnrichment {
  peakHours:              string[]
  peakDays:               string[]
  bestContactHours:       string[]
  staffSize:              StaffSize
  seasonality:            Seasonality
  primaryDecisionMaker:   DecisionMaker
  digitalReadiness:       DigitalAdoption
  budgetCycle:            BudgetCycle
  operationalPainPoints:  string[]
  keySmartRestauUseCases: string[]
  onboardingComplexity:   Complexity
  keyBenefits:            string[]
  avoidTopics:            string[]
}

// ─── Per-business-type profiles ───────────────────────────────────────────────

export const BUSINESS_TYPE_PROFILES: Record<string, BusinessTypeEnrichment> = {

  restaurant: {
    peakHours:       ['12:00–14:30', '19:30–22:30'],
    peakDays:        ['Friday', 'Saturday', 'Sunday'],
    bestContactHours:['10:00–11:30', '15:00–16:30'],
    staffSize:        'SMALL',
    seasonality:      'LOW',
    primaryDecisionMaker: 'OWNER',
    digitalReadiness:     'LOW',
    budgetCycle:          'MONTHLY',
    operationalPainPoints: [
      'Handwritten orders reach the kitchen incorrectly — frequent remakes',
      'Waiter must walk to kitchen twice per order (take order → deliver to kitchen → return)',
      'Owner cannot see real-time table status when away from floor',
      'End-of-shift reconciliation is manual and error-prone',
      'No ability to offer a digital menu that updates instantly with daily specials',
      'Staff retraining cost every time a new waiter joins',
    ],
    keySmartRestauUseCases: [
      'QR menu at table — customers browse and order independently',
      'Waiter app — orders sent directly to kitchen display from the floor',
      'Kitchen display system — replaces paper tickets in the kitchen',
      'POS integration — one system from order to payment',
      'Real-time dashboard — owner monitors occupancy from their phone',
    ],
    onboardingComplexity: 'MODERATE',
    keyBenefits: [
      'Fewer order errors = less food waste and fewer customer complaints',
      'Waiters serve more tables without running between kitchen and floor',
      'Owner stays in control even when not physically present',
      'Digital menu update takes 30 seconds instead of reprinting',
    ],
    avoidTopics: [
      'Advanced analytics or BI (premature for most restaurants at this stage)',
      'Online delivery integration (separate product category, different need)',
      'Loyalty programs as primary hook (table service restaurants need ordering first)',
    ],
  },

  cafe: {
    peakHours:       ['07:30–10:30', '15:00–17:00'],
    peakDays:        ['Saturday', 'Sunday', 'Monday'],
    bestContactHours:['11:00–12:30', '17:30–18:30'],
    staffSize:        'SMALL',
    seasonality:      'LOW',
    primaryDecisionMaker: 'OWNER',
    digitalReadiness:     'MEDIUM',
    budgetCycle:          'MONTHLY',
    operationalPainPoints: [
      'Morning rush creates a bottleneck at the counter',
      'Multiple espresso machine + till + order management = chaos at peak hours',
      'No way to manage a queue without paper notes',
      'Regulars want to pre-order but no system supports it',
      'Seasonal specials are written on a chalkboard — not visible online',
    ],
    keySmartRestauUseCases: [
      'QR ordering from table or the queue — reduces counter pressure',
      'Digital menu with seasonal specials that update in seconds',
      'Order flow to barista screen — no paper tickets',
      'Morning pre-order capability for regulars',
    ],
    onboardingComplexity: 'SIMPLE',
    keyBenefits: [
      'Morning rush handled with half the stress',
      'Barista focuses on coffee, not taking orders',
      'Seasonal menu changes take seconds, not a reprint job',
      'Reduces human error on complex customisation orders (oat milk, no sugar, etc.)',
    ],
    avoidTopics: [
      'Table management (cafés typically don\'t take reservations)',
      'Waiter app (smaller staff, less relevant)',
      'Kitchen display (prep is usually visible from the counter)',
    ],
  },

  caterer: {
    peakHours:       ['10:00–14:00', '17:00–21:00'],
    peakDays:        ['Friday', 'Saturday'],
    bestContactHours:['09:00–10:30', '21:30–22:30'],   // before prep and after events
    staffSize:        'MEDIUM',
    seasonality:      'HIGH',
    primaryDecisionMaker: 'OWNER',
    digitalReadiness:     'LOW',
    budgetCycle:          'AD_HOC',
    operationalPainPoints: [
      'Managing orders for hundreds of guests from a single event is overwhelming on paper',
      'Ingredient quantities are calculated manually — errors cause under/over-ordering',
      'No centralised record of past events to inform future quotes',
      'Coordinating production, transport, and setup across a team without digital tools',
      'Wedding season overload: accepting too many events → execution failures',
    ],
    keySmartRestauUseCases: [
      'Event order management — entire guest list with preferences tracked digitally',
      'Quantity planning — auto-calculate ingredients from guest count',
      'Client portal for menu selection (future feature — mention as roadmap)',
      'Staff assignment per event shift',
    ],
    onboardingComplexity: 'MODERATE',
    keyBenefits: [
      'Never arrive at an event short on a key dish because of a miscalculation',
      'Quote past events in 5 minutes instead of starting from scratch',
      'Owner sleeps better knowing the production list is digital and accurate',
    ],
    avoidTopics: [
      'Table QR menus (not their model — events use set menus)',
      'Real-time dine-in stats (not relevant)',
      'POS terminal at table (events are pre-paid)',
    ],
  },

  bakery: {
    peakHours:       ['06:30–09:30', '16:00–18:30'],
    peakDays:        ['Saturday', 'Sunday', 'Friday'],
    bestContactHours:['10:00–11:30', '13:00–14:30'],
    staffSize:        'SMALL',
    seasonality:      'MEDIUM',
    primaryDecisionMaker: 'OWNER',
    digitalReadiness:     'LOW',
    budgetCycle:          'MONTHLY',
    operationalPainPoints: [
      'Production is based on yesterday\'s estimates — overproduction causes waste',
      'Custom orders (wedding cakes, special pastries) tracked in notebooks',
      'No visibility into which product sells out fastest per day',
      'Early morning staff needs to know what to bake without waking the owner',
    ],
    keySmartRestauUseCases: [
      'Digital order tracking for custom orders with deadlines',
      'QR display menu for walk-in customers browsing daily offerings',
      'Inventory depletion tracking — see what sold out and when',
      'Pre-order for special items — reduce overproduction waste',
    ],
    onboardingComplexity: 'SIMPLE',
    keyBenefits: [
      'Never miss a custom order delivery date',
      'Bake what sells — reduce the bread that goes in the bin every evening',
      'Morning team knows the production list without a phone call to the owner',
    ],
    avoidTopics: [
      'Waiter app (no table service)',
      'Complex POS with tips and table splits',
      'Kitchen display system (open kitchen, all visible)',
    ],
  },

  food_truck: {
    peakHours:       ['12:00–14:00', '18:30–21:00'],
    peakDays:        ['Friday', 'Saturday', 'Sunday'],
    bestContactHours:['09:00–11:00', '21:30–23:00'],
    staffSize:        'SOLO',
    seasonality:      'HIGH',
    primaryDecisionMaker: 'OWNER',
    digitalReadiness:     'MEDIUM',
    budgetCycle:          'MONTHLY',
    operationalPainPoints: [
      'Solo or 2-person operation — no extra pair of hands to take orders during rush',
      'Location changes mean customers don\'t know the current menu',
      'Cash-only is limiting — customers have less cash than before',
      'No website or menu — relies entirely on Instagram posts',
    ],
    keySmartRestauUseCases: [
      'QR code on truck — customers scan, order, and pay without queuing',
      'Digital menu updates instantly when items run out',
      'Order queue on a small screen inside the truck — solo operator handles it alone',
      'WhatsApp menu share — send the link to regulars and events organisers',
    ],
    onboardingComplexity: 'SIMPLE',
    keyBenefits: [
      'Run a busy service alone — no extra staff cost',
      'No more shouting orders over a food truck queue',
      'Digital presence beyond Instagram — a live menu at any location',
    ],
    avoidTopics: [
      'Table management (no tables)',
      'Waiter app (solo operation)',
      'Complex inventory (small, fast-moving menu)',
    ],
  },

  hotel: {
    peakHours:       ['07:00–10:00', '12:30–14:30', '19:00–22:00'],
    peakDays:        ['Friday', 'Saturday', 'Sunday', 'Monday'],
    bestContactHours:['10:30–12:00', '15:00–17:00'],
    staffSize:        'LARGE',
    seasonality:      'MEDIUM',
    primaryDecisionMaker: 'MANAGER',
    digitalReadiness:     'HIGH',
    budgetCycle:          'ANNUAL',
    operationalPainPoints: [
      'Multiple F&B outlets (restaurant, pool bar, room service) with separate teams and no unified view',
      'Room service orders come by phone — slow, error-prone, staff-heavy',
      'Menu inconsistencies across outlets confuse guests and create complaints',
      'Allergen tracking across a high-volume kitchen is a legal liability',
      'Revenue reporting across outlets requires manual consolidation',
    ],
    keySmartRestauUseCases: [
      'Room service QR — guest scans in-room code and orders directly to their room',
      'Multi-outlet menu management — update all menus from one dashboard',
      'Kitchen display per outlet — eliminate verbal orders',
      'Consolidated F&B revenue dashboard for the GM',
      'Allergen flags on digital menu — reduces liability',
    ],
    onboardingComplexity: 'COMPLEX',
    keyBenefits: [
      'Room service wait time cut from 45 minutes to 25 minutes — direct guest satisfaction impact',
      'GM sees live F&B performance across all outlets without asking for reports',
      'Allergen compliance on every order — reduces legal risk',
      'Consistent guest experience whether dining at the restaurant or ordering to room',
    ],
    avoidTopics: [
      'Simplicity messaging (hotel buyers expect enterprise-grade tools)',
      'Solo-operator features (not relevant to their scale)',
      '"Try it in 5 minutes" framing (hotel procurement is deliberate, not impulsive)',
    ],
  },

  juice_bar: {
    peakHours:       ['08:00–10:00', '12:00–13:30', '16:00–18:00'],
    peakDays:        ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    bestContactHours:['10:30–12:00', '18:30–19:30'],
    staffSize:        'SOLO',
    seasonality:      'HIGH',
    primaryDecisionMaker: 'OWNER',
    digitalReadiness:     'MEDIUM',
    budgetCycle:          'MONTHLY',
    operationalPainPoints: [
      'Customisation orders (no sugar, add chia, extra ginger) are verbally complex and error-prone',
      'Health-conscious customers want to know exact ingredients and calories — no way to show this',
      'Loyalty cards are paper — easily lost, hard to track',
      'Ramadan and summer drive enormous demand spikes with no tool to manage them',
    ],
    keySmartRestauUseCases: [
      'Digital menu with full ingredient list and allergen info',
      'Customisation options built into the order (add/remove items)',
      'QR ordering — customer customises and orders without verbal explanation',
      'Loyalty tracking via phone number (when available)',
    ],
    onboardingComplexity: 'SIMPLE',
    keyBenefits: [
      'Zero miscommunication on complex customisations',
      'Customers feel in control of what they consume — transparency sells',
      'Loyalty without paper cards — track returning customers automatically',
    ],
    avoidTopics: [
      'Waiter app (no waiters)',
      'Table service features',
      'Multi-outlet management (single location)',
    ],
  },

  fast_food: {
    peakHours:       ['12:00–14:00', '18:00–21:00', '23:00–01:00'],
    peakDays:        ['Friday', 'Saturday', 'Sunday'],
    bestContactHours:['10:00–11:30', '14:30–16:00'],
    staffSize:        'MEDIUM',
    seasonality:      'LOW',
    primaryDecisionMaker: 'MANAGER',
    digitalReadiness:     'MEDIUM',
    budgetCycle:          'MONTHLY',
    operationalPainPoints: [
      'Counter queue is the bottleneck — any delay costs walk-aways',
      'Late-night service with minimal staff has zero room for error',
      'Daily special or out-of-stock updates take too long to communicate to customers',
      'Aggregator platforms (Glovo, HungerStation) take 30% commission on every order',
      'No way to capture customer data for retargeting',
    ],
    keySmartRestauUseCases: [
      'QR ordering at counter or table — reduces queue pressure',
      'Kitchen display system — eliminates shouted or printed tickets',
      'Digital menu — update sold-out items in seconds',
      'Direct ordering link — bypass aggregator commissions for returning customers',
    ],
    onboardingComplexity: 'MODERATE',
    keyBenefits: [
      'Queue moves faster — more customers served per hour during peak',
      'Fewer errors on large, fast orders',
      'Save 30% commission on every direct order that goes through SmartRestau',
      'Know who your repeat customers are and bring them back',
    ],
    avoidTopics: [
      'Fine dining service concepts',
      'Table reservation (walk-in model)',
      'Complex customisation flows (fast food menus are fixed)',
    ],
  },
}

// ─── Default fallback ─────────────────────────────────────────────────────────

export const DEFAULT_BUSINESS_TYPE_ENRICHMENT: BusinessTypeEnrichment = {
  peakHours:       ['12:00–14:00', '19:00–21:00'],
  peakDays:        ['Friday', 'Saturday'],
  bestContactHours:['10:00–12:00', '15:00–17:00'],
  staffSize:        'SMALL',
  seasonality:      'LOW',
  primaryDecisionMaker: 'OWNER',
  digitalReadiness:     'LOW',
  budgetCycle:          'MONTHLY',
  operationalPainPoints:  ['Manual order management', 'Staff coordination', 'Revenue tracking'],
  keySmartRestauUseCases: ['QR menu', 'Digital ordering', 'Kitchen display'],
  onboardingComplexity:   'SIMPLE',
  keyBenefits:  ['Save time', 'Fewer errors', 'Owner visibility'],
  avoidTopics:  ['Complex enterprise features'],
}
