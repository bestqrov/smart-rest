import { Schema, model, Document, Model, Types } from 'mongoose'
import type { Channel } from './MessageTemplate'

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * What aspect of template generation this rule governs.
 *
 * TONE       — voice and register (formal / friendly / urgent / empathetic)
 * LENGTH     — character/word/line limits per channel or context
 * LANGUAGE   — dialect, script, formality level for a given language+country combo
 * STRUCTURE  — required sections, paragraph order, opening/closing patterns
 * FORBIDDEN  — content that must never appear (words, topics, competitors)
 * REQUIRED   — content that must always appear in a given context
 * FORMAT     — markup rules (bullet points, emojis, line breaks, bold syntax)
 */
export type RuleType =
  | 'TONE'
  | 'LENGTH'
  | 'LANGUAGE'
  | 'STRUCTURE'
  | 'FORBIDDEN'
  | 'REQUIRED'
  | 'FORMAT'

export const RULE_TYPES: RuleType[] = [
  'TONE', 'LENGTH', 'LANGUAGE', 'STRUCTURE', 'FORBIDDEN', 'REQUIRED', 'FORMAT',
]

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/** Targeting: which templates this rule applies to.
 *  Empty array on any field = "applies to all". */
const AppliesToSchema = new Schema(
  {
    personas:      [{ type: Schema.Types.ObjectId, ref: 'Persona'      }],
    scenarios:     [{ type: Schema.Types.ObjectId, ref: 'Scenario'     }],
    countries:     [{ type: Schema.Types.ObjectId, ref: 'Country'      }],
    languages:     [{ type: Schema.Types.ObjectId, ref: 'Language'     }],
    businessTypes: [{ type: Schema.Types.ObjectId, ref: 'BusinessType' }],
    channels: [{
      type: String,
      enum: ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH'],
    }],
  },
  { _id: false },
)

/** The rule body: instruction the AI must follow. */
const RuleBodySchema = new Schema(
  {
    // The instruction handed verbatim to the AI as a system-level constraint.
    // E.g.: "Use Darija (Moroccan Arabic) dialect. Write max 3 short paragraphs."
    instruction: {
      type:      String,
      required:  [true, 'Instruction is required'],
      trim:      true,
      maxlength: [2000, 'Instruction too long'],
    },
    // Concrete examples that clarify the instruction
    goodExamples: [{ type: String, trim: true, maxlength: 500 }],
    badExamples:  [{ type: String, trim: true, maxlength: 500 }],
    // Quantitative constraint (e.g. maxChars: 160 for SMS)
    maxChars:    { type: Number, min: 0, default: null },
    maxLines:    { type: Number, min: 0, default: null },
    maxWords:    { type: Number, min: 0, default: null },
    // Patterns the AI must avoid (regexes or plain strings)
    forbiddenPatterns: [{ type: String, trim: true }],
    // Tokens that must appear (for REQUIRED rules)
    requiredTokens:    [{ type: String, trim: true }],
  },
  { _id: false },
)

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IAppliesTo {
  personas:      Types.ObjectId[]
  scenarios:     Types.ObjectId[]
  countries:     Types.ObjectId[]
  languages:     Types.ObjectId[]
  businessTypes: Types.ObjectId[]
  channels:      Channel[]
}

export interface IRuleBody {
  instruction:       string
  goodExamples:      string[]
  badExamples:       string[]
  maxChars:          number | null
  maxLines:          number | null
  maxWords:          number | null
  forbiddenPatterns: string[]
  requiredTokens:    string[]
}

export interface IAIRule extends Document {
  slug:       string
  ruleType:   RuleType
  nameEn:     string
  nameAr:     string
  nameFr:     string
  appliesTo:  IAppliesTo
  rule:       IRuleBody
  // Higher priority rules win when two rules conflict.
  // Range: 1 (lowest) – 100 (highest).
  priority:   number
  // Hard rules are always enforced; soft rules are preferred but can be relaxed.
  isHard:     boolean
  isActive:   boolean
  createdAt:  Date
  updatedAt:  Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const AIRuleSchema = new Schema<IAIRule>(
  {
    slug: {
      type:      String,
      required:  [true, 'Slug is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric'],
    },
    ruleType: {
      type:     String,
      required: [true, 'Rule type is required'],
      enum:     { values: RULE_TYPES, message: 'Invalid rule type' },
    },
    nameEn: {
      type:      String,
      required:  [true, 'English name is required'],
      trim:      true,
      maxlength: [150, 'Name too long'],
    },
    nameAr: {
      type:      String,
      required:  [true, 'Arabic name is required'],
      trim:      true,
      maxlength: [150, 'Name too long'],
    },
    nameFr: {
      type:      String,
      required:  [true, 'French name is required'],
      trim:      true,
      maxlength: [150, 'Name too long'],
    },
    appliesTo: { type: AppliesToSchema, default: () => ({}) },
    rule:      { type: RuleBodySchema, required: [true, 'Rule body is required'] },
    priority:  { type: Number, required: true, default: 50, min: 1, max: 100 },
    isHard:    { type: Boolean, required: true, default: false },
    isActive:  { type: Boolean, required: true, default: true  },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────
//
// Primary query: "give me all HARD rules that apply to WhatsApp + Moroccan personas,
// ordered by priority" — happens every time AI generates a template.

AIRuleSchema.index({ ruleType: 1, isActive: 1, priority: -1 })
AIRuleSchema.index({ isHard: 1,   isActive: 1, priority: -1 })
AIRuleSchema.index({ 'appliesTo.channels':      1, isActive: 1 })
AIRuleSchema.index({ 'appliesTo.personas':      1, isActive: 1 })
AIRuleSchema.index({ 'appliesTo.countries':     1, isActive: 1 })
AIRuleSchema.index({ 'appliesTo.languages':     1, isActive: 1 })
AIRuleSchema.index({ 'appliesTo.scenarios':     1, isActive: 1 })
AIRuleSchema.index({ 'appliesTo.businessTypes': 1, isActive: 1 })
AIRuleSchema.index({ slug: 1 }, { unique: true })

// ─── Model ────────────────────────────────────────────────────────────────────

export const AIRule: Model<IAIRule> =
  model<IAIRule>('AIRule', AIRuleSchema)
