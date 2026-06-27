import { Schema, model, Document, Model, Types } from 'mongoose'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ObjectionCategory =
  | 'PRICE'        // "it's too expensive"
  | 'TRUST'        // "I don't know this company"
  | 'COMPLEXITY'   // "it looks difficult to use"
  | 'TIMING'       // "not the right time"
  | 'COMPETITION'  // "I already use X"
  | 'NECESSITY'    // "I don't need this"
  | 'OTHER'

export type ObjectionFrequency = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW'

export const OBJECTION_CATEGORIES: ObjectionCategory[] = [
  'PRICE', 'TRUST', 'COMPLEXITY', 'TIMING', 'COMPETITION', 'NECESSITY', 'OTHER',
]

// ─── Sub-schema: Translation entry ────────────────────────────────────────────

const TranslationSchema = new Schema(
  {
    lang:    { type: String, required: true, trim: true, lowercase: true },
    text:    { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false },
)

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IObjection extends Document {
  slug:         string
  category:     ObjectionCategory
  frequency:    ObjectionFrequency
  // The raw objection text in multiple languages
  translations: Array<{ lang: string; text: string }>
  // Which personas typically raise this objection
  personas:     Types.ObjectId[]     // refs Persona
  // Which response templates handle this objection
  responseTemplates: Types.ObjectId[]  // refs MessageTemplate (populated after templates exist)
  isActive:     boolean
  createdAt:    Date
  updatedAt:    Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ObjectionSchema = new Schema<IObjection>(
  {
    slug: {
      type:      String,
      required:  [true, 'Slug is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric'],
    },
    category: {
      type:     String,
      required: [true, 'Category is required'],
      enum:     { values: OBJECTION_CATEGORIES, message: 'Invalid category' },
    },
    frequency: {
      type:    String,
      required: [true, 'Frequency is required'],
      enum:    { values: ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'], message: 'Invalid frequency' },
      default: 'MEDIUM',
    },
    translations: {
      type:     [TranslationSchema],
      required: [true, 'At least one translation is required'],
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message:   'At least one translation is required',
      },
    },
    personas:          [{ type: Schema.Types.ObjectId, ref: 'Persona'         }],
    responseTemplates: [{ type: Schema.Types.ObjectId, ref: 'MessageTemplate' }],
    isActive:          { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────

ObjectionSchema.index({ slug: 1 },                           { unique: true })
ObjectionSchema.index({ category: 1, frequency: -1, isActive: 1 })
ObjectionSchema.index({ personas: 1, isActive: 1 })
ObjectionSchema.index({ 'translations.lang': 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const Objection: Model<IObjection> =
  model<IObjection>('Objection', ObjectionSchema)
