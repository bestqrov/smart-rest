// ─── Smart Intelligence Business Advisor — Public API (K46) ────────────────
// Thin consumer-facing surface over the registry + pipeline modules.

import { processAdvisorRequest } from './AdvisorRequestPipeline'
import { getAdvisor, getAllAdvisors, getAdvisorsByDomain, getAdvisorsByCapability } from './AdvisorRegistry'
import type { RunAgentOptions } from '../runtime'
import type { AdvisorRequest, AdvisorResponse } from './types'

export async function askAdvisor(request: AdvisorRequest, opts?: RunAgentOptions): Promise<AdvisorResponse> {
  return processAdvisorRequest(request, opts)
}

export function listAdvisors() {
  return getAllAdvisors()
}

export function findAdvisor(id: string) {
  return getAdvisor(id)
}

export function findAdvisorsByDomain(domain: string) {
  return getAdvisorsByDomain(domain)
}

export function findAdvisorsByCapability(capability: string) {
  return getAdvisorsByCapability(capability)
}
