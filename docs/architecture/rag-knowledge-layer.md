# RAG Knowledge Layer

## Purpose

Foundation for a future retrieval-augmented-generation (RAG) pipeline in the
Smart Intelligence platform. This module is **RAG-ready, not RAG-complete**:
no embeddings, no external AI provider calls anywhere in this module — by
explicit sprint constraint. It provides the document/chunk storage,
keyword-based retrieval, and permission/audit scaffolding that a future
embedding-backed search provider and prompt-assembly layer can build on
without any caller of this module changing.

## Naming collision note

This module was originally requested as "Sprint K47 — Knowledge Engine."
Both that sprint number and that module name were already taken in this
codebase's existing Smart Intelligence platform (`src/intelligence/`, built
across sprints K30–K66):

- **K47 is already the Skill System** (`src/intelligence/skills/`).
- **"Knowledge Engine" already exists** at `src/intelligence/knowledge/`
  (K39) — a *versioned tenant fact store* keyed by `(tenantId, key)`
  (`recordKnowledge`/`getKnowledge`/`queryKnowledge`), architecturally
  unrelated to documents/chunks/RAG retrieval. Do not confuse the two or
  extend one thinking it's the other.

To avoid colliding with live, boot-wired code, this module lives at
`src/intelligence/rag/` and its Prisma models are prefixed
`intelligence_rag_*` (vs. `intelligence_knowledge_*` for the K39 fact store).
Whoever owns the Kxx sprint backlog should assign this a real, unused sprint
number (next free slot after K66 at the time of writing).

## Module Location

```
src/intelligence/rag/
  types.ts                          — full contract: Repository/Document/Chunk,
                                       SemanticSearchProvider interface,
                                       RetrievalResult, KnowledgeQueryPermission
  RepositoryService.ts               — Knowledge Repository CRUD (tenant-scoped)
  DocumentService.ts                 — Knowledge Document CRUD; synchronous
                                       chunking on create; audit on create/delete
  ChunkService.ts                    — Knowledge Chunk storage + the chunking
                                       algorithm (word-count splitter, no AI)
  ContextBuilder.ts                  — assembles ranked chunks into a bounded
                                       context string (word-budget, not tokens)
  RetrievalService.ts                — the Retrieval Layer: permission check →
                                       candidate chunks → search → context
  KnowledgePermissions.ts            — permission-aware queries (tenant scoping
                                       + capability check, mirrors skills/SkillPermissions.ts)
  KnowledgeAuditLog.ts                — thin wrapper over the shared AuditService
  search/
    KeywordOverlapSearchProvider.ts  — default SemanticSearchProvider impl
                                       (bag-of-words term overlap, NOT embeddings)
    SearchProviderRegistry.ts        — pluggable active-provider registry
  index.ts                           — public API, exported from src/intelligence/index.ts
```

REST API: `src/routes/knowledge.ts`, mounted in `src/server.ts`.
OpenAPI spec: `docs/openapi/knowledge-api.yaml` (hand-authored — see below).

## Data Models

Three new Prisma models (`prisma/schema.prisma`), all MongoDB collections
created implicitly on first write (no migration step for this connector):

| Model | Collection | Key fields |
|---|---|---|
| `KnowledgeRagRepository` | `intelligence_rag_repositories` | tenantId, name, description, isActive |
| `KnowledgeRagDocument` | `intelligence_rag_documents` | repositoryId, tenantId, title, sourceType, status, metadata |
| `KnowledgeRagChunk` | `intelligence_rag_chunks` | documentId, repositoryId, tenantId, chunkIndex, content, tokenCount |

**No embedding field on `KnowledgeRagChunk` by design** — not stubbed, not
nullable-and-unused, simply absent. A future sprint adds it as a real,
reviewed migration when embeddings are actually implemented, rather than
carrying dead schema now.

`tokenCount` is a word-count approximation (`content.split(/\s+/).length`),
not a real tokenizer — used only for `ContextBuilder`'s word budget, not for
any AI provider's actual token limit.

## Semantic Search Abstraction

```ts
interface SemanticSearchProvider {
  readonly name: string
  search(query: SearchQuery, candidates: KnowledgeChunk[]): SearchResultItem[]
}
```

Today's only implementation, `keywordOverlapSearchProvider`: normalized
term-frequency overlap between the query and each candidate chunk (bag-of-
words, not TF-IDF — no corpus-wide document-frequency tracking). Zero AI
calls, zero external dependencies.

`SearchProviderRegistry` holds the active provider (default: keyword
overlap) behind `getActiveSearchProvider()`/`setActiveSearchProvider(name)`.
A future embedding-backed provider (`EmbeddingSearchProvider implements
SemanticSearchProvider`) can be registered and activated without
`RetrievalService` or the REST API changing at all — that's the entire
purpose of the interface boundary.

## Retrieval Layer

