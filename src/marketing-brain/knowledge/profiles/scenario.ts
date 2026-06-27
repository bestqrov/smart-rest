import type { Tone } from '../../models/MessageTemplate'
import type { FunnelStage } from '../../models/Scenario'
import type { Urgency } from '../types'

// ─── Profile shape ─────────────────────────────────────────────────────────────

export interface ScenarioEnrichment {
  urgency:           Urgency
  recommendedTone:   Tone
  primaryGoal:       string
  successIndicator:  string
  sendDelaySeconds:  number
  optimalSendHour:   number | null
  maxFollowupDays:   number
  keyMessages:       string[]
  avoidMessages:     string[]
  cta:               'BOOK_DEMO' | 'START_TRIAL' | 'REPLY' | 'VIEW_MENU' | 'REACTIVATE' | 'UPSELL' | 'RENEW'
  positionInJourney: number
}

// ─── Stage-level defaults ──────────────────────────────────────────────────────
// Applied when no trigger-specific override exists.

export const STAGE_PROFILES: Record<FunnelStage, ScenarioEnrichment> = {

  AWARENESS: {
    urgency:          'LOW',
    recommendedTone:  'FRIENDLY',
    primaryGoal:      'Capture attention and qualify the lead — establish that a real pain exists',
    successIndicator: 'Lead replies or clicks a link to learn more',
    sendDelaySeconds: 0,
    optimalSendHour:  10,
    maxFollowupDays:  7,
    keyMessages: [
      'Open with a concrete pain the owner recognises immediately',
      'Establish that the pain is costing them money or time daily',
      'Position SmartRestau as having solved this for similar businesses',
      'No hard sell — curiosity is the goal',
    ],
    avoidMessages: [
      'Pricing information (too early — kills curiosity)',
      'Feature lists (overwhelming at first contact)',
      'Competitor comparisons (defensive, not attractive)',
      'Long explanations of what SmartRestau is',
    ],
    cta:               'REPLY',
    positionInJourney: 1,
  },

  CONSIDERATION: {
    urgency:          'MEDIUM',
    recommendedTone:  'FRIENDLY',
    primaryGoal:      'Demonstrate specific value through proof — social, functional, or financial',
    successIndicator: 'Lead requests a demo, asks about pricing, or shares a specific question',
    sendDelaySeconds: 0,
    optimalSendHour:  11,
    maxFollowupDays:  14,
    keyMessages: [
      'Lead with a testimonial or case study from a similar business in the same region',
      'Quantify the benefit: "X minutes saved", "Y% fewer order errors"',
      'Acknowledge any concern the lead may have raised in previous contact',
      'Make the next step feel low-commitment: a 15-minute demo, not a contract',
    ],
    avoidMessages: [
      'Hard close or urgency tactics (not yet earned)',
      'Generic marketing claims without specifics',
      'Assumptions about what they need — ask a question instead',
    ],
    cta:               'BOOK_DEMO',
    positionInJourney: 2,
  },

  DECISION: {
    urgency:          'HIGH',
    recommendedTone:  'URGENT',
    primaryGoal:      'Remove the last obstacle and convert to trial or paid subscription',
    successIndicator: 'Lead activates trial or signs up for a plan',
    sendDelaySeconds: 0,
    optimalSendHour:  10,
    maxFollowupDays:  5,
    keyMessages: [
      'Directly address the most likely remaining objection (price, complexity, timing)',
      'Offer trial with zero commitment — risk reversal is key',
      'Create genuine urgency if applicable (trial expiry, limited onboarding slots)',
      'Summarise what they gain, not what they get (benefits, not features)',
    ],
    avoidMessages: [
      'Introducing new information or features (too late — causes confusion)',
      'Soft asks that delay the decision',
      'Multiple CTAs — one clear action only',
    ],
    cta:               'START_TRIAL',
    positionInJourney: 3,
  },

  ONBOARDING: {
    urgency:          'MEDIUM',
    recommendedTone:  'FRIENDLY',
    primaryGoal:      'Ensure the customer achieves their first win within 48 hours of activation',
    successIndicator: 'Customer receives their first digital order or sets up their first menu',
    sendDelaySeconds: 300,   // 5 minutes after activation — give them a moment
    optimalSendHour:  null,  // follow activation time, not fixed hour
    maxFollowupDays:  7,
    keyMessages: [
      'Congratulate — activation is a commitment worth acknowledging',
      'Give exactly ONE action to do right now (not a list)',
      'Promise that support is one message away',
      'Set the expectation for first result: "you should see your first order by tomorrow"',
    ],
    avoidMessages: [
      'Feature tours at this stage (overwhelms new users)',
      'Asking for feedback too early',
      'Mentioning pricing or upgrades during initial onboarding',
    ],
    cta:               'VIEW_MENU',
    positionInJourney: 4,
  },

  RETENTION: {
    urgency:          'LOW',
    recommendedTone:  'EMPATHETIC',
    primaryGoal:      'Deepen engagement and surface upsell opportunities at the right moment',
    successIndicator: 'Customer increases usage, enables a new feature, or refers a peer',
    sendDelaySeconds: 0,
    optimalSendHour:  14,   // post-lunch-service — owner has a moment
    maxFollowupDays:  30,
    keyMessages: [
      'Celebrate a usage milestone: "واصلتي 100 طلبية رقمية — مبروك!"',
      'Surface underused features that match their business pattern',
      'Loyalty and referral program benefits (when available)',
      'Share an insight from their own data: "أكثر ساعة طلبات: ٧ مساء"',
    ],
    avoidMessages: [
      'Heavy sales language (they are already a customer)',
      'Suggesting they are at risk (don\'t plant doubt)',
      'Contacting too frequently — once per month maximum for proactive retention',
    ],
    cta:               'UPSELL',
    positionInJourney: 5,
  },

  REACTIVATION: {
    urgency:          'HIGH',
    recommendedTone:  'EMPATHETIC',
    primaryGoal:      'Re-establish the relationship and remove the barrier that caused churn',
    successIndicator: 'Former customer re-activates or books a reactivation call',
    sendDelaySeconds: 0,
    optimalSendHour:  10,
    maxFollowupDays:  10,
    keyMessages: [
      'Acknowledge the silence without blame — show you noticed and care',
      'Ask what happened — a question is more powerful than an offer at first contact',
      'If churn was price-related, offer a concrete win-back incentive',
      'Reference what has improved since they left (if applicable)',
    ],
    avoidMessages: [
      'Assuming the reason for churn — ask first',
      'Aggressive urgency (they already left once — pressure will lose them permanently)',
      'Long messages explaining all the features (they know the product)',
    ],
    cta:               'REACTIVATE',
    positionInJourney: 6,
  },
}

