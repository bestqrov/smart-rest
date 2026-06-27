/**
 * Marketing Brain — public API surface
 *
 * Sprint 1 + 2:   database layer (Mongoose models + seed).
 * Sprint 2.5:     knowledge layer (cultural + strategy enrichment).
 * Sprint 3:       decision engine — deterministic, confidence-scored,
 *                 with full reasoning trail. No AI calls.
 */

export { connect, disconnect } from './connection'

export {
  Language, Country, BusinessType, Persona,
  Scenario, Objection, MessageTemplate, FollowupSequence,
  AIRule, Variable, TemplatePerformance,
} from './models'

export type {
  ILanguage,
  ICountry,  Region,
  IBusinessType,
  IPersona,
  IScenario, FunnelStage,
  IObjection, ObjectionCategory, ObjectionFrequency,
  IMessageTemplate, Channel, Format, Tone,
  IFollowupSequence, ISequenceStep, StepCondition,
  IAIRule, RuleType, IAppliesTo, IRuleBody,
  IVariable, VariableDataType, VariableSource,
  ITemplatePerformance, PerformancePeriod,
} from './models'

export { seedMarketingBrain } from './seed'

// ── Service layer (Sprint 3) ──────────────────────────────────────────────────

export {
  decide,
  select,
  resolveAIRules,
  resolveVariables,
  render,
  extractKeys,
  planFollowup,
  buildPrompt,
  validateLeadProfile,
  validateResolvedVariables,
  validateBuiltPrompt,
  assertLeadProfile,
  mergeConstraints,
} from './services'

export type {
  LeadProfile,
  ResolvedContext,
  TemplateMatch,
  SequenceMatch,
  VariableResolution,
  BuiltPrompt,
  DecisionResult,
} from './types'

export type { PromptBuildArgs } from './services'

// ── Knowledge layer (Sprint 2.5) ──────────────────────────────────────────────
// Service namespaces: CountryKnowledgeService.getByCode('MA'), etc.

export * as CountryKnowledgeService      from './knowledge/CountryKnowledgeService'
export * as PersonaKnowledgeService      from './knowledge/PersonaKnowledgeService'
export * as ScenarioKnowledgeService     from './knowledge/ScenarioKnowledgeService'
export * as ObjectionKnowledgeService    from './knowledge/ObjectionKnowledgeService'
export * as BusinessTypeKnowledgeService from './knowledge/BusinessTypeKnowledgeService'

// Knowledge object types
export type {
  CountryKnowledge,
  PersonaKnowledge,
  ScenarioKnowledge,
  ObjectionKnowledge,
  BusinessTypeKnowledge,
  ContactChannel,
} from './knowledge/types'

export { createCache, withCache } from './knowledge/cache'
export type { KnowledgeCache }    from './knowledge/cache'

// ── Decision Engine (Sprint 3 — new structured layer) ────────────────────────
// Primary entry point: decide(context) → DecisionResult with confidence + reasoning

export { decide as decideV2 } from './decision-engine/DecisionEngine'

export type {
  DecisionContext,
  ResolvedDecisionContext,
  CampaignGoal,
} from './decision-engine/DecisionContext'

export type {
  DecisionResult   as DecisionResultV2,
  ReasoningTrail,
  DecisionStep,
  ScoreBreakdown,
  DecisionDimension,
} from './decision-engine/DecisionResult'

export {
  evaluateRule,
  filterApplicableRules,
  mergeRuleConstraints,
} from './decision-engine/RuleEvaluator'

export type { MergedConstraints } from './decision-engine/RuleEvaluator'

export {
  scoreTemplate, scoreVariables, scoreRules, scoreScenario,
  buildScoreBreakdown, buildReasoningTrail,
} from './decision-engine/ConfidenceScore'

export { validateDecisionContext, assertDecisionContext } from './validators/DecisionValidator'
export { validateVariables, requiredKeysFromDefs }        from './validators/VariableValidator'

export {
  selectScenario, selectTemplate, selectRules,
  selectFollowup, selectVariables, renderTemplate, extractKeys as extractTemplateKeys,
} from './selectors'

// ── Strategy Layer (Sprint 4) ─────────────────────────────────────────────────
// plan(decisionResult, decisionContext) → StrategyResult

export { plan as planStrategy, planFromContext } from './strategy/StrategyEngine'

export type {
  StrategyContext,
  StrategyResult,
  StrategyReasoning,
  ChannelPlan,
  RecommendedSendTime,
  FollowupPlan,
  FollowupTouchpoint,
  EscalationPlan,
  EscalationTrigger,
  EscalationAction,
  StopCondition,
  StopCode,
} from './strategy'

export { planChannels, planTiming, planSequence, planEscalation, buildStopConditions } from './strategy'

// ── Prompt Builder (Sprint 5) ─────────────────────────────────────────────────
// buildPrompt(ctx) → PromptBuildResult  (ok:true → PromptResult, ok:false → errors[])
// Input: DecisionResult + StrategyResult + knowledge objects
// Output: systemPrompt, userPrompt, variables, metadata, version, estimatedTokens

