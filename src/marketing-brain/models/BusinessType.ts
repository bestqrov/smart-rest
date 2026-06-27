import { Schema, model, Document, Model, Types } from 'mongoose'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IBusinessType extends Document {
  slug:       string   // e.g. 'restaurant', 'cafe', 'bakery'
  nameEn:     string
  nameAr:     string
  nameFr:     string
  icon:       string   // emoji or icon identifier
  sortOrder:  number   // display order in UIs
  // Empty array = available in all countries
  restrictedToCountries: Types.ObjectId[]  // refs Country
  isActive:   boolean
  createdAt:  Date
  updatedAt:  Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const BusinessTypeSchema = new Schema<IBusinessType>(
  {
    slug: {
      type:      String,
      required:  [true, 'Slug is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric with hyphens/underscores'],
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
    icon:      { type: String, trim: true, default: '🍽️' },
    sortOrder: { type: Number, default: 0 },
    restrictedToCountries: [
      { type: Schema.Types.ObjectId, ref: 'Country' },
    ],
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────

BusinessTypeSchema.index({ slug: 1 },              { unique: true })
BusinessTypeSchema.index({ isActive: 1, sortOrder: 1 })
BusinessTypeSchema.index({ restrictedToCountries: 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const BusinessType: Model<IBusinessType> =
  model<IBusinessType>('BusinessType', BusinessTypeSchema)
