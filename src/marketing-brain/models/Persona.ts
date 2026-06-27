import { Schema, model, Document, Model, Types } from 'mongoose'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type TechSavviness     = 'LOW' | 'MEDIUM' | 'HIGH'
export type DecisionStyle     = 'ANALYTICAL' | 'EMOTIONAL' | 'IMPULSIVE' | 'SOCIAL'
export type CommunicationPref = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'PHONE' | 'IN_PERSON'

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const DemographicSchema = new Schema(
  {
    ageRange: {
      min: { type: Number, min: 18, max: 80, default: 25 },
      max: { type: Number, min: 18, max: 80, default: 55 },
    },
    techSavviness: {
      type:    String,
      enum:    ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM',
    },
    decisionStyle: {
      type: String,
      enum: ['ANALYTICAL', 'EMOTIONAL', 'IMPULSIVE', 'SOCIAL'],
    },
    preferredChannels: [{
      type: String,
      enum: ['WHATSAPP', 'EMAIL', 'SMS', 'PHONE', 'IN_PERSON'],
    }],
  },
  { _id: false },
)

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IPersona extends Document {
  slug:          string   // e.g. 'traditional_owner', 'young_entrepreneur'
  nameEn:        string
  nameAr:        string
  nameFr:        string
  descriptionEn: string
  painPoints:    string[]   // e.g. ['staff management', 'inventory waste']
  goals:         string[]   // e.g. ['grow revenue', 'reduce costs']
  businessTypes: Types.ObjectId[]   // refs BusinessType
  countries:     Types.ObjectId[]   // refs Country — empty = all
  demographic: {
    ageRange:          { min: number; max: number }
    techSavviness:     TechSavviness
    decisionStyle:     DecisionStyle
    preferredChannels: CommunicationPref[]
  }
  sortOrder:  number
  isActive:   boolean
  createdAt:  Date
  updatedAt:  Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const PersonaSchema = new Schema<IPersona>(
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
      maxlength: [100, 'Name too long'],
    },
    nameAr: {
      type:      String,
      required:  [true, 'Arabic name is required'],
      trim:      true,
      maxlength: [100, 'Name too long'],
    },
    nameFr: {
      type:      String,
      required:  [true, 'French name is required'],
      trim:      true,
      maxlength: [100, 'Name too long'],
    },
    descriptionEn: {
      type:      String,
      trim:      true,
      maxlength: [500, 'Description too long'],
    },
    painPoints: [{
      type:      String,
      trim:      true,
      maxlength: [200, 'Pain point too long'],
    }],
    goals: [{
      type:      String,
      trim:      true,
      maxlength: [200, 'Goal too long'],
    }],
    businessTypes: [{ type: Schema.Types.ObjectId, ref: 'BusinessType' }],
    countries:     [{ type: Schema.Types.ObjectId, ref: 'Country'      }],
    demographic:   { type: DemographicSchema, default: () => ({}) },
    sortOrder:     { type: Number, default: 0 },
    isActive:      { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────

PersonaSchema.index({ slug: 1 },                        { unique: true })
PersonaSchema.index({ businessTypes: 1, isActive: 1 })
PersonaSchema.index({ countries: 1,     isActive: 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const Persona: Model<IPersona> =
  model<IPersona>('Persona', PersonaSchema)
