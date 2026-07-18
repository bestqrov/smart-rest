/**
 * Integration test for the RAG Knowledge Layer (src/intelligence/rag/).
 * Covers: Repository CRUD, Document creation + chunking (no embeddings),
 * Semantic Search abstraction (keyword-overlap default), Retrieval Layer +
 * Context Builder, Permission-aware queries (tenant-scoping enforcement),
 * and Audit Logs (shared AuditService).
 *
 * All test data is created and fully cleaned up by this script.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/controlTestKnowledgeRag.ts
 */
import {
  createRepository, getRepository, listRepositories, updateRepository, deleteRepository,
  createDocument, getDocumentWithChunks, listDocuments,
  splitIntoChunks, retrieve, getKnowledgeAuditHistory,
  checkKnowledgeQueryPermission,
} from '../src/intelligence/rag'

let passed = 0, failed = 0
function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

const TENANT_A = `rag-test-tenant-a-${Date.now()}`
const TENANT_B = `rag-test-tenant-b-${Date.now()}`
const CALLER   = 'rag-test-caller'

async function main() {
  console.log('\n1. Chunking (no AI, no embeddings) — pure word-count splitter')
  const longText = Array.from({ length: 450 }, (_, i) => `word${i}`).join(' ')
  const chunks = splitIntoChunks(longText, { maxChunkWords: 200, overlapWords: 20 })
  ok(chunks.length === 3, `450 words @ 200/chunk with 20 overlap produces 3 chunks (got ${chunks.length})`)
  ok(chunks[1].split(' ').slice(0, 20).join(' ') === chunks[0].split(' ').slice(-20).join(' '), 'consecutive chunks share the expected overlap')

  console.log('\n2. Repository CRUD (tenant-scoped)')
  const repo = await createRepository({ tenantId: TENANT_A, name: 'Test Repo', description: 'integration test' })
  ok(!!repo.id, 'repository created')
  ok(repo.isActive === true, 'repository defaults to active')

  const fetched = await getRepository(repo.id, TENANT_A)
  ok(fetched?.id === repo.id, 'getRepository returns the created repo for the owning tenant')

  const crossTenant = await getRepository(repo.id, TENANT_B)
  ok(crossTenant === null, 'getRepository returns null for a different tenant (structural tenant isolation)')

  const listed = await listRepositories(TENANT_A)
  ok(listed.some((r) => r.id === repo.id), 'listRepositories includes the new repo')

  const updated = await updateRepository(repo.id, TENANT_A, { name: 'Renamed Repo' })
  ok(updated.name === 'Renamed Repo', 'updateRepository applies the change')

  console.log('\n3. Document creation → synchronous chunking → PROCESSED status')
  const doc = await createDocument({
    repositoryId: repo.id, tenantId: TENANT_A, title: 'Menu Policy',
    content: 'Our restaurant offers a full refund within 24 hours of a reservation cancellation. ' +
             'Walk-in customers are seated on a first-come first-served basis. ' +
             'Group reservations of 8 or more require a 20% deposit.',
  }, CALLER)
  ok(doc.status === 'PROCESSED', `document status is PROCESSED (got ${doc.status})`)

  const withChunks = await getDocumentWithChunks(doc.id, TENANT_A)
  ok(!!withChunks && withChunks.chunks.length > 0, `document has chunks (got ${withChunks?.chunks.length ?? 0})`)
  ok(withChunks!.chunks.every((c) => c.tenantId === TENANT_A && c.repositoryId === repo.id), 'every chunk carries the correct tenantId/repositoryId')

  const docList = await listDocuments(repo.id, TENANT_A)
  ok(docList.some((d) => d.id === doc.id), 'listDocuments includes the new document')

  console.log('\n4. Semantic Search abstraction + Retrieval Layer + Context Builder')
  const result = await retrieve({ tenantId: TENANT_A, repositoryId: repo.id, text: 'reservation deposit group' }, CALLER)
  ok(result.chunks.length > 0, `retrieval found matching chunks (got ${result.chunks.length})`)
  ok(result.chunks[0].chunk.content.toLowerCase().includes('deposit'), 'top-ranked chunk actually contains a query term ("deposit")')
  ok(result.context.length > 0, 'context text was assembled')
  ok(result.truncated === false, 'small document does not trigger truncation')

  const noMatch = await retrieve({ tenantId: TENANT_A, repositoryId: repo.id, text: 'xyz-nonexistent-term-zzz' }, CALLER)
  ok(noMatch.chunks.length === 0, 'a query with no term overlap returns zero results (not a false-positive match)')

  console.log('\n5. Permission-aware queries — tenant scoping is enforced, not just advisory')
  const crossTenantResult = await retrieve({ tenantId: TENANT_B, repositoryId: repo.id, text: 'reservation' }, CALLER)
  ok(crossTenantResult.chunks.length === 0, 'searching tenant A\'s repository as tenant B returns zero chunks (repositoryId-scoped query still filters candidates by tenantId in ChunkService)')

  const permCheck = checkKnowledgeQueryPermission({ tenantScoped: true, requiredCapabilities: [] }, CALLER, undefined)
  ok(permCheck.allowed === false, 'a tenant-scoped permission check with no tenantId is rejected')

  const permCheckOk = checkKnowledgeQueryPermission({ tenantScoped: true, requiredCapabilities: [] }, CALLER, TENANT_A)
  ok(permCheckOk.allowed === true, 'a tenant-scoped permission check with a tenantId is allowed (no capabilities required)')

  const permCheckCapability = checkKnowledgeQueryPermission({ tenantScoped: false, requiredCapabilities: ['knowledge:admin'] }, CALLER, undefined)
  ok(permCheckCapability.allowed === false, 'a capability-gated check rejects a caller with no matching capability (human admin callerId resolves to zero capabilities)')

  console.log('\n6. Audit Logs (shared AuditService, not a new table)')
  const auditHistory = await getKnowledgeAuditHistory(TENANT_A)
  ok(auditHistory.some((e) => e.action === 'CREATE_DOCUMENT' && e.entityId === doc.id), 'audit log recorded CREATE_DOCUMENT for this document')
  ok(auditHistory.some((e) => e.action === 'RETRIEVE'), 'audit log recorded at least one RETRIEVE action')
  ok(auditHistory.every((e) => (e.metadata as any)?.tenantId === TENANT_A), 'every returned audit entry is scoped to tenant A only')

  console.log('\nCleanup')
  await deleteRepository(repo.id, TENANT_A)
  const afterDelete = await getRepository(repo.id, TENANT_A)
  ok(afterDelete === null, 'repository deletion cascaded (repo no longer exists)')
  const chunksAfterDelete = await getDocumentWithChunks(doc.id, TENANT_A)
  ok(chunksAfterDelete === null, 'document was cascade-deleted with its repository')

  const { default: prisma } = await import('../src/prisma')
  await prisma.$disconnect()

  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(failed === 0 ? 'INTEGRATION TEST: PASS' : 'INTEGRATION TEST: FAIL')
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error('INTEGRATION TEST: ERROR', err)
  process.exit(1)
})
