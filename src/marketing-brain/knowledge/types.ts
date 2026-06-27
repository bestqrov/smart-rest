import type { Region }             from '../models/Country'
import type { ObjectionCategory, ObjectionFrequency } from '../models/Objection'
import type { Channel, Tone }       from '../models/MessageTemplate'
import type { FunnelStage }         from '../models/Scenario'

/**
 * Broader channel type that includes PHONE (a real outreach channel for country/persona
 * preferences) even though SmartRestau doesn't send via phone itself.
 */
export type ContactChannel = Channel | 'PHONE'

// ─── Shared primitives ────────────────────────────────────────────────────────

export type FormalityLevel  = 'HIGH' | 'MEDIUM' | 'LOW'
export type MarketMaturity  = 'EARLY' | 'GROWING' | 'MATURE'
export type DigitalAdoption = 'LOW' | 'MEDIUM' | 'HIGH'
export type DecisionMaking  = 'HIERARCHICAL' | 'COLLABORATIVE' | 'INDIVIDUAL'
export type TechComfort     = 'BASIC' | 'COMFORTABLE' | 'ADVANCED'
export type DecisionSpeed   = 'SLOW' | 'MEDIUM' | 'FAST'
export type PriceSensitivity= 'HIGH' | 'MEDIUM' | 'LOW'
export type TrustRequirement= 'HIGH' | 'MEDIUM' | 'LOW'
export type ContentLength   = 'SHORT' | 'MEDIUM' | 'LONG'
export type Urgency         = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type StaffSize       = 'SOLO' | 'SMALL' | 'MEDIUM' | 'LARGE'
export type Complexity      = 'SIMPLE' | 'MODERATE' | 'COMPLEX'
export type Seasonality     = 'LOW' | 'MEDIUM' | 'HIGH'
export type BudgetCycle     = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'AD_HOC'
export type DecisionMaker   = 'OWNER' | 'MANAGER' | 'COMMITTEE'

// ─── CountryKnowledge ─────────────────────────────────────────────────────────

/** Enriched country record combining DB fields with hardcoded cultural expertise. */
export interface CountryKnowledge {
  // From DB
  code:        string
  nameEn:      string
  nameAr:      string
  nameFr:      string
  region:      Region
  currency:    string
  phonePrefix: string

  // Language
  /** Primary spoken dialect/variant actually used day-to-day (not official MSA). */
  dialect:          string   // 'darija', 'gulf_arabic', 'tounsi', 'french', etc.
  scriptDirection:  'RTL' | 'LTR'
  /** Language codes in priority order for this market. */
  primaryLanguages: string[]

  // Communication
  /** Channels ranked by effectiveness for B2B restaurant outreach in this country. */
  preferredChannels:   ContactChannel[]
  /** Days suitable for business outreach (exclude weekends per local calendar). */
  bestContactDays:     string[]
  /** Time windows most likely to reach a decision-maker (local time). */
  bestContactHours:    string[]
  /** Periods/times to avoid contacting (prayer times, Ramadan restrictions, etc.). */
  avoidContactPeriods: string[]

  // Culture
  formalityLevel:  FormalityLevel
  decisionMaking:  DecisionMaking
  /** How trust is built in this market — actionable insights for messaging. */
  trustBuilding:   string[]
  /** Cultural facts that should inform copy (religion, family values, etc.). */
  culturalNotes:   string[]
  /** How restaurant business is conducted — who decides, how fast, what matters. */
  businessCulture: string[]

  // Market
  marketMaturity:  MarketMaturity
  digitalAdoption: DigitalAdoption
  /** Top pain points reported by restaurant owners in this country. */
  keyPainPoints:   string[]

  // Regulatory
  vatRate:           number | null
  invoicingRequired: boolean
}

// ─── PersonaKnowledge ─────────────────────────────────────────────────────────

/** Enriched persona combining DB fields with communication strategy profiles. */
export interface PersonaKnowledge {
  // From DB
  slug:         string
  nameEn:       string
  nameAr:       string
  nameFr:       string
  ageRange:     { min: number; max: number }
  painPoints:   string[]
  goals:        string[]
  preferredChannels: string[]

  // Derived from demographic
  techComfort:       TechComfort
  decisionSpeed:     DecisionSpeed
  priceSensitivity:  PriceSensitivity
  trustRequirement:  TrustRequirement

  // Communication strategy
  idealChannel:  Channel
  contentLength: ContentLength
  /** Tones in order of effectiveness for this persona. */
  preferredTones: Tone[]