`retrieve(query, callerId, opts?, permission?)`:
1. `checkKnowledgeQueryPermission` — see Permissions below.
2. Fetch candidate chunks, scoped by `tenantId` (+ `repositoryId` if given).
3. Rank via the active `SemanticSearchProvider`, trim to `limit` (default 10).
4. `buildContext` assembles the ranked chunks into a single bounded string
   (default 1000-word budget; always includes at least the top result even
   if it alone exceeds the budget, rather than returning an empty context).
5. Records a `RETRIEVE` audit entry.

## Permission-Aware Queries

Two independent layers, not one:

1. **Tenant scoping** — the load-bearing check for the REST API (human admin
   callers via `authorizeAdmin`). Enforced *structurally*: every service
   function requires a `tenantId` and every Prisma query filters by it, so
   cross-tenant access is impossible regardless of any capability check.
   Verified by an explicit cross-tenant test case in
   `scripts/controlTestKnowledgeRag.ts`.
2. **Capability check** — `checkKnowledgeQueryPermission` mirrors
   `src/intelligence/skills/SkillPermissions.ts`'s `checkSkillPermission`
   exactly (`tenantScoped` + `requiredCapabilities`), reusing
   `resolveCallerCapabilities` from the Skill System rather than keeping a
   second capability store. This layer is for *programmatic* callers (K40
   agents / K46 advisors) that hold real capabilities — a human admin's
   `userId` will resolve to zero capabilities here, which is expected and
   correct (capability gating doesn't apply to REST callers; tenant scoping
   does).

## REST API

Tenant-facing, `authorizeAdmin` (Bearer JWT, `cafeId` = tenant scope) — not
the SuperAdmin-only, GET-only Intelligence Gateway
(`/api/superadmin/intelligence/*`), which has no shape for document
CRUD or search-with-body. Full spec: `docs/openapi/knowledge-api.yaml`.

| Method | Path | |
|---|---|---|
| POST | `/api/admin/knowledge/repositories` | Create repository |
| GET | `/api/admin/knowledge/repositories` | List repositories |
| GET/PATCH/DELETE | `/api/admin/knowledge/repositories/:id` | Get/update/delete |
| POST | `/api/admin/knowledge/repositories/:id/documents` | Add document (chunked synchronously) |
| GET | `/api/admin/knowledge/repositories/:id/documents` | List documents |
| GET/DELETE | `/api/admin/knowledge/documents/:id` | Get with chunks / delete |
| POST | `/api/admin/knowledge/search` | Retrieval (search + context assembly) |
| GET | `/api/admin/knowledge/audit` | Tenant's audit history |

A discovery-only summary operation (`knowledge-repositories`) is also
registered in `src/intelligence/gateway/ServiceRouter.ts`, so this module
shows up in the platform's existing `/api/superadmin/intelligence/services`
and `/openapi` surfaces for consistency — the full CRUD/search API is not
duplicated there.

Response envelope reuses `normalizeSuccess`/`normalizeError` from
`src/intelligence/gateway/ResponseNormalization.ts` for consistency with the
rest of the Intelligence platform.

## Audit Logs

No new audit table. `KnowledgeAuditLog.ts` calls the one shared
`src/core/audit/AuditService.ts` (`module: 'INTELLIGENCE_RAG'`), exactly like
`orchestrator/WorkflowEngine.ts`, `memory/MemoryEngine.ts`, and others
already do. `getKnowledgeAuditHistory(tenantId)` filters the shared
`AuditEntry` store by `module` + `metadata.tenantId` (the shared
`AuditFilter` type has no tenant dimension, so tenant-scoping happens in
this module rather than widening the shared filter for one caller).

## Tests

`scripts/controlTestKnowledgeRag.ts` — no test framework exists in this repo
(established convention, see other `scripts/controlTest*.ts` files); this
follows the same self-contained, self-cleaning pattern. Covers chunking
(overlap correctness), repository CRUD, document creation + chunking,
search relevance ranking (including a true-negative case), retrieval +
context assembly, permission enforcement (tenant-scoped rejection,
cross-tenant isolation, capability-gated rejection), and audit log
recording + tenant scoping. All test data is deleted at the end of the run.

## What K48+ (or whatever the next real sprint number is) should build next

- A real `EmbeddingSearchProvider` (requires the embeddings sprint this one
  explicitly excluded) — implements `SemanticSearchProvider`, registered via
  `registerSearchProvider`, activated via `setActiveSearchProvider`. No
  changes needed to `RetrievalService`, the REST API, or `ContextBuilder`.
- Add a real `embedding: Float[]` field to `KnowledgeRagChunk` at that point
  (a genuine migration, not a pre-emptive unused column now).
- Wire `RetrievalService.retrieve()`'s `context` output into an actual LLM
  prompt-assembly step for AI Copilot / advisor features.
- An async ingestion pipeline if large-file upload support is needed (the
  `PENDING` document status exists in the schema for this, but nothing
  produces it yet — chunking is synchronous today).
