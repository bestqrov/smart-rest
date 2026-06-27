import mongoose, { Schema, Document, Model } from 'mongoose'

// ─── Status enum ──────────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'QUEUED'      // created, waiting for scheduledAt to pass
  | 'READY'       // scheduledAt has passed, ready for the Automation Engine
  | 'SENT'        // Automation Engine has dispatched it
  | 'FAILED'      // dispatch failed after all retries
  | 'CANCELLED'   // cancelled before execution

export type ExecutionType = 'PRIMARY' | 'FOLLOWUP'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ICampaignExecution extends Document {
  /** UUID that groups all executions produced by one orchestration run. */
  campaignId:    string
  generationId:  string    // → MarketingGeneration.generationId
  leadId:        string    // → DemoRequest._id

  executionType: ExecutionType
  /** 1-based position in the follow-up sequence. null for PRIMARY. */
  followupOrder: number | null

  channel:       string    // 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH'
  scheduledAt:   Date
  priority:      number    // lower = higher priority (1 = immediate)

  status:        CampaignStatus
  retryCount:    number

  /** The final message content, copied from MarketingGeneration at scheduling time. */
  message:       string | null
  /** Follow-up touchpoint goal (e.g. "Check if demo attended"). */
  goal:          string | null

  /** Arbitrary key-value pairs for the Automation Engine / integrations. */
  metadata: Record<string, unknown>

  createdAt: Date
  updatedAt: Date
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const CampaignExecutionSchema = new Schema<ICampaignExecution>(
  {
    campaignId:    { type: String, required: true, index: true },
    generationId:  { type: String, required: true, index: true },
    leadId:        { type: String, required: true, index: true },

    executionType: {
      type:    String,
      enum:    ['PRIMARY', 'FOLLOWUP'],
      required: true,
    },
    followupOrder: { type: Number, default: null },

    channel:    { type: String, required: true },
    scheduledAt:{ type: Date, required: true, index: true },
    priority:   { type: Number, default: 1 },

    status: {
      type:    String,
      enum:    ['QUEUED', 'READY', 'SENT', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
      index:   true,
    },
    retryCount: { type: Number, default: 0 },

    message: { type: String, default: null },
    goal:    { type: String, default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'campaign_executions',
  },
)

// Compound index: find all QUEUED executions due to run
CampaignExecutionSchema.index({ status: 1, scheduledAt: 1 })
// Find all executions for a campaign to support cancellation
CampaignExecutionSchema.index({ campaignId: 1, status: 1 })

// ─── Model ────────────────────────────────────────────────────────────────────

export const CampaignExecution: Model<ICampaignExecution> =
  mongoose.models.CampaignExecution ??
  mongoose.model<ICampaignExecution>('CampaignExecution', CampaignExecutionSchema)