  // Messaging intelligence
  /** Words and concepts that resonate — AI uses these when generating copy. */
  triggerWords:       string[]
  /** Words and framings that alienate or cause friction. */
  avoidWords:         string[]
  /** Concrete do/don't principles for writing messages to this persona. */
  messagingPrinciples: string[]

  // Journey
  /** Typical days from first contact to decision. */
  typicalJourneyDays:  number
  /** Number of nurture touchpoints usually needed before conversion. */
  nurtureTouchpoints:  number
  /** Objection types this persona most commonly raises. */
  likelyObjections:    ObjectionCategory[]
}

// ─── ScenarioKnowledge ────────────────────────────────────────────────────────

/** Enriched scenario combining DB fields with funnel-stage strategy. */
export interface ScenarioKnowledge {
  // From DB
  slug:     string
  stage:    FunnelStage
  trigger:  string
  nameEn:   string
  nameAr:   string
  nameFr:   string
  priority: number

  // Strategy
  urgency:          Urgency
  recommendedTone:  Tone
  /** The ONE outcome we want from this send. */
  primaryGoal:      string
  /** What a successful interaction looks like (measurable). */
  successIndicator: string

  // Timing
  /** Seconds to wait after trigger before sending (0 = immediate). */
  sendDelaySeconds:  number
  /** Preferred hour of day (0–23, local time). null = anytime. */
  optimalSendHour:   number | null
  /** Stop follow-up attempts after this many days from trigger. */
  maxFollowupDays:   number

  // Content strategy
  /** Themes and points that MUST appear in the message. */
  keyMessages:   string[]
  /** Topics and framings to avoid at this funnel stage. */
  avoidMessages: string[]
  /** Recommended CTA type for this scenario. */
  cta: 'BOOK_DEMO' | 'START_TRIAL' | 'REPLY' | 'VIEW_MENU' | 'REACTIVATE' | 'UPSELL' | 'RENEW'

  /** 1 = very first contact, higher = deeper in the nurture sequence. */
  positionInJourney: number
}

// ─── ObjectionKnowledge ───────────────────────────────────────────────────────

/** Enriched objection combining DB fields with handling playbook. */
export interface ObjectionKnowledge {
  // From DB
  slug:         string
  category:     ObjectionCategory
  frequency:    ObjectionFrequency
  translations: Array<{ lang: string; text: string }>

  // Psychology
  /** The deeper fear or concern behind the stated objection. */
  underlyingFear: string
  /** One-line emotional state: "I'm afraid of wasting money on something I don't understand." */
  emotionalCore:  string

  // Handling playbook
  /** Overall approach (validate → reframe → prove → close). */
  handlingStrategy: string
  /** Opening lines that acknowledge the concern without being defensive. */
  acknowledgements: string[]
  /** Arguments and angles that shift perspective. */
  reframingTactics: string[]
  /** Types of evidence that work best for this objection category. */
  proofTypes: Array<'TESTIMONIAL' | 'STAT' | 'DEMO' | 'GUARANTEE' | 'CASE_STUDY' | 'TRIAL'>

  // Escalation
  /** Days within which to resolve this objection before lead goes cold. */
  resolutionWindowDays: number
  /** Condition that should trigger a human follow-up call. */
  escalationTrigger: string
  /** Phrases that make the objection worse — never say these. */
  doNotSay: string[]
}

// ─── BusinessTypeKnowledge ────────────────────────────────────────────────────

/** Enriched business type combining DB fields with industry expertise. */
export interface BusinessTypeKnowledge {
  // From DB
  slug:      string
  nameEn:    string
  nameAr:    string
  nameFr:    string
  icon:      string
  sortOrder: number

  // Operations
  /** Hours when the business is at peak — avoid contacting during these. */
  peakHours:    string[]
  peakDays:     string[]
  /** Best windows to reach the owner (off-peak, before/after service). */
  bestContactHours: string[]
  staffSize:     StaffSize
  seasonality:   Seasonality

  // Decision profile
  primaryDecisionMaker: DecisionMaker
  digitalReadiness:     DigitalAdoption
  budgetCycle:          BudgetCycle

  // Pain points & SmartRestau relevance
  /** Operational frustrations this business type suffers from. */
  operationalPainPoints: string[]
  /** SmartRestau features that matter most to this business type. */
  keySmartRestauUseCases: string[]
  onboardingComplexity:   Complexity

  // Messaging
  /** Benefits to lead with — what resonates most for this business type. */
  keyBenefits:  string[]
  /** Topics/angles that don't land well with this business type. */
  avoidTopics:  string[]
}

// ─── Batch result types ───────────────────────────────────────────────────────

export interface KnowledgeMap<T> {
  [key: string]: T
}
