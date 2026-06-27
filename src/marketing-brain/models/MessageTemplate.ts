import { Schema, model, Document, Model, Types } from 'mongoose'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type Channel = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH'
export type Format  = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'INTERACTIVE' | 'CAROUSEL'
export type Tone    = 'FORMAL' | 'FRIENDLY' | 'URGENT' | 'EMPATHETIC' | 'PLAYFUL'
export type Creator = 'SEED' | 'AI' | 'MANUAL'

export const CHANNELS: Channel[] = ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH']
export const FORMATS:  Format[]  = ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'INTERACTIVE', 'CAROUSEL']
export const TONES:    Tone[]    = ['FORMAL', 'FRIENDLY', 'URGENT', 'EMPATHETIC', 'PLAYFUL']

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/** A placeholder variable inside the template body, e.g. {{cafeName}} */
const VariableSchema = new Schema(
  {
    key:          { type: String, required: true, trim: true, match: /^[a-zA-Z][a-zA-Z0-9_]*$/ },
    descriptionEn:{ type: String, trim: true, maxlength: 200 },
    required:     { type: Boolean, default: true },
    defaultValue: { type: String, trim: true, default: '' },
    // 'text' | 'number' | 'date' | 'url'
    valueType:    { type: String, enum: ['text', 'number', 'date', 'url'], default: 'text' },
  },
  { _id: false },
)

/** Running performance counters — seeded as zeros, updated by send pipeline */
const StatsSchema = new Schema(
  {
    sent:      { type: Number, default: 0, min: 0 },
    delivered: { type: Number, default: 0, min: 0 },
    opened:    { type: Number, default: 0, min: 0 },
    clicked:   { type: Number, default: 0, min: 0 },
    replied:   { type: Number, default: 0, min: 0 },
    converted: { type: Number, default: 0, min: 0 },
    bounced:   { type: Number, default: 0, min: 0 },
  },
  { _id: false },
)

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IMessageTemplate extends Document {
  slug:         string
  channel:      Channel
  format:       Format
  tone:         Tone
  // Targeting (null/empty = universal)
  scenario:     Types.ObjectId        // ref Scenario — required
  persona:      Types.ObjectId        // ref Persona  — required
  language:     Types.ObjectId        // ref Language — required
  country:      Types.ObjectId | null // ref Country  — null = all countries
  businessType: Types.ObjectId | null // ref BusinessType — null = all types
  // Content
  subject:      string   // email subject line (empty for other channels)
  body:         string   // template body with {{placeholders}}
  mediaUrl:     string   // image/video/doc URL for non-TEXT formats
  variables:    Array<{
    key:           string
    descriptionEn: string
    required:      boolean
    defaultValue:  string
    valueType:     string
  }>
  // Optimisation
  stats: {
    sent: number; delivered: number; opened: number
    clicked: number; replied: number; converted: number; bounced: number
  }
  // Meta
  version:      number   // incremented on edit; old versions preserved via archiving
  tags:         string[]
  createdBy:    Creator
  isActive:     boolean
  createdAt:    Date
  updatedAt:    Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const MessageTemplateSchema = new Schema<IMessageTemplate>(
  {
    slug: {
      type:      String,
      required:  [true, 'Slug is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric'],
    },
    channel: {
      type:     String,
      required: [true, 'Channel is required'],
      enum:     { values: CHANNELS, message: 'Invalid channel' },
    },
    format: {
      type:     String,
      required: [true, 'Format is required'],
      enum:     { values: FORMATS, message: 'Invalid format' },
      default:  'TEXT',
    },
    tone: {
      type:    String,
      enum:    { values: TONES, message: 'Invalid tone' },
      default: 'FRIENDLY',
    },
    // Targeting
    scenario:     { type: Schema.Types.ObjectId, ref: 'Scenario',     required: [true, 'Scenario is required'] },
    persona:      { type: Schema.Types.ObjectId, ref: 'Persona',      required: [true, 'Persona is required']  },
    language:     { type: Schema.Types.ObjectId, ref: 'Language',     required: [true, 'Language is required'] },
    country:      { type: Schema.Types.ObjectId, ref: 'Country',      default: null },
    businessType: { type: Schema.Types.ObjectId, ref: 'BusinessType', default: null },
    // Content
    subject:  { type: String, trim: true, maxlength: [250, 'Subject too long'], default: '' },
    body: {
      type:      String,
      required:  [true, 'Body is required'],
      trim:      true,
      maxlength: [10000, 'Body too long (max 10 000 chars)'],
    },
    mediaUrl:  { type: String, trim: true, default: '' },
    variables: { type: [VariableSchema], default: [] },
    // Optimisation
    stats:     { type: StatsSchema, default: () => ({}) },
    // Meta
    version:   { type: Number, default: 1, min: 1 },
    tags:      [{ type: String, trim: true, lowercase: true, maxlength: 50 }],
    createdBy: {
      type:    String,
      enum:    { values: ['SEED', 'AI', 'MANUAL'], message: 'Invalid creator' },
      default: 'MANUAL',
    },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────
//
// Query patterns at 100k+ scale:
//   "all WhatsApp templates in French for Restaurant persona at CONSIDERATION stage in Morocco"
//   → hits { channel, language, scenario, persona, country, isActive }
//
// These compound indexes are ordered from highest cardinality to lowest
// to maximize selectivity and minimize scan size.

// Primary retrieval: fetch by targeting dimensions
MessageTemplateSchema.index({
  channel:      1,
  language:     1,
  scenario:     1,
  persona:      1,
  isActive:     1,
})

// Secondary retrieval: filter by country + business type
MessageTemplateSchema.index({
  country:      1,
  businessType: 1,
  channel:      1,
  isActive:     1,
})

// Performance optimisation: sort by conversion rate
MessageTemplateSchema.index({ 'stats.converted': -1, isActive: 1 })

// Tag-based retrieval
MessageTemplateSchema.index({ tags: 1, isActive: 1 })

// Unique slug
MessageTemplateSchema.index({ slug: 1 }, { unique: true })

// Chronological browsing
MessageTemplateSchema.index({ createdAt: -1 })

// ─── Virtuals ─────────────────────────────────────────────────────────────────

/** Conversion rate as percentage, 0 if no data */
MessageTemplateSchema.virtual('conversionRate').get(function (this: IMessageTemplate) {
  if (!this.stats.sent) return 0
  return Math.round((this.stats.converted / this.stats.sent) * 100 * 10) / 10
})

/** Open rate as percentage */
MessageTemplateSchema.virtual('openRate').get(function (this: IMessageTemplate) {
  if (!this.stats.delivered) return 0
  return Math.round((this.stats.opened / this.stats.delivered) * 100 * 10) / 10
})

// ─── Model ────────────────────────────────────────────────────────────────────

export const MessageTemplate: Model<IMessageTemplate> =
  model<IMessageTemplate>('MessageTemplate', MessageTemplateSchema)
