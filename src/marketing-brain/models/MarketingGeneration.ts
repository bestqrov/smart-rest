import mongoose, { Schema, Document, Model } from 'mongoose'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IMarketingGeneration extends Document {
  generationId:    string
  leadId:          string    // DemoRequest._id from the Prisma database
  scenario:        string    // trigger used (e.g. 'demo_request_submitted')
  channel:         string    // 'WHATSAPP' | 'EMAIL' | 'SMS' etc.
  language:        string    // 'ar' | 'fr' | 'en'
  country:         string    // 'MA' | 'SA' | 'AE' etc.
  businessType:    string    // 'cafe' | 'restaurant' etc.

  status:          'PENDING' | 'COMPLETED' | 'FAILED'
  attempts:        number

  generatedMessage:  string | null
  provider:          string | null    // 'gemini' | 'openai' etc.
  promptVersion:     string | null    // e.g. 'v1-55dac7cf'
  confidenceScore:   number | null    // 0–100 from Decision Engine
  tokens:            number | null    // total tokens used
  estimatedCost:     number | null    // USD
  latencyMs:         number | null    // end-to-end pipeline latency
  validationStatus:  string | null    // 'OUTPUT_VALID' | 'OUTPUT_INVALID'

  error:             string | null    // last error message if status = FAILED

  generatedAt:     Date
  updatedAt:       Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const MarketingGenerationSchema = new Schema<IMarketingGeneration>(
  {
    generationId:    { type: String, required: true, unique: true, index: true },
    leadId:          { type: String, required: true, index: true },
    scenario:        { type: String, required: true },
    channel:         { type: String, required: true },
    language:        { type: String, required: true },
    country:         { type: String, required: true },
    businessType:    { type: String, required: true },

    status:   { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING', index: true },
    attempts: { type: Number, default: 0 },

    generatedMessage:  { type: String, default: null },
    provider:          { type: String, default: null },
    promptVersion:     { type: String, default: null },
    confidenceScore:   { type: Number, default: null },
    tokens:            { type: Number, default: null },
    estimatedCost:     { type: Number, default: null },
    latencyMs:         { type: Number, default: null },
    validationStatus:  { type: String, default: null },

    error: { type: String, default: null },
  },
  {
    timestamps: {
      createdAt: 'generatedAt',
      updatedAt: 'updatedAt',
    },
    collection: 'marketing_generations',
  },
)

// ─── Model ────────────────────────────────────────────────────────────────────

export const MarketingGeneration: Model<IMarketingGeneration> =
  mongoose.models.MarketingGeneration ??
  mongoose.model<IMarketingGeneration>('MarketingGeneration', MarketingGenerationSchema)
