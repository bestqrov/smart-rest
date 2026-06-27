import type { Region }   from '../../models/Country'
import type {
  FormalityLevel, MarketMaturity, DigitalAdoption, DecisionMaking, ContactChannel,
} from '../types'

// ─── Profile shape (enrichment-only — no DB fields here) ─────────────────────

export interface CountryEnrichment {
  dialect:             string
  scriptDirection:     'RTL' | 'LTR'
  primaryLanguages:    string[]
  preferredChannels:   ContactChannel[]
  bestContactDays:     string[]
  bestContactHours:    string[]
  avoidContactPeriods: string[]
  formalityLevel:      FormalityLevel
  decisionMaking:      DecisionMaking
  trustBuilding:       string[]
  culturalNotes:       string[]
  businessCulture:     string[]
  marketMaturity:      MarketMaturity
  digitalAdoption:     DigitalAdoption
  keyPainPoints:       string[]
  vatRate:             number | null
  invoicingRequired:   boolean
}

// ─── Per-country profiles ─────────────────────────────────────────────────────

export const COUNTRY_PROFILES: Record<string, CountryEnrichment> = {

  // ── Morocco ────────────────────────────────────────────────────────────────
  MA: {
    dialect:          'darija',
    scriptDirection:  'RTL',
    primaryLanguages: ['ar', 'fr'],
    preferredChannels: ['WHATSAPP', 'PHONE', 'EMAIL'],
    bestContactDays:  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['10:00–12:00', '14:30–16:30', '20:00–22:00'],
    avoidContactPeriods: [
      'Friday 12:00–14:00 (Jumu\'ah prayer)',
      'Ramadan 13:00–19:00 (fatigue + fasting)',
      'Public holidays',
    ],
    formalityLevel: 'LOW',
    decisionMaking: 'INDIVIDUAL',
    trustBuilding: [
      'Reference a mutual contact or known person in the industry',
      'Demonstrate local presence (Morocco phone number, Moroccan team)',
      'Share testimonials from Moroccan restaurant owners by name and city',
      'Multiple WhatsApp conversations build relationship before asking for commitment',
      'Voice notes on WhatsApp feel more personal than typed text',
    ],
    culturalNotes: [
      'Address owner as "أستاذ" (Ustad) or "Si" — never just by first name initially',
      'Family business values: frame SmartRestau as helping the whole family succeed',
      'Ramadan is excellent for outreach at Iftar time (just after 19:30 in summer)',
      'Football match nights (especially Wydad/Raja derbies): avoid WhatsApp during games',
      'Pride in Moroccan products: mention local team, local support',
      'Haggling culture: expect price negotiation — build in room',
    ],
    businessCulture: [
      'Owners are often present on-site from mid-morning to past midnight',
      'Decisions are made by the owner directly — rarely by an employee',
      'Trust precedes contract — expect 2–4 conversations before any commitment',
      'Competition between neighbouring restaurants is intense in Casablanca medinas',
      'Word-of-mouth within a souk or neighbourhood spreads very fast (positive and negative)',
    ],
    marketMaturity:  'GROWING',
    digitalAdoption: 'MEDIUM',
    keyPainPoints: [
      'Order errors from handwritten tickets reaching the kitchen',
      'High staff turnover means constant retraining',
      'No visibility into table occupancy from outside the restaurant',
      'Cash-only operations make revenue tracking difficult',
      'Limited ability to offer promotions during off-peak hours',
    ],
    vatRate:           20,
    invoicingRequired: true,
  },

  // ── Tunisia ────────────────────────────────────────────────────────────────
  TN: {
    dialect:          'tounsi',
    scriptDirection:  'RTL',
    primaryLanguages: ['ar', 'fr'],
    preferredChannels: ['WHATSAPP', 'PHONE', 'EMAIL'],
    bestContactDays:  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['10:00–12:00', '15:00–17:00', '20:00–22:00'],
    avoidContactPeriods: [
      'Friday 11:30–14:00 (Jumu\'ah)',
      'Ramadan afternoons',
    ],
    formalityLevel: 'MEDIUM',
    decisionMaking: 'INDIVIDUAL',
    trustBuilding: [
      'Reference Tunisian success stories from Tunis, Sfax, or Sousse',
      'French-language materials accepted and often preferred for contracts',
      'Local phone number increases answer rate significantly',
    ],
    culturalNotes: [
      'Bilingual French-Arabic is natural in business conversation',
      'Sousse and Sfax have very active restaurant scenes — reference local context',
      'Tourism season (June–September) is peak business — contact outside season for decisions',
    ],
    businessCulture: [
      'Restaurant owners often wear multiple hats (chef, cashier, manager)',
      'Digital menus growing in tourist areas post-COVID',
      'Younger owners are open to tech; older generation needs more convincing',
    ],
    marketMaturity:  'GROWING',
    digitalAdoption: 'MEDIUM',
    keyPainPoints: [
      'Managing tourist-season spikes with same year-round staff',
      'No digital ordering slows table turnover',
      'Manual billing errors during busy Ramadan nights',
    ],
    vatRate:           19,
    invoicingRequired: true,
  },

  // ── Algeria ────────────────────────────────────────────────────────────────
  DZ: {
    dialect:          'darja',
    scriptDirection:  'RTL',
    primaryLanguages: ['ar', 'fr'],
    preferredChannels: ['WHATSAPP', 'PHONE', 'EMAIL'],
    bestContactDays:  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['10:00–12:00', '15:00–17:00', '20:30–22:00'],
    avoidContactPeriods: [
      'Friday prayer times',
      'Ramadan afternoons',
    ],
    formalityLevel: 'MEDIUM',
    decisionMaking: 'INDIVIDUAL',
    trustBuilding: [
      'Algerian-specific testimonials from known cities (Alger, Oran, Constantine)',
      'Be patient — decision cycles are longer than Morocco',
      'WhatsApp voice notes preferred to long text',
    ],
    culturalNotes: [
      'Mix of Arabic and French in daily communication',
      'Cash economy remains dominant — digital payment is growing but not dominant',
      'Family-run food businesses are the norm',
    ],
    businessCulture: [
      'Owner nearly always on-site and in charge of all decisions',
      'Significant distrust of new foreign-seeming products',
      'Local agent or reseller dramatically improves conversion',
    ],
    marketMaturity:  'EARLY',
    digitalAdoption: 'LOW',
    keyPainPoints: [
      'Severe difficulty managing walk-in peaks without digital tools',
      'Paper-based systems for everything from orders to inventory',
      'Staff coordination problems when owner is away',
    ],
    vatRate:           19,
    invoicingRequired: true,
  },

  // ── Egypt ──────────────────────────────────────────────────────────────────
  EG: {
    dialect:          'masri',
    scriptDirection:  'RTL',
    primaryLanguages: ['ar'],
    preferredChannels: ['WHATSAPP', 'PHONE', 'EMAIL'],
    bestContactDays:  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['11:00–13:00', '20:00–23:00'],
    avoidContactPeriods: [
      'Friday noon prayer',
      'Ramadan daytime',
      'National and religious holidays',
    ],
    formalityLevel: 'MEDIUM',
    decisionMaking: 'INDIVIDUAL',
    trustBuilding: [
      'Egyptian dialect in all communication — no MSA, no Gulf Arabic',
      'Cairo and Alexandria testimonials carry weight',
      'Social media presence (Facebook strong in Egypt) builds credibility',
    ],
    culturalNotes: [
      'Egyptian Arabic is widely understood across the Arab world — good for pan-Arab templates',
      'Humour and warmth are valued; stiff corporate tone falls flat',
      'Cairo restaurant scene is enormous and competitive',
    ],
    businessCulture: [
      'Large family-owned restaurant chains are common alongside solo operations',
      'Delivery aggregators (Talabat, etc.) have set digital expectations high',
      'Price sensitivity is high — value proposition must be crystal clear',
    ],
    marketMaturity:  'GROWING',
    digitalAdoption: 'MEDIUM',
    keyPainPoints: [
      'Managing delivery + dine-in orders simultaneously without errors',
      'High staff turnover in Cairo hospitality',
      'No real-time inventory visibility',
    ],
    vatRate:           14,
    invoicingRequired: true,
  },

  // ── Saudi Arabia ───────────────────────────────────────────────────────────
  SA: {
    dialect:          'najdi',
    scriptDirection:  'RTL',
    primaryLanguages: ['ar', 'en'],
    preferredChannels: ['WHATSAPP', 'EMAIL', 'PHONE'],
    bestContactDays:  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['09:00–12:00', '16:00–18:00'],
    avoidContactPeriods: [
      'Friday all day (weekend)',
      'Saturday (weekend)',
      'Prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha)',
      'Ramadan: strict respect for fasting schedule',
    ],
    formalityLevel: 'HIGH',
    decisionMaking: 'HIERARCHICAL',
    trustBuilding: [
      'Company registration and compliance documentation reassures decision-makers',
      'Saudi reference clients in Vision 2030 sectors carry enormous weight',
      'Formal proposal in Arabic and English is expected before commitment',
      'Patience is essential — multiple approvals may be needed',
    ],
    culturalNotes: [
      'Address owner/manager formally: Sheikh, Dr., Eng. as appropriate',
      'Vision 2030: frame SmartRestau as part of KSA digital transformation',
      'Gender dynamics: mixed-gender dining now permitted — acknowledge this market shift',
      'Halal compliance assumed — never mention otherwise',
    ],
    businessCulture: [
      'Restaurant sector grew 15%+ post-Vision 2030 reforms',
      'Large franchise operations common alongside family businesses',
      'Finance decisions often require owner + CFO alignment',
      'International brand knowledge (franchise owners) means higher tech expectations',
    ],
    marketMaturity:  'MATURE',
    digitalAdoption: 'HIGH',
    keyPainPoints: [
      'Managing large dining rooms (100+ covers) without POS or digital ordering',
      'Franchise compliance reporting across multiple branches',
      'High labour cost means efficiency tools have clear ROI',
    ],
    vatRate:           15,
    invoicingRequired: true,
  },

  // ── UAE ────────────────────────────────────────────────────────────────────
  AE: {
    dialect:          'khaleeji',
    scriptDirection:  'RTL',
    primaryLanguages: ['ar', 'en'],
    preferredChannels: ['WHATSAPP', 'EMAIL', 'PHONE'],
    bestContactDays:  ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['09:00–12:00', '15:00–18:00'],
    avoidContactPeriods: [
      'Friday (half-day)',
      'Saturday (weekend)',
      'Prayer times',
    ],
    formalityLevel: 'MEDIUM',
    decisionMaking: 'COLLABORATIVE',
    trustBuilding: [
      'English materials are equally effective as Arabic in Dubai/Abu Dhabi',
      'References from F&B brands in JBR, Downtown, or DIFC zone add credibility',
      'Registered UAE company presence strongly preferred',
    ],
    culturalNotes: [
      'Extremely diverse market: 80%+ expat workforce in hospitality',
      'International standards expected — benchmark against Lightspeed, Toast',
      'Fast pace of business: decisions can be made in days, not weeks',
    ],
    businessCulture: [
      'F&B licensing and compliance is complex — simplification is a major selling point',
      'Tourist-heavy zones (Dubai Marina, Downtown) have high table turnover pressure',
      'Contactless and QR ordering became standard post-COVID',
    ],
    marketMaturity:  'MATURE',
    digitalAdoption: 'HIGH',
    keyPainPoints: [
      'Managing multi-language menus (Arabic, English, sometimes Hindi/Tagalog)',
      'High staff turnover in tourist zones',
      'Real-time reporting demanded by investors / owners who are not on-site',
    ],
    vatRate:           5,
    invoicingRequired: true,
  },

  // ── Kuwait ─────────────────────────────────────────────────────────────────
  KW: {
    dialect:          'kuwaiti',
    scriptDirection:  'RTL',
    primaryLanguages: ['ar', 'en'],
    preferredChannels: ['WHATSAPP', 'PHONE', 'EMAIL'],
    bestContactDays:  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['10:00–12:00', '17:00–19:00'],
    avoidContactPeriods: ['Friday (weekend)', 'Saturday (weekend)', 'Prayer times'],
    formalityLevel: 'HIGH',
    decisionMaking: 'HIERARCHICAL',
    trustBuilding: [
      'Family network references are critical in Kuwait',
      'Gulf testimonials (SA, UAE) carry weight',
    ],
    culturalNotes: [
      'Very brand-conscious market — associate SmartRestau with quality',
      'Diwaniyya culture: informal business decisions happen in social gatherings',
    ],
    businessCulture: [
      'Restaurant investment often comes from wealthy families as side business',
      'Manager/operator runs day-to-day — owner is often absent',
    ],
    marketMaturity:  'MATURE',
    digitalAdoption: 'HIGH',
    keyPainPoints: [
      'Absent owner needs real-time mobile dashboard',
      'High consumer expectations for digital ordering',
    ],
    vatRate:           null,
    invoicingRequired: true,
  },

  // ── Qatar ──────────────────────────────────────────────────────────────────
  QA: {
    dialect:          'qatari',
    scriptDirection:  'RTL',
    primaryLanguages: ['ar', 'en'],
    preferredChannels: ['WHATSAPP', 'EMAIL', 'PHONE'],
    bestContactDays:  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['09:00–12:00', '16:00–18:00'],
    avoidContactPeriods: ['Friday', 'Saturday', 'Prayer times'],
    formalityLevel: 'HIGH',
    decisionMaking: 'HIERARCHICAL',
    trustBuilding: [
      'Reference FIFA World Cup 2022 tech adoption legacy',
      'Government-endorsed digital transformation narrative resonates strongly',
    ],
    culturalNotes: [
      'World Cup 2022 dramatically accelerated restaurant digitisation',
      'High expectations for international-grade software',
    ],
    businessCulture: [
      'Large F&B groups with multiple brands are common',
      'Procurement committees for multi-branch groups',
    ],
    marketMaturity:  'MATURE',
    digitalAdoption: 'HIGH',
    keyPainPoints: [
      'Managing international tourism peaks (events, conferences)',
      'Multilingual staff means complex onboarding for new tools',
    ],
    vatRate:           null,
    invoicingRequired: true,
  },

  // ── Senegal ────────────────────────────────────────────────────────────────
  SN: {
    dialect:          'wolof_french',
    scriptDirection:  'LTR',
    primaryLanguages: ['fr'],
    preferredChannels: ['WHATSAPP', 'PHONE', 'EMAIL'],
    bestContactDays:  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    bestContactHours: ['09:00–12:00', '15:00–18:00'],
    avoidContactPeriods: ['Friday prayers (Muslim majority country)', 'Public holidays'],
    formalityLevel: 'MEDIUM',
    decisionMaking: 'INDIVIDUAL',
    trustBuilding: [
      'Teranga (hospitality culture): warm, relationship-first approach is essential',
      'Dakar references from well-known quartiers (Almadies, Plateau) build credibility',
    ],
    culturalNotes: [
      'French is the language of business; Wolof is informal daily speech',
      'Mobile money (Wave, Orange Money) widely used — digital finance familiar',
      'Hospitality is deeply cultural — SmartRestau as guest experience tool resonates',
    ],
    businessCulture: [
      'Small family restaurants dominate, especially in Dakar',
      'Owner is typically present full-time',
      'Lower price sensitivity than Gulf but ROI argument still needed',
    ],
    marketMaturity:  'EARLY',
    digitalAdoption: 'MEDIUM',
    keyPainPoints: [
      'No digital menu or ordering — all verbal',
      'Cash management and accountability problems',
      'Rapid growth post-COVID but no tools to manage it',
    ],
    vatRate:           18,
    invoicingRequired: false,
  },

  // ── France ─────────────────────────────────────────────────────────────────
  FR: {
    dialect:          'french',
    scriptDirection:  'LTR',
    primaryLanguages: ['fr'],
    preferredChannels: ['EMAIL', 'WHATSAPP', 'PHONE'],
    bestContactDays:  ['Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours: ['09:30–12:00', '14:00–17:00'],
    avoidContactPeriods: [
      'Monday morning (weekly prep)',
      'Friday afternoon (early weekend)',
      'August (grande vacances)',
      'Lunch service 12:00–14:00',
      'Dinner service 19:00–22:00',
    ],
    formalityLevel: 'HIGH',
    decisionMaking: 'INDIVIDUAL',
    trustBuilding: [
      'French-language materials only — no English',
      'SIRET company registration reassures French business owners',
      'Data privacy (RGPD/GDPR) compliance messaging essential',
      'References from Paris or Lyon restaurants are most credible',
    ],
    culturalNotes: [
      'Gastronomy is sacred in France — frame SmartRestau as enhancing, not replacing, tradition',
      'French restaurateurs are proud of their craft — never imply their service is inefficient',
      '"Moins de paperasse, plus de plaisir" (less admin, more joy) resonates well',
      'Slow decision-making is cultural, not a signal of disinterest',
    ],
    businessCulture: [
      'Strict labour laws affect staffing decisions — automation sells itself',
      'Very competitive market, especially in Paris, Lyon, Bordeaux',
      'Older restaurant owners highly sceptical of new tech',
      'Bistrots and brasseries have thin margins — price ROI must be compelling',
    ],
    marketMaturity:  'MATURE',
    digitalAdoption: 'MEDIUM',
    keyPainPoints: [
      'Labour costs and rigid contracts make efficiency tools essential',
      'Difficult to manage multiple covers without digital flow',
      'Paper allergen/menu management is legally risky',
      'Competition from delivery platforms cutting margins',
    ],
    vatRate:           10,
    invoicingRequired: true,
  },
}

// ─── Region-level fallbacks ────────────────────────────────────────────────────

export const REGION_PROFILES: Record<Region, Partial<CountryEnrichment>> = {
  MENA: {
    dialect:             'arabic',
    scriptDirection:     'RTL',
    primaryLanguages:    ['ar', 'fr'],
    preferredChannels:   ['WHATSAPP', 'PHONE', 'EMAIL'],
    bestContactDays:     ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours:    ['10:00–12:00', '20:00–22:00'],
    avoidContactPeriods: ['Friday noon prayer', 'Ramadan afternoons'],
    formalityLevel:      'MEDIUM',
    decisionMaking:      'INDIVIDUAL',
    marketMaturity:      'GROWING',
    digitalAdoption:     'MEDIUM',
    vatRate:             null,
    invoicingRequired:   true,
  },
  GULF: {
    dialect:             'gulf_arabic',
    scriptDirection:     'RTL',
    primaryLanguages:    ['ar', 'en'],
    preferredChannels:   ['WHATSAPP', 'EMAIL', 'PHONE'],
    bestContactDays:     ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours:    ['09:00–12:00', '16:00–18:00'],
    avoidContactPeriods: ['Friday (weekend)', 'Saturday (weekend)', 'Prayer times'],
    formalityLevel:      'HIGH',
    decisionMaking:      'HIERARCHICAL',
    marketMaturity:      'MATURE',
    digitalAdoption:     'HIGH',
    vatRate:             null,
    invoicingRequired:   true,
  },
  AFRICA: {
    dialect:             'french',
    scriptDirection:     'LTR',
    primaryLanguages:    ['fr'],
    preferredChannels:   ['WHATSAPP', 'PHONE', 'EMAIL'],
    bestContactDays:     ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours:    ['09:00–12:00', '15:00–18:00'],
    avoidContactPeriods: ['Friday noon prayer'],
    formalityLevel:      'MEDIUM',
    decisionMaking:      'INDIVIDUAL',
    marketMaturity:      'EARLY',
    digitalAdoption:     'LOW',
    vatRate:             null,
    invoicingRequired:   false,
  },
  EUROPE: {
    dialect:             'french',
    scriptDirection:     'LTR',
    primaryLanguages:    ['fr'],
    preferredChannels:   ['EMAIL', 'WHATSAPP', 'PHONE'],
    bestContactDays:     ['Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours:    ['09:00–12:00', '14:00–17:00'],
    avoidContactPeriods: ['Monday morning', 'Friday afternoon', 'August'],
    formalityLevel:      'HIGH',
    decisionMaking:      'INDIVIDUAL',
    marketMaturity:      'MATURE',
    digitalAdoption:     'MEDIUM',
    vatRate:             20,
    invoicingRequired:   true,
  },
  OTHER: {
    dialect:           'english',
    scriptDirection:   'LTR',
    primaryLanguages:  ['en'],
    preferredChannels: ['EMAIL', 'WHATSAPP'],
    bestContactDays:   ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    bestContactHours:  ['09:00–17:00'],
    avoidContactPeriods: [],
    formalityLevel:    'MEDIUM',
    decisionMaking:    'INDIVIDUAL',
    marketMaturity:    'GROWING',
    digitalAdoption:   'MEDIUM',
    vatRate:           null,
    invoicingRequired: false,
  },
}

// ─── Default fallback ─────────────────────────────────────────────────────────

export const DEFAULT_COUNTRY_ENRICHMENT: CountryEnrichment = {
  dialect:             'arabic',
  scriptDirection:     'RTL',
  primaryLanguages:    ['ar'],
  preferredChannels:   ['WHATSAPP', 'PHONE'],
  bestContactDays:     ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  bestContactHours:    ['10:00–12:00', '20:00–22:00'],
  avoidContactPeriods: ['Friday prayers'],
  formalityLevel:      'MEDIUM',
  decisionMaking:      'INDIVIDUAL',
  trustBuilding:       ['Build relationship over multiple contacts', 'Use local references'],
  culturalNotes:       ['Relationship precedes business'],
  businessCulture:     ['Owner-operated, decisions made on the spot'],
  marketMaturity:      'GROWING',
  digitalAdoption:     'MEDIUM',
  keyPainPoints:       ['Manual order management', 'Staff coordination', 'Revenue tracking'],
  vatRate:             null,
  invoicingRequired:   false,
}
