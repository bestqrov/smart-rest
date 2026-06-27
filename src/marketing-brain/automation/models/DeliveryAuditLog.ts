import mongoose, { Schema, Document, Model } from 'mongoose'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IDeliveryAuditLog extends Document {
  /** CampaignExecution._id as string */
  executionId:       string
  campaignId:        string
  generationId:      string
  leadId:            string
  channel:           string

  provider:          string
  attempt:           number    // 1-based; each retry increments

  success:           boolean
  providerMessageId: string | null
  statusCode:        number | null
  latencyMs:         number
  error:             string | null
  retryable:         boolean

  deliveredAt: Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const DeliveryAuditLogSchema = new Schema<IDeliveryAuditLog>(
  {
    executionId:       { type: String, required: true, index: true },
    campaignId:        { type: String, required: true, index: true },
    generationId:      { type: String, required: true },
    leadId:            { type: String, required: true },
    channel:           { type: String, required: true },

    provider:          { type: String, required: true },
    attempt:           { type: Number, required: true },

    success:           { type: Boolean, required: true },
    providerMessageId: { type: String, default: null },
    statusCode:        { type: Number, default: null },
    latencyMs:         { type: Number, required: true },
    error:             { type: String, default: null },
    retryable:         { type: Boolean, default: false },

    deliveredAt:       { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    collection: 'delivery_audit_logs',
  },
)

// Query audit history by execution or campaign
DeliveryAuditLogSchema.index({ executionId: 1, attempt: 1 })
DeliveryAuditLogSchema.index({ campaignId: 1, deliveredAt: -1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const DeliveryAuditLog: Model<IDeliveryAuditLog> =
  mongoose.models.DeliveryAuditLog ??
  mongoose.model<IDeliveryAuditLog>('DeliveryAuditLog', DeliveryAuditLogSchema)