export {
  buildPrompt as buildPromptV2,
  buildOrThrow,
} from './prompt-builder'

// ── Generation Pipeline (Sprint 6) ───────────────────────────────────────────
// runPipeline(ctx) → GenerationResult  (pre-flight: safety + compliance + brand)
// processOutput(pipeline, rawOutput) → GenerationResult  (output validation)
// Neither function makes AI calls. Both are pure TypeScript orchestration layers.

export { runPipeline, processOutput } from './generation'

export type {
  PipelineContext,
  PipelineOptions,
  GenerationResult,
  PipelineStatus,
  PipelineStage,
  ComplianceResult,
  ComplianceCheck,
  ComplianceCode,
  BrandResult,
  BrandCheck,
  BrandCode,
  SafetyResult,
  SafetyCheck,
  SafetyCode,
  ValidatedOutput,
  OutputCheck,
  OutputCheckCode,
  RetryPolicy,
  RetryReason,
  RetryRecord,
} from './generation'

export {
  validateCompliance,
  validateBrand,
  runSafetyChecks,
  validateOutput,
  buildRetryPolicy,
  shouldRetry,
  nextDelayMs,
  buildRetryRecord,
  DEFAULT_RETRY_POLICY,
  AGGRESSIVE_RETRY_POLICY,
  NO_RETRY_POLICY,
  RATE_LIMIT_RETRY_POLICY,
} from './generation'

// ── AI Provider Manager (Phase A) ─────────────────────────────────────────────
// createAIProviderManager(config) → AIProviderManager
// Active: Gemini only.  Disabled placeholders: Claude, OpenAI, Groq, OpenRouter.
// getDefaultManager() → lazy singleton using GEMINI_API_KEY env var.

// ── Production Integration (Phase B) ──────────────────────────────────────────
// MarketingGenerationService: orchestrates the complete pipeline for one lead.
// Call generate(input) from any Lead creation flow — fire-and-forget safe.

// ── Campaign Orchestrator (Phase C) ───────────────────────────────────────────
// orchestrate(input) → CampaignExecution records (QUEUED/READY).
// cancelCampaign(id), cancelExecution(id), getExecutions(id), tickReady(), getReadyExecutions().

export {
  orchestrate,
  cancelCampaign,
  cancelExecution,
  getExecutions   as getCampaignExecutions,
  tickReady,
  getReadyExecutions,
} from './CampaignOrchestratorService'

export type {
  OrchestrationInput,
  OrchestrationResult,
  CancelResult,
} from './CampaignOrchestratorService'

export { CampaignExecution }  from './models/CampaignExecution'
export type { ICampaignExecution, CampaignStatus, ExecutionType } from './models/CampaignExecution'

export {
  generate as marketingGenerate,
  mapBusinessType,
  inferLanguage,
} from './MarketingGenerationService'

export type { GenerationInput, GenerationSummary } from './MarketingGenerationService'

export { MarketingGeneration } from './models/MarketingGeneration'
export type { IMarketingGeneration } from './models/MarketingGeneration'

export {
  createAIProviderManager,
  getDefaultManager,
  resetDefaultManager,
  // Errors
  ProviderError,
  DisabledProviderError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderServerError,
  ProviderSafetyError,
  ProviderResponseError,
  ProviderNetworkError,
  ProviderContextTooLongError,
  isRetryable,
  shouldFallback,
  // Usage tracking
  addUsageHook,
  clearHooks,
  hookCount,
  emitUsageEvent,
  calculateCostUsd,
  estimateInputTokens,
  // Registry
  registerProvider,
  registerProviders,
  getProvider,
  listProviders,
  listActiveProviders,
  hasActiveProvider,
  registryStatus,
  // Selector
  selectProvider,
  buildFallbackChain,
  // Adapters
  GeminiAdapter,
  ClaudeAdapter,
  OpenAIAdapter,
  GroqAdapter,
  OpenRouterAdapter,
} from './providers'

export type {
  AIProviderManager,
  GenerateOptions,
  ManagerResult,
  ManagerStatus,
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  TokenUsage,
  ProviderHealth,
  ProviderStatus,
  ProviderConfigMap,
  GeminiConfig,
  UsageEvent,
  UsageHook,
  ProviderErrorCode,
  SelectionOptions,
  ProviderAttempt,
  FallbackChain,
} from './providers'

export type {
  PromptContext,
  PromptResult,
  PromptBuildResult,
  PromptMetadata,
  PromptTokenEstimate,
  ValidationResult as PromptValidationResult,
} from './prompt-builder'

export {
  validatePromptContext,
  validateResolvedVariables as validatePromptVariables,
  validateAssembledPrompt,
  interpolate               as interpolatePrompt,
  extractPromptKeys,
  findUnresolved,
  formatVariableList,
  generateVersion           as generatePromptVersion,
  isSameSchema,
  buildSystemPrompt,
  buildUserPrompt,
} from './prompt-builder'
