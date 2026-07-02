// ─── Smart Intelligence Prompt Engine — Rendering (K43) ────────────────────
// Variable injection and versioning reuse marketing-brain's generic string
// primitives directly (interpolate/findUnresolved/generateVersion — pure
// functions, no dependency on marketing-brain's own domain types) instead
// of re-implementing {{var}} substitution or a fingerprinting scheme.
// Context injection reuses K33's getContextForTenant — a handful of useful
// context fields are exposed as extra {{variables}} (VAR_RE is \w+ only,
// so keys are camelCase, not dotted).

import { interpolate, findUnresolved } from '../../marketing-brain/prompt-builder/VariableInterpolator'
import { generateVersion } from '../../marketing-brain/prompt-builder/PromptVersion'
import { getContextForTenant } from '../context'
import { getActiveTemplate } from './PromptTemplateRegistry'
import type { RenderedPrompt } from './types'

function contextVariables(context: Awaited<ReturnType<typeof getContextForTenant>>): Record<string, string> {
  return {
    tenantPlan:      context.tenant.plan,
    tenantState:     context.tenant.state,
    businessName:    context.business.name,
    businessCountry: context.business.country,
    businessCurrency: context.business.currency,
    businessCity:    context.business.city,
  }
}

export async function renderPrompt(
  key: string,
  tenantId: string,
  variables: Record<string, string> = {},
  includeContext = true,
): Promise<RenderedPrompt> {
  const template = await getActiveTemplate(key)
  if (!template) throw new Error(`Intelligence: prompt template "${key}" not found`)

  const injected = includeContext
    ? { ...contextVariables(await getContextForTenant(tenantId)), ...variables }
    : variables

  const systemPrompt = interpolate(template.systemPrompt, injected)
  const userPrompt    = interpolate(template.userPrompt, injected)

  return {
    systemPrompt,
    userPrompt,
    version:             generateVersion(systemPrompt, userPrompt),
    unresolvedVariables: [...new Set([...findUnresolved(systemPrompt), ...findUnresolved(userPrompt)])],
  }
}
