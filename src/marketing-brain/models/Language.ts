import { Schema, model, Document, Model } from 'mongoose'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ILanguage extends Document {
  code:       string   // ISO 639-1  e.g. 'ar', 'fr', 'en'
  nameEn:     string
  nameNative: string   // e.g. 'العربية', 'Français'
  isRTL:      boolean
  isActive:   boolean
  createdAt:  Date
  updatedAt:  Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const LanguageSchema = new Schema<ILanguage>(
  {
    code: {
      type:      String,
      required:  [true, 'Language code is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^[a-z]{2}$/, 'Code must be ISO 639-1 (2 lowercase letters)'],
    },
    nameEn: {
      type:     String,
      required: [true, 'English name is required'],
      trim:     true,
      maxlength: [80, 'Name too long'],
    },
    nameNative: {
      type:     String,
      required: [true, 'Native name is required'],
      trim:     true,
      maxlength: [80, 'Name too long'],
    },
    isRTL:     { type: Boolean, required: true, default: false },
    isActive:  { type: Boolean, required: true, default: true  },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────

LanguageSchema.index({ code: 1 },              { unique: true })
LanguageSchema.index({ isActive: 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const Language: Model<ILanguage> =
  model<ILanguage>('Language', LanguageSchema)
