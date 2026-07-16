// ─── Smart Intelligence AI Provider Layer — Contracts (K42) ────────────────
// AIProvider/AIProviderRequest/AIProviderResponse/TokenUsage/ProviderHealth
// already exist and are complete (marketing-brain/providers/AIProvider.ts)
// — re-exported from ./index, not redefined here. The one genuinely missing
// piece is a Model Registry: providers expose a `generate()` with an
// optional model override, but there's no queryable catalog of which
// models exist per provider outside routes/aiCenter.ts's route-local table.

export interface ModelDescriptor {
  provider:       string   // matches AIProvider.id (gemini | claude | openai | groq | openrouter)
  modelId:        string
  isDefault:      boolean
  contextWindow?: number
}
