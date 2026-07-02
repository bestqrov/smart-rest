// ─── Smart Intelligence Business Advisor — Capability Registry (K46) ───────
// A catalog of known advisor capability strings, separate from any one
// advisor's declared capabilities — lets AdvisorRegistry validate that an
// advisor only claims capabilities the platform actually recognizes.

interface CapabilityEntry {
  id:          string
  description: string
}

const registry = new Map<string, CapabilityEntry>()

export function registerAdvisorCapability(id: string, description: string): void {
  registry.set(id, { id, description })
}

export function hasAdvisorCapability(id: string): boolean {
  return registry.has(id)
}

export function getAllAdvisorCapabilities(): CapabilityEntry[] {
  return [...registry.values()]
}
