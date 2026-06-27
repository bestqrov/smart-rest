import type { Channel } from '../models/MessageTemplate'
import type { StepCondition } from '../models/FollowupSequence'

// ─── Channel plan ─────────────────────────────────────────────────────────────

export interface ChannelPlan {
  primaryChannel:   Channel
  secondaryChannel: Channel | null
  /** Condition under which to switch from primary to secondary. */
  switchCondition:  string
  reason:           string
}

// ─── Timing plan ─────────────────────────────────────────────────────────────

export interface RecommendedSendTime {
  /** Best days of the week for outreach, sorted by preference. */
  bestDays:            string[]
  /** Opening hour of the preferred contact window (local time, 0–23). */
  bestHourStart:       number
  /** Closing hour of the preferred contact window (local time, 0–23). */
  bestHourEnd:         number
  /** Cultural or operational periods to avoid (e.g. "Friday prayer time"). */
  avoidPeriods:        string[]
  /** Seconds to wait after the trigger fires before sending the first message. */
  initialDelaySeconds: number
  /** Specific optimal hour from scenario knowledge (null = any time in window). */
  optimalHour:         number | null
  reason:              string
}

// ─── Followup plan ────────────────────────────────────────────────────────────

/** One planned outreach touchpoint in the follow-up series. */
export interface FollowupTouchpoint {
  /** 1-based position in the sequence. */
  order:       number
  /** Days to wait after the previous touchpoint (0 = same day as trigger). */
  delayDays:   number
  /** Additional hours on top of delayDays (from DB sequence step). */
  delayHours:  number
  channel:     Channel
  /** Condition that must hold for this step to fire. */
  condition:   StepCondition | 'always'
  /** Human-readable goal of this touchpoint. */
  goal:        string
  /** ObjectId string of the template (from DB sequence step), or null. */
  templateRef: string | null
}

export interface FollowupPlan {
  /** Where the plan came from. */
  source:           'DB_SEQUENCE' | 'GENERATED' | 'NONE'
  /** Slug of the DB sequence if source='DB_SEQUENCE'. */
  sequenceSlug:     string | null
  touchpoints:      FollowupTouchpoint[]
  totalTouchpoints: number
  /** Hard ceiling: stop all follow-up after this many days from trigger. */
  maxDays:          number
  reason:           string
}

// ─── Escalation plan ─────────────────────────────────────────────────────────

export type EscalationAction =
  | 'ASSIGN_TO_HUMAN'   // route to a sales agent
  | 'SEND_MANAGER_ALERT'// send internal alert
  | 'SWITCH_CHANNEL'    // move to secondary channel
  | 'PAUSE_SEQUENCE'    // hold touchpoints pending review

export interface EscalationTrigger {
  /** Machine-readable trigger code — stable for integrations. */
  code:              string
  /** Condition description (when exactly this fires). */
  condition:         string
  /** Action to take when triggered. */
  action:            EscalationAction
  /** Human-readable explanation for operators. */
  description:       string
  /** How many days after sequence start before this trigger becomes active. */
  minDaysSinceStart: number
}

export interface EscalationPlan {
  triggers:                   EscalationTrigger[]
  /** Fallback: escalate to human after this many days with no conversion. */
  defaultEscalationAfterDays: number
  reason:                     string
}

// ─── Stop conditions ──────────────────────────────────────────────────────────

export type StopCode =
  | 'MAX_ATTEMPTS'    // reached the touchpoint ceiling
  | 'MAX_DAYS'        // calendar cap reached
  | 'OPT_OUT'         // explicit unsubscribe / "stop messaging me"
  | 'CONVERTED'       // goal achieved (booked demo / started trial / reactivated)
  | 'HARD_BOUNCE'     // message undeliverable on all channels
  | 'REPLY_RECEIVED'  // got a response — may transition to next scenario
  | 'OBJECTION_FILED' // lead explicitly filed a blocking objection

export interface StopCondition {
  code:        StopCode
  /** Human-readable explanation. */
  description: string
  /**
   * Numeric threshold: for MAX_ATTEMPTS = max # of touches,
   * for MAX_DAYS = calendar days, for others = null (event-based).
   */
  threshold:   number | null
}

// ─── Reasoning ───────────────────────────────────────────────────────────────

export interface StrategyReasoning {
  /** One-line summary of the complete outreach strategy. */
  summary:          string
  channelReason:    string
  timingReason:     string
  sequenceReason:   string
  escalationReason: string
  stopReason:       string
}

// ─── StrategyResult ───────────────────────────────────────────────────────────

/**
 * Complete, deterministic outreach strategy produced by the Strategy Engine.
 *
 * Same StrategyContext → same StrategyResult, always.
 *
 * The strategy decides WHAT to do and WHEN — it does not generate any message.
 * Message generation is handled separately by the PromptBuilder (Sprint 5).
 */
export interface StrategyResult {
  primaryChannel:      Channel
  secondaryChannel:    Channel | null
  recommendedSendTime: RecommendedSendTime
  followupPlan:        FollowupPlan
  escalationPlan:      EscalationPlan
  stopConditions:      StopCondition[]
  /** Total calendar days from trigger to the last planned touchpoint. */
  expectedDurationDays: number
  reasoning:            StrategyReasoning
}
