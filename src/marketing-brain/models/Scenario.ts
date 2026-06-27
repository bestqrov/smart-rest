import { Schema, model, Document, Model, Types } from 'mongoose'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type FunnelStage =
  | 'AWARENESS'      // prospect doesn't know the product
  | 'CONSIDERATION'  // prospect is evaluating options
  | 'DECISION'       // prospect is ready to buy
  | 'ONBOARDING'     // new customer, first week
  | 'RETENTION'      // active customer, keep engaged
  | 'REACTIVATION'   // churned / cold customer

export const FUNNEL_STAGES: FunnelStage[] = [
  'AWARENESS', 'CONSIDERATION', 'DECISION', 'ONBOARDING', 'RETENTION', 'REACTIVATION',
]

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IScenario extends Document {
  slug:          string
  stage:         FunnelStage
  trigger:       string   // what event activates this scenario
                          // e.g. 'demo_request_submitted', 'trial_day_3', 'no_order_7_days'
  nameEn:        string
  nameAr:        string
  nameFr:        string
  descriptionEn: string
  // Empty = applicable to all personas / business types
  personas:      Types.ObjectId[]   // refs Persona
  businessTypes: Types.ObjectId[]   // refs BusinessType
  priority:      number   // higher = sent first when multiple match
  isActive:      boolean
  createdAt:     Date
  updatedAt:     Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ScenarioSchema = new Schema<IScenario>(
  {
    slug: {
      type:      String,
      required:  [true, 'Slug is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric'],
    },
    stage: {
      type:    String,
      required: [true, 'Funnel stage is required'],
      enum:    { values: FUNNEL_STAGES, message: 'Invalid funnel stage' },
    },
    trigger: {
      type:      String,
      required:  [true, 'Trigger is required'],
      trim:      true,
      maxlength: [200, 'Trigger too long'],
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
    descriptionEn: {
      type:      String,
      trim:      true,
      maxlength: [500, 'Description too long'],
    },
    personas:      [{ type: Schema.Types.ObjectId, ref: 'Persona'      }],
    businessTypes: [{ type: Schema.Types.ObjectId, ref: 'BusinessType' }],
    priority:      { type: Number, default: 0, min: 0, max: 100 },
    isActive:      { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────

ScenarioSchema.index({ slug: 1 },                           { unique: true })
ScenarioSchema.index({ stage: 1, isActive: 1, priority: -1 })
ScenarioSchema.index({ personas: 1,      isActive: 1 })
ScenarioSchema.index({ businessTypes: 1, isActive: 1 })
ScenarioSchema.index({ trigger: 1,       isActive: 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const Scenario: Model<IScenario> =
  model<IScenario>('Scenario', ScenarioSchema)
