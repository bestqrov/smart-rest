// ─── RAG Knowledge Layer — Retrieval Layer ──────────────────────────────────
// The main entrypoint other modules (or a future K48+ AI Copilot RAG
// feature) would call: permission check → fetch candidate chunks (tenant/
// repository-scoped) → rank via the active SemanticSearchProvider →
// build a bounded context. No AI calls anywhere in this pipeline.

import { listChunksForRepository, listChunksForTenant } from './ChunkService'
import { getActiveSearchProvider } from './search/SearchProviderRegistry'
import { buildContext } from './ContextBuilder'
import { checkKnowledgeQueryPermission } from './KnowledgePermissions'
import { recordKnowledgeAudit } from './KnowledgeAuditLog'
import type { SearchQuery, RetrievalOptions, RetrievalResult, KnowledgeQueryPermission } from './types'

const DEFAULT_QUERY_PERMISSION: KnowledgeQueryPermission = { tenantScoped: true, requiredCapabilities: [] }

export async function retrieve(
  query: SearchQuery, callerId: string, opts?: RetrievalOptions, permission: KnowledgeQueryPermission = DEFAULT_QUERY_PERMISSION,
): Promise<RetrievalResult> {
  const check = checkKnowledgeQueryPermission(permission, callerId, query.tenantId)
  if (!check.allowed) throw new Error(check.reason ?? 'Query not permitted')

  const candidates = query.repositoryId
    ? await listChunksForRepository(query.repositoryId, query.tenantId)
    : await listChunksForTenant(query.tenantId)

  const provider = getActiveSearchProvider()
  const ranked = provider.search(query, candidates).slice(0, query.limit ?? opts?.limit ?? 10)

  const built = buildContext(ranked, opts?.maxContextWords ?? 1000)

  await recordKnowledgeAudit('RETRIEVE', query.repositoryId ?? query.tenantId, query.tenantId, callerId, {
    text: query.text, resultCount: ranked.length, provider: provider.name,
  })

  return { query, chunks: ranked, context: built.text, truncated: built.truncated }
}
