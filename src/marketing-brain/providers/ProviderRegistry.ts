import type { AIProvider } from './AIProvider'

/**
 * Process-scoped registry of AI provider instances.
 *
 * Providers are registered at startup by createAIProviderManager().
 * The registry is a plain Map keyed by provider.id.
 *
 * Design:
 *   - Module-level singleton Map (process lifetime)
 *   - registerProvider() overwrites any previous registration with the same id
 *   - listActive() returns only providers with isActive === true
 *   - clear() is for testing
 */

const REGISTRY = new Map<string, AIProvider>()

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a provider. If a provider with the same id already exists, it is replaced.
 */
export function registerProvider(provider: AIProvider): void {
  REGISTRY.set(provider.id, provider)
}

/**
 * Register multiple providers at once.
 */
export function registerProviders(providers: AIProvider[]): void {
  for (const p of providers) REGISTRY.set(p.id, p)
}

/**
 * Retrieve a provider by its id.
 * Returns null if not found (or if the id was never registered).
 */
export function getProvider(id: string): AIProvider | null {
  return REGISTRY.get(id) ?? null
}

/**
 * List all registered providers, sorted by priority ascending (1 = first).
 * Providers with the same priority are sorted by id for deterministic output.
 */
export function listProviders(): AIProvider[] {
  return [...REGISTRY.values()].sort((a, b) =>
    a.priority !== b.priority
      ? a.priority - b.priority
      : a.id.localeCompare(b.id),
  )
}

/**
 * List only active providers (isActive === true), sorted by priority.
 * This is the list ProviderSelector works from.
 */
export function listActiveProviders(): AIProvider[] {
  return listProviders().filter(p => p.isActive)
}

/**
 * List disabled providers (isActive === false), sorted by priority.
 */
export function listDisabledProviders(): AIProvider[] {
  return listProviders().filter(p => !p.isActive)
}

/**
 * Remove a provider from the registry.
 * Returns true if the provider was found and removed, false otherwise.
 */
export function unregisterProvider(id: string): boolean {
  return REGISTRY.delete(id)
}

/**
 * Remove all registered providers. Primarily for test isolation.
 */
export function clearRegistry(): void {
  REGISTRY.clear()
}

/**
 * True if at least one active provider is registered.
 */
export function hasActiveProvider(): boolean {
  return [...REGISTRY.values()].some(p => p.isActive)
}

/**
 * Return a summary of the registry state for logging / diagnostics.
 */
export function registryStatus(): {
  total:    number
  active:   number
  disabled: number
  providers: Array<{ id: string; name: string; active: boolean; priority: number }>
} {
  const all = listProviders()
  return {
    total:    all.length,
    active:   all.filter(p => p.isActive).length,
    disabled: all.filter(p => !p.isActive).length,
    providers: all.map(p => ({
      id:       p.id,
      name:     p.name,
      active:   p.isActive,
      priority: p.priority,
    })),
  }
}
