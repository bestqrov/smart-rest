import type { Channel } from '../models/MessageTemplate'

// ─── Token estimate ───────────────────────────────────────────────────────────

/**
 * Rough token count for cost estimation and provider limit checks.
 * Method: 1 token ≈ 4 characters (GPT-4 approximation — conservative for English,
 * may under-count Arabic/Darija due to multi-byte characters).
 */
export interface PromptTokenEstimate {
  systemTokens: number
  userTokens:   number
  totalTokens:  number
  /** Estimation approach used. Only CHAR_RATIO is currently implemented. */
  method:       'CHAR_RATIO'
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

/**
 * Non-content information about the assembled prompt.
 * Useful for logging, debugging, analytics, and audit trails.
 */
export interface PromptMetadata {
  /** Slug of the MessageTemplate that was selected. null if no template was found. */
  templateSlug:    string | null
  /** Slug of the persona (explicit or inferred). null if none. */
  personaSlug:     string | null
  /** Trigger string of the selected scenario. null if none. */
  scenarioTrigger: string | null
  /** Funnel stage of the selected scenario. null if none. */
  scenarioStage:   string | null
  /** Language code as supplied by the caller. */
  languageCode:    string
  /** Channel used for channel-specific output instructions. */
  channel:         Channel
  /** Total number of AI rules applied (hard + soft). */
  rulesApplied:    number
  /** Number of AI rules that are hard (mandatory). */
  hardRulesCount:  number
  /** primaryGoal from ScenarioKnowledge. null if no scenario knowledge. */
  primaryGoal:     string | null
  /** Urgency level from ScenarioKnowledge. null if no scenario knowledge. */
  urgency:         string | null
  /** ISO 8601 timestamp when the prompt was assembled. Not part of the content hash. */
  createdAt:       string
}

// ─── Prompt result ────────────────────────────────────────────────────────────

/**
 * The assembled, validated, provider-agnostic prompt ready to send to any AI provider.
 *
 * Provider mapping:
 *   Anthropic → system: systemPrompt, messages: [{ role:'user', content: userPrompt }]
 *   OpenAI    → messages: [{ role:'system', content: systemPrompt }, { role:'user', content: userPrompt }]
 *   Gemini    → systemInstruction: systemPrompt, contents: [{ role:'user', parts: [{ text: userPrompt }] }]
 */
export interface PromptResult {
  /** Fully assembled system prompt. Provider places this in the system slot. */
  systemPrompt:    string

  /** Fully assembled user prompt with all {{variables}} resolved. */
  userPrompt:      string

  /** The resolved variable map — keys and values used in interpolation. */
  variables:       Record<string, string>

  /** Non-content information about this build. */
  metadata:        PromptMetadata

  /**
   * Deterministic content fingerprint.
   * Same systemPrompt + userPrompt → same version.
   * Different content → different version.
   * Format: `v1-<8-char-hex>` (schema version prefix + djb2 hash).
   */
  version:         string

  /** Estimated token count for cost/limit checks. */
  estimatedTokens: PromptTokenEstimate
}

// ─── Build result (discriminated union) ───────────────────────────────────────

/**
 * Discriminated union result from `build()`.
 * Errors are structural failures (null template, unresolved variables).
 * Warnings are non-blocking observations (low confidence, missing knowledge).
 *
 * Never use try/catch to call `build()` — check `ok` instead.
 */
export type PromptBuildResult =
  | { ok: true;  result: PromptResult; warnings: string[] }
  | { ok: false; errors: string[];     warnings: string[] }
