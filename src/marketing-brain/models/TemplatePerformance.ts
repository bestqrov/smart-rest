import { Schema, model, Document, Model, Types } from 'mongoose'
import type { Channel } from './MessageTemplate'

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * Granularity of the snapshot.
 *
 * DAILY   — one document per (template, date, variant, country)
 * WEEKLY  — rolled up from daily snapshots every Monday
 * MONTHLY — rolled up from daily snapshots on the 1st of each month
 *
 * Rollup logic runs as a background job (Sprint 4+).
 * Raw ingestion always writes DAILY snapshots.
 */
export type PerformancePeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY'

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/** Raw event counts for the snapshot period. */
const CountsSchema = new Schema(
  {
    sent:          { type: Number, required: true, default: 0, min: 0 },
    delivered:     { type: Number, required: true, default: 0, min: 0 },
    opened:        { type: Number, required: true, default: 0, min: 0 },
    clicked:       { type: Number, required: true, default: 0, min: 0 },
    replied:       { type: Number, required: true, default: 0, min: 0 },
    converted:     { type: Number, required: true, default: 0, min: 0 },
    bounced:       { type: Number, required: true, default: 0, min: 0 },
    unsubscribed:  { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
)

/**
 * Derived rates stored as floats 0.0–100.0 (percentage).
 * Stored — not computed at query time — so aggregation queries can
 * sort and filter by rate without $divide inside the query engine.
 *
 * Rates are recomputed and written every time counts are updated.
 */
const RatesSchema = new Schema(
  {
    deliveryRate:    { type: Number, required: true, default: 0, min: 0, max: 100 },
    openRate:        { type: Number, required: true, default: 0, min: 0, max: 100 },
    clickRate:       { type: Number, required: true, default: 0, min: 0, max: 100 },
    replyRate:       { type: Number, required: true, default: 0, min: 0, max: 100 },
    conversionRate:  { type: Number, required: true, default: 0, min: 0, max: 100 },
    bounceRate:      { type: Number, required: true, default: 0, min: 0, max: 100 },
    unsubscribeRate: { type: Number, required: true, default: 0, min: 0, max: 100 },
  },
  { _id: false },
)

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IPerformanceCounts {
  sent:         number
  delivered:    number
  opened:       number
  clicked:      number
  replied:      number
  converted:    number
  bounced:      number
  unsubscribed: number
}

export interface IPerformanceRates {
  deliveryRate:    number
  openRate:        number
  clickRate:       number
  replyRate:       number
  conversionRate:  number
  bounceRate:      number
  unsubscribeRate: number
}

export interface ITemplatePerformance extends Document {
  /** The template this snapshot belongs to. */
  template:   Types.ObjectId

  /**
   * Snapshot date:
   * - DAILY   → midnight UTC of that day (YYYY-MM-DD 00:00:00Z)
   * - WEEKLY  → midnight UTC of that Monday
   * - MONTHLY → midnight UTC of the 1st of that month
   */
  date:       Date
  period:     PerformancePeriod

  /**
   * Channel used for this cohort.
   * A template sent via both WhatsApp and EMAIL produces two separate documents
   * so channel-level stats stay clean.
   */
  channel:    Channel

  /**
   * Country context, or null if sent globally.
   * Separating by country lets regional performance comparisons run
   * without aggregation pipelines.
   */
  country:    Types.ObjectId | null

  /**
   * A/B variant label. Use 'default' for single-variant sends.
   * Max 10 chars to keep the unique index compact.
   */
  variant:    string

  counts:     IPerformanceCounts
  rates:      IPerformanceRates

  /**
   * Optional external campaign identifier (e.g. n8n workflow run ID,
   * Brevo campaign ID). Useful for cross-system attribution.
   */
  campaignId: string | null

  createdAt:  Date
  updatedAt:  Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const TemplatePerformanceSchema = new Schema<ITemplatePerformance>(
  {
    template: {
      type:     Schema.Types.ObjectId,
      ref:      'MessageTemplate',
      required: [true, 'Template reference is required'],
    },
    date: {
      type:     Date,
      required: [true, 'Snapshot date is required'],
    },
    period: {
      type:     String,
      required: [true, 'Period is required'],
      enum:     { values: ['DAILY', 'WEEKLY', 'MONTHLY'], message: 'Invalid period' },
      default:  'DAILY',
    },
    channel: {
      type:     String,
      required: [true, 'Channel is required'],
      enum:     { values: ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH'], message: 'Invalid channel' },
    },
    country: {
      type:    Schema.Types.ObjectId,
      ref:     'Country',
      default: null,
    },
    variant: {
      type:      String,
      required:  true,
      trim:      true,
      lowercase: true,
      maxlength: [20, 'Variant label too long'],
      default:   'default',
    },
    counts:     { type: CountsSchema, default: () => ({}) },
    rates:      { type: RatesSchema,  default: () => ({}) },
    campaignId: {
      type:      String,
      trim:      true,
      maxlength: [100, 'Campaign ID too long'],
      default:   null,
    },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────
//
// Unique constraint: prevents double-counting if the aggregation job re-runs.
// Every snapshot is uniquely identified by its 5-field key.
TemplatePerformanceSchema.index(
  { template: 1, date: 1, period: 1, variant: 1, country: 1 },
  { unique: true, name: 'unique_snapshot' },
)

// Time-series queries: "show me this template's performance over time"
TemplatePerformanceSchema.index({ template: 1, date: -1, period: 1 })

// Platform-wide daily stats: "what was the best day across all templates?"
TemplatePerformanceSchema.index({ date: -1, period: 1, channel: 1 })

// Top-performer sort: "which templates have the highest conversion this month?"
TemplatePerformanceSchema.index({ period: 1, 'rates.conversionRate': -1 })

// Open-rate leader board per channel
TemplatePerformanceSchema.index({ channel: 1, period: 1, 'rates.openRate': -1 })

// Country-level performance comparison
TemplatePerformanceSchema.index({ country: 1, period: 1, date: -1 })

// Campaign attribution: "how did campaign X perform across all templates?"
TemplatePerformanceSchema.index({ campaignId: 1, date: -1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const TemplatePerformance: Model<ITemplatePerformance> =
  model<ITemplatePerformance>('TemplatePerformance', TemplatePerformanceSchema)
