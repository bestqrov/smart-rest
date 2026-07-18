// ─── RAG Knowledge Layer — Audit ────────────────────────────────────────────
// Thin wrapper over the one shared AuditService (src/core/audit/AuditService.ts)
// — same pattern as orchestrator/WorkflowEngine.ts, memory/MemoryEngine.ts,
// etc. No new audit table.

import { AuditService } from '../../core'

export async function recordKnowledgeAudit(
  action: string, entityId: string, tenantId: string, performedBy: string, metadata?: Record<string, unknown>,
): Promise<void> {
  await AuditService.createAudit({
    module:      'INTELLIGENCE_RAG',
    entity:      'KnowledgeRagDocument',
    entityId,
    action,
    performedBy,
    metadata:    { tenantId, ...metadata },
  }).catch(() => undefined)
}

export async function getKnowledgeAuditHistory(tenantId: string, limit = 50) {
  const history = await AuditService.getAuditHistory({ module: 'INTELLIGENCE_RAG' })
  // AuditEntry.metadata carries tenantId (see recordKnowledgeAudit above) —
  // AuditFilter has no tenantId dimension, so scope it here instead of
  // widening the shared filter type for one caller.
  return history.items
    .filter((entry) => entry.metadata?.tenantId === tenantId)
    .slice(0, limit)
}
