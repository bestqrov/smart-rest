import type { Types } from 'mongoose'
import type { IAIRule }           from '../models/AIRule'
import type { IMessageTemplate, Channel } from '../models/MessageTemplate'
import type { IFollowupSequence } from '../models/FollowupSequence'

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * Everything the engine knows about the contact/lead at decision time.
 * Callers supply what they have — missing optional fields resolve to
 * defaults or generate warnings, never hard errors.
 */
export interface LeadProfile {
  // ── Required ──
  ownerName:        string   // contact name for personalisation
  languageCode:     string   // ISO 639-1: 'ar', 'fr', 'en'
  countryCode:      string   // ISO 3166-1 alpha-2 uppercase: 'MA', 'SA'
  businessTypeSlug: string   // matches BusinessType.slug: 'restaurant', 'cafe'
  trigger:          string   // matches Scenario.trigger: 'demo_request_submitted'

  // ── Persona override (skip inference when provided) ──
  personaSlug?: string

  // ── Channel (defaults to WHATSAPP when absent) ──
  channel?: Channel

  // ── Cafe context (CAFE_PROFILE variables) ──
  phone?:          string
  cafeName?:       string
  cafeCity?:       string
  cafeSubdomain?:  string

  // ── Computed values (COMPUTED variables) ──
  orderCount?:    number
  trialDaysLeft?: number
  savedMinutes?:  number
  expiryDate?:    string    // human-readable, locale of the recipient

  // ── Campaign values (CAMPAIGN variables) ──
  supportLink?:     string
  trialLink?:       string
  demoBookingLink?: string
  campaignId?:      string

  // ── System values (SYSTEM variables) ──
  agentName?: string

  // ── Manual agent input (MANUAL variables) ──
  customNote?: string
}

// ─── Internal resolved context ────────────────────────────────────────────────

/**
 * Built by DecisionEngine after resolving slug/code references to ObjectIds.
 * Passed to every service so they don't each re-query the same lookups.
 */
export interface ResolvedContext {
  profile:          LeadProfile
  channel:          Channel
  languageId:       Types.ObjectId
  languageCode:     string
  countryId:        Types.ObjectId | null
  countryCode:      string
  businessTypeId:   Types.ObjectId | null
  businessTypeSlug: string
  personaId:        Types.ObjectId | null
  personaSlug:      string | null
  scenarioId:       Types.ObjectId | null
  scenarioStage:    string | null     // FunnelStage value for prompt metadata
  trigger:          string
}

// ─── Intermediate results ─────────────────────────────────────────────────────

export interface TemplateMatch {
  template:      IMessageTemplate
  score:         number
  /** 0 = exact, 1 = any persona, 2 = any scenario, 3 = any channel */
  fallbackLevel: number
}

export interface SequenceMatch {
  sequence:      IFollowupSequence
  score:         number
  fallbackLevel: number
}

export interface VariableResolution {
  resolved: Record<string, string>   // {{key}} → final string value
  warnings: string[]
  errors:   string[]
}

// ─── Prompt output ────────────────────────────────────────────────────────────

/**
 * Provider-agnostic prompt container.
 *
 * Mapping to popular providers:
 *   Anthropic:   { system: prompt.system, messages: [{ role:'user', content: prompt.user }] }
 *   OpenAI:      messages: [{ role:'system', content: prompt.system }, { role:'user', content: prompt.user }]
 *   Gemini:      { systemInstruction: prompt.system, contents: [{ role:'user', parts:[{text: prompt.user}] }] }
 *   Groq:        same as OpenAI
 */
export interface BuiltPrompt {
  /** System-level instruction block: AI identity + rules + constraints. */
  system: string
  /** User-facing prompt: task description + base template + resolved variables. */
  user: string
  /** Structured constraints parsed from rules (for post-generation validation). */
  constraints: {
    maxChars:          number | null
    maxLines:          number | null
    maxWords:          number | null
    forbiddenPatterns: string[]
    requiredTokens:    string[]
  }
  /** Metadata for logging, analytics, and debugging — not sent to the AI. */
  metadata: {
    templateSlug:   string
    personaSlug:    string | null
    scenarioStage:  string | null
    languageCode:   string
    channel:        string
    rulesApplied:   number
    hardRulesCount: number
  }
}

// ─── Final result ─────────────────────────────────────────────────────────────

export interface DecisionResult {
  /** Chosen template, or null if no match found. */
  template:          IMessageTemplate | null
  /** Chosen follow-up sequence, or null if none matches. */
  followupSequence:  IFollowupSequence | null
  /** All {{key}} values resolved, ready for template rendering. */
  resolvedVariables: Record<string, string>
  /** AI rules that apply to this context, sorted by priority. */
  aiRules:           IAIRule[]
  /** Final built prompt, or null if template is null. */
  prompt:            BuiltPrompt | null
  /** Template selector confidence score. */
  templateScore:     number
  /** Non-blocking issues (missing optional vars, soft mismatches). */
  warnings:          string[]
  /** Blocking issues that prevented a decision (invalid profile, etc.). */
  errors:            string[]
}
