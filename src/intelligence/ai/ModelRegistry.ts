// ─── Smart Intelligence AI Provider Layer — Model Registry (K42) ───────────
// Same Map-based registry idiom used throughout this module. Seeded with
// the same default model ids already configured in routes/aiCenter.ts's
// PROVIDER_META (read for reference, not extracted/refactored — that route
// stays untouched) so the two don't drift apart by accident.

import type { ModelDescriptor } from './types'

const registry = new Map<string, ModelDescriptor>()

function key(provider: string, modelId: string): string {
  return `${provider}:${modelId}`
}

export function registerModel(model: ModelDescriptor): void {
  const k = key(model.provider, model.modelId)
  if (registry.has(k)) {
    throw new Error(`Intelligence: model "${k}" is already registered`)
  }
  registry.set(k, model)
}

export function getModel(provider: string, modelId: string): ModelDescriptor | undefined {
  return registry.get(key(provider, modelId))
}

export function getAllModels(): ModelDescriptor[] {
  return Array.from(registry.values())
}

export function getModelsByProvider(provider: string): ModelDescriptor[] {
  return Array.from(registry.values()).filter(m => m.provider === provider)
}

export function getDefaultModel(provider: string): ModelDescriptor | undefined {
  return getModelsByProvider(provider).find(m => m.isDefault)
}

// ─── Built-in seed (matches routes/aiCenter.ts's PROVIDER_META defaults) ───
export function registerBuiltinModels(): void {
  const defaults: ModelDescriptor[] = [
    { provider: 'gemini',      modelId: 'gemini-2.5-flash',          isDefault: true },
    { provider: 'claude',      modelId: 'claude-opus-4-5',            isDefault: true },
    { provider: 'openai',      modelId: 'gpt-4o',                     isDefault: true },
    { provider: 'groq',        modelId: 'llama-3.1-70b-versatile',    isDefault: true },
    { provider: 'openrouter',  modelId: 'auto',                       isDefault: true },
  ]
  for (const model of defaults) {
    if (!getModel(model.provider, model.modelId)) registerModel(model)
  }
}

// for testing only
export function _resetModelRegistry(): void {
  registry.clear()
}
