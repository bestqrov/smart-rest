// ─── Entry points ─────────────────────────────────────────────────────────────

/** Main async entry: fetches knowledge, runs all planners, returns StrategyResult. */
export { plan, planFromContext } from './StrategyEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type { StrategyContext } from './StrategyContext'

export type {
  StrategyResult,
  StrategyReasoning,
  // Channel
  ChannelPlan,
  // Timing
  RecommendedSendTime,
  // Followup
  FollowupPlan,
  FollowupTouchpoint,
  // Escalation
  EscalationPlan,
  EscalationTrigger,
  EscalationAction,
  // Stop
  StopCondition,
  StopCode,
} from './StrategyResult'

// ─── Individual planners (for testing and composition) ────────────────────────

export { planChannels }        from './ChannelPlanner'
export { planTiming }          from './TimingPlanner'
export { planSequence }        from './SequencePlanner'
export { planEscalation }      from './EscalationPlanner'
export { buildStopConditions } from './StopConditions'