// ─── Trigger-specific overrides ────────────────────────────────────────────────
// These override stage defaults when the scenario's trigger matches exactly.

export interface TriggerOverride extends Partial<ScenarioEnrichment> {}

export const TRIGGER_OVERRIDES: Record<string, TriggerOverride> = {

  demo_request_submitted: {
    urgency:          'HIGH',
    recommendedTone:  'FRIENDLY',
    primaryGoal:      'Confirm the demo request and set expectations within 5 minutes',
    sendDelaySeconds: 60,     // 1 minute — fast response signals professionalism
    optimalSendHour:  null,   // send immediately regardless of hour
    maxFollowupDays:  2,
    keyMessages: [
      'Confirm receipt immediately — speed of response is the first impression',
      'Give the lead a name: "سارة من SmartRestau غادي تتواصل معاك"',
      'Set a specific follow-up window: "نتواصلو معاك خلال ساعة"',
    ],
    cta: 'REPLY',
  },

  trial_day_3: {
    urgency:          'MEDIUM',
    recommendedTone:  'FRIENDLY',
    primaryGoal:      'Check that the customer is getting value and unblock any friction',
    sendDelaySeconds: 0,
    optimalSendHour:  14,
    keyMessages: [
      'Ask one specific check-in question: "واصلك شي طلبية رقمية؟"',
      'Offer help proactively — don\'t wait for them to ask',
      '3-day mark is where most trials go cold — personal touch is critical',
    ],
    cta: 'REPLY',
  },

  trial_day_7_no_order: {
    urgency:          'HIGH',
    recommendedTone:  'EMPATHETIC',
    primaryGoal:      'Re-engage a stalled trial before it expires',
    sendDelaySeconds: 0,
    optimalSendHour:  10,
    keyMessages: [
      'Normalise the situation — many people get busy in the first week',
      'Offer to set up the menu together in 10 minutes over the phone',
      'Create soft urgency: trial is halfway through',
    ],
    cta: 'BOOK_DEMO',
  },

  trial_expiry_reminder: {
    urgency:          'CRITICAL',
    recommendedTone:  'URGENT',
    sendDelaySeconds: 0,
    optimalSendHour:  9,
    maxFollowupDays:  2,
    keyMessages: [
      'Be explicit about what they lose when the trial ends (their data, setup, QR codes)',
      'Make conversion feel like a continuation, not a new decision',
      'Offer the easiest possible payment path',
    ],
    cta: 'RENEW',
  },

  subscription_cancelled: {
    urgency:          'HIGH',
    recommendedTone:  'EMPATHETIC',
    primaryGoal:      'Understand the cancellation reason before attempting a win-back',
    sendDelaySeconds: 3600,   // 1 hour — give them space after cancellation
    optimalSendHour:  null,
    keyMessages: [
      'Do not lead with a counter-offer — ask why first',
      'Make it safe to say the real reason (no pressure)',
      'A human follow-up call offer is more powerful than any discount at this stage',
    ],
    cta: 'REPLY',
  },

  order_milestone_10: {
    urgency:          'LOW',
    recommendedTone:  'PLAYFUL',
    primaryGoal:      'Celebrate and reinforce the habit — this is a retention booster',
    sendDelaySeconds: 0,
    keyMessages: [
      'Lead with the specific milestone number',
      'Frame it as their success, not ours',
      'Introduce a referral hook naturally: "شارك الخبر مع صديقك صاحب المطعم"',
    ],
    cta: 'UPSELL',
  },
}
