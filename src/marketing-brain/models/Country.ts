import { Schema, model, Document, Model, Types } from 'mongoose'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type Region = 'MENA' | 'GULF' | 'AFRICA' | 'EUROPE' | 'OTHER'

export const REGIONS: Region[] = ['MENA', 'GULF', 'AFRICA', 'EUROPE', 'OTHER']

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ICountry extends Document {
  code:               string       // ISO 3166-1 alpha-2  e.g. 'MA', 'SA'
  nameEn:             string
  nameAr:             string
  nameFr:             string
  currency:           string       // ISO 4217  e.g. 'MAD', 'SAR'
  phonePrefix:        string       // e.g. '+212', '+966'
  region:             Region
  supportedLanguages: Types.ObjectId[]   // refs Language
  isActive:           boolean
  createdAt:          Date
  updatedAt:          Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const CountrySchema = new Schema<ICountry>(
  {
    code: {
      type:      String,
      required:  [true, 'Country code is required'],
      unique:    true,
      trim:      true,
      uppercase: true,
      match:     [/^[A-Z]{2}$/, 'Code must be ISO 3166-1 alpha-2 (2 uppercase letters)'],
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
    currency: {
      type:     String,
      required: [true, 'Currency code is required'],
      trim:     true,
      uppercase: true,
      match:    [/^[A-Z]{3}$/, 'Currency must be ISO 4217 (3 uppercase letters)'],
    },
    phonePrefix: {
      type:     String,
      required: [true, 'Phone prefix is required'],
      trim:     true,
      match:    [/^\+\d{1,4}$/, 'Phone prefix must be e.g. +212'],
    },
    region: {
      type:     String,
      required: [true, 'Region is required'],
      enum:     { values: REGIONS, message: 'Invalid region' },
    },
    supportedLanguages: [
      { type: Schema.Types.ObjectId, ref: 'Language' },
    ],
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

// ─── Indexes ──────────────────────────────────────────────────────────────────

CountrySchema.index({ code: 1 },         { unique: true })
CountrySchema.index({ region: 1, isActive: 1 })
CountrySchema.index({ supportedLanguages: 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const Country: Model<ICountry> =
  model<ICountry>('Country', CountrySchema)
