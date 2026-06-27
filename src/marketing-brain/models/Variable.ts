import { Schema, model, Document, Model } from 'mongoose'

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * The runtime data type of the variable's value.
 * Used for validation before template rendering and for AI hint generation.
 */
export type VariableDataType = 'text' | 'number' | 'date' | 'url' | 'boolean' | 'currency'

/**
 * Where the value comes from at runtime, when this template is sent.
 *
 * CAFE_PROFILE   — pulled from the Cafe document (name, city, subdomain, etc.)
 * CONTACT        — pulled from the lead/customer record (name, phone, language)
 * COMPUTED       — derived at send time (e.g. orderCount, trialDaysLeft)
 * CAMPAIGN       — set per campaign/batch when the sequence is triggered
 * MANUAL         — agent fills in manually before sending
 * SYSTEM         — injected by the platform (agentName, supportLink, currentDate)
 */
export type VariableSource =
  | 'CAFE_PROFILE'
  | 'CONTACT'
  | 'COMPUTED'
  | 'CAMPAIGN'
  | 'MANUAL'
  | 'SYSTEM'

export const VARIABLE_SOURCES: VariableSource[] = [
  'CAFE_PROFILE', 'CONTACT', 'COMPUTED', 'CAMPAIGN', 'MANUAL', 'SYSTEM',
]

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/** Validation constraints applied when the variable value is resolved at send time. */
const ValidationSchema = new Schema(
  {
    required:  { type: Boolean, default: false },
    minLength: { type: Number,  default: null,  min: 0 },
    maxLength: { type: Number,  default: null,  min: 1 },
    min:       { type: Number,  default: null },   // for number/currency
    max:       { type: Number,  default: null },   // for number/currency
    // ECMAScript regex string — validated at send time (not stored as RegExp
    // so it round-trips cleanly through MongoDB)
    pattern:   { type: String,  default: null,  trim: true },
    // Allowed discrete values (empty = unrestricted)
    allowedValues: [{ type: String, trim: true }],
  },
  { _id: false },
)

/** Human-readable translation of the variable description. */
const TranslationSchema = new Schema(
  {
    ar: { type: String, trim: true, maxlength: 300 },
    fr: { type: String, trim: true, maxlength: 300 },
    en: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
)

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IVariableValidation {
  required:      boolean
  minLength:     number | null
  maxLength:     number | null
  min:           number | null
  max:           number | null
  pattern:       string | null
  allowedValues: string[]
}

export interface IVariable extends Document {
  /** The placeholder key used in template bodies: {{key}} */
  key:           string
  dataType:      VariableDataType
  source:        VariableSource
  /** Which field/path provides this value at the source (dot-notation).
   *  E.g. 'cafe.name' for CAFE_PROFILE, 'contact.phone' for CONTACT. */
  sourcePath:    string
  descriptions:  { ar: string; fr: string; en: string }
  defaultValue:  string
  exampleValues: string[]
  validation:    IVariableValidation
  /** True = available in any template. False = only meaningful in specific scenarios. */
  isGlobal:      boolean
  isActive:      boolean
  createdAt:     Date
  updatedAt:     Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const VariableSchema = new Schema<IVariable>(
  {
    key: {
      type:     String,
      required: [true, 'Variable key is required'],
      unique:   true,
      trim:     true,
      // camelCase only — matches the {{key}} pattern used in template bodies
      match:    [/^[a-z][a-zA-Z0-9]*$/, 'Key must be camelCase (starts with lowercase letter)'],
    },
    dataType: {
      type:     String,
      required: [true, 'Data type is required'],
      enum:     {
        values:  ['text', 'number', 'date', 'url', 'boolean', 'currency'],
        message: 'Invalid data type',
      },
      default: 'text',
    },
    source: {
      type:     String,
      required: [true, 'Source is required'],
      enum:     { values: VARIABLE_SOURCES, message: 'Invalid variable source' },
    },
    sourcePath: {
      type:      String,
      trim:      true,
      maxlength: [200, 'Source path too long'],
      default:   '',
    },
    descriptions: { type: TranslationSchema, default: () => ({}) },
    defaultValue: {
      type:      String,
      trim:      true,
      maxlength: [500, 'Default value too long'],
      default:   '',
    },
    exampleValues: [{
      type:      String,
      trim:      true,
      maxlength: [300, 'Example value too long'],
    }],
    validation: { type: ValidationSchema, default: () => ({}) },
    isGlobal:   { type: Boolean, required: true, default: true  },
    isActive:   { type: Boolean, required: true, default: true  },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────
//
// Primary lookup: template renderer resolves {{key}} → Variable in a single
// findOne({ key }). The unique index on `key` covers this path efficiently.
//
// Secondary queries: admin UI filters by source/dataType/isGlobal.

VariableSchema.index({ key: 1 },                            { unique: true })
VariableSchema.index({ source: 1,   isActive: 1 })
VariableSchema.index({ dataType: 1, isActive: 1 })
VariableSchema.index({ isGlobal: 1, isActive: 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const Variable: Model<IVariable> =
  model<IVariable>('Variable', VariableSchema)
