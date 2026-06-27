import { Types } from 'mongoose'
import type { Channel } from '../models/MessageTemplate'
import type { IScenario } from '../models/Scenario'

// ─── Campaign goal ────────────────────────────────────────────────────────────

/**
 * High-level intent of this messaging campaign.
 * Influences scoring, reasoning labels, and logging — not DB lookups.
 */
export type CampaignGoal =
  | 'ACQUIRE'      // new customer acquisition
  | 'CONVERT'      // demo → paid trial
  | 'ONBOARD'      // trial → active user
  | 'RETAIN'       // keep active customers engaged
  | 'REACTIVATE'   // win back churned / cold leads
  | 'UPSELL'       // expand within an existing account

// ─── DecisionContext ──────────────────────────────────────────────────────────

/**
 * Clean input contract for the Decision Engine.
 *
 * All targeting fields are string identifiers (slugs / ISO codes).
 * The engine resolves them to ObjectIds and full documents internally.
 *
 * Field naming mirrors the user-facing spec:
 *   { country, language, businessType, persona, channel, scenario, objection, campaignGoal }
 */
export interface DecisionContext {
  // ── Required ──
  ownerName:    string   // contact's first name for personalisation
  language:     string   // ISO 639-1: 'ar' | 'fr' | 'en'
  country:      string   // ISO 3166-1 alpha-2 uppercase: 'MA' | 'SA' | 'AE'
  businessType: string   // BusinessType.slug: 'restaurant' | 'cafe' | 'caterer'
  /**
   * The triggering event slug. Matches Scenario.trigger in the database.
   * Example: 'demo_request_submitted' | 'trial_day_3' | 'order_milestone_10'
   */
  scenario:     string

  // ── Optional overrides ──
  /** Delivery channel — defaults to WHATSAPP. */
  channel?:      Channel
  /** Explicit persona slug — skips inference when provided. */
  persona?:      string
  /** Active objection to address in this message. Objection.slug. */
  objection?:    string
  /** Campaign-level goal for scoring / logging context. */
  campaignGoal?: CampaignGoal

  // ── Variable fill values ──
  // All optional — missing ones resolve to template defaults or empty string.
  ownerPhone?:      string
  cafeName?:        string
  cafeCity?:        string
  cafeSubdomain?:   string
  agentName?:       string
  orderCount?:      number
  trialDaysLeft?:   number
  savedMinutes?:    number
  expiryDate?:      string   // pre-formatted, locale of the recipient
  supportLink?:     string
  trialLink?:       string
  demoBookingLink?: string
  customNote?:      string
  campaignId?:      string
}

// ─── ResolvedDecisionContext ──────────────────────────────────────────────────

/**
 * Internal context produced by DecisionEngine after resolving all string
 * identifiers to ObjectIds and fetching the scenario document.
 *
 * Passed to every selector — they never re-query the same lookups.
 * Never exposed externally.
 */
export interface ResolvedDecisionContext {
  /** Original input — never mutated. */
  context:          DecisionContext
  channel:          Channel

  // Language
  languageId:       Types.ObjectId
  languageCode:     string

  // Country
  countryId:        Types.ObjectId | null
  countryCode:      string

  // Business type
  businessTypeId:   Types.ObjectId | null
  businessTypeSlug: string

  // Persona (inferred if not supplied)
  personaId:        Types.ObjectId | null
  personaSlug:      string | null

  // Scenario (fetched from DB by trigger)
  scenarioId:       Types.ObjectId | null
  scenarioStage:    string | null           // FunnelStage value
  trigger:          string

  /** Full scenario document — fetched once during context resolution. */
  scenarioDoc:      IScenario | null

  // Objection (optional)
  objectionId:      Types.ObjectId | null
  objectionSlug:    string | null
}
