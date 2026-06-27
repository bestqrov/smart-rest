import { Schema, model, Document, Model, Types } from 'mongoose'

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Condition that must be true for this step to fire */
export type StepCondition =
  | 'always'              // fire unconditionally
  | 'no_reply'            // previous message had no reply
  | 'opened_not_replied'  // previous email opened but no reply
  | 'not_delivered'       // previous message undelivered
  | 'clicked_not_converted'

export const STEP_CONDITIONS: StepCondition[] = [
  'always', 'no_reply', 'opened_not_replied', 'not_delivered', 'clicked_not_converted',
]

// ─── Sub-schema: Sequence step ────────────────────────────────────────────────

const SequenceStepSchema = new Schema(
  {
    order: {
      type:     Number,
      required: [true, 'Step order is required'],
      min:      [1, 'Step order starts at 1'],
    },
    delayDays: {
      type:     Number,
      required: [true, 'Delay days is required'],
      min:      [0, 'Delay cannot be negative'],
      max:      [365, 'Delay cannot exceed 1 year'],
    },
    delayHours: {
      type:    Number,
      default: 0,
      min:     0,
      max:     23,
    },
    template: {
      type:     Schema.Types.ObjectId,
      ref:      'MessageTemplate',
      required: [true, 'Template is required for each step'],
    },
    condition: {
      type:    String,
      enum:    { values: STEP_CONDITIONS, message: 'Invalid step condition' },
      default: 'always',
    },
    // Override the template channel for this specific step (optional)
    channelOverride: {
      type: String,
      enum: ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH', null],
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
)

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ISequenceStep {
  order:           number
  delayDays:       number
  delayHours:      number
  template:        Types.ObjectId
  condition:       StepCondition
  channelOverride: string | null
  isActive:        boolean
}

export interface IFollowupSequence extends Document {
  slug:         string
  nameEn:       string
  nameAr:       string
  nameFr:       string
  // Targeting (required)
  scenario:     Types.ObjectId        // ref Scenario
  persona:      Types.ObjectId        // ref Persona
  language:     Types.ObjectId        // ref Language
  // Targeting (optional — null = universal)
  businessType: Types.ObjectId | null // ref BusinessType
  country:      Types.ObjectId | null // ref Country
  // Sequence definition
  steps:        ISequenceStep[]
  // Meta
  totalSteps:   number   // denormalized for fast queries
  durationDays: number   // sum of all step delays
  isActive:     boolean
  createdAt:    Date
  updatedAt:    Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const FollowupSequenceSchema = new Schema<IFollowupSequence>(
  {
    slug: {
      type:      String,
      required:  [true, 'Slug is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric'],
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
    // Targeting
    scenario:     { type: Schema.Types.ObjectId, ref: 'Scenario',     required: [true, 'Scenario is required'] },
    persona:      { type: Schema.Types.ObjectId, ref: 'Persona',      required: [true, 'Persona is required']  },
    language:     { type: Schema.Types.ObjectId, ref: 'Language',     required: [true, 'Language is required'] },
    businessType: { type: Schema.Types.ObjectId, ref: 'BusinessType', default: null },
    country:      { type: Schema.Types.ObjectId, ref: 'Country',      default: null },
    // Steps
    steps: {
      type:     [SequenceStepSchema],
      required: [true, 'At least one step is required'],
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message:   'Sequence must have at least one step',
      },
    },
    // Denormalized counters (kept in sync by pre-save hook)
    totalSteps:   { type: Number, default: 0, min: 0 },
    durationDays: { type: Number, default: 0, min: 0 },
    isActive:     { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

// ─── Pre-save: denormalize counters ──────────────────────────────────────────

FollowupSequenceSchema.pre('save', async function () {
  const activeSteps  = this.steps.filter(s => s.isActive)
  this.totalSteps    = activeSteps.length
  this.durationDays  = activeSteps.reduce((sum, s) => sum + s.delayDays, 0)
})

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary lookup: find the sequence for a given targeting combo
FollowupSequenceSchema.index({
  scenario:     1,
  persona:      1,
  language:     1,
  businessType: 1,
  country:      1,
  isActive:     1,
})

FollowupSequenceSchema.index({ slug: 1 }, { unique: true })

// Performance: sort by total steps or duration
FollowupSequenceSchema.index({ totalSteps: -1, isActive: 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const FollowupSequence: Model<IFollowupSequence> =
  model<IFollowupSequence>('FollowupSequence', FollowupSequenceSchema)
