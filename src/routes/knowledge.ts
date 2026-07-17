// ─── RAG Knowledge Layer — REST API ─────────────────────────────────────────
// Tenant-facing (authorizeAdmin), unlike src/routes/intelligenceGateway.ts
// (SuperAdmin-only, read-only, GET-only — the wrong shape for document
// CRUD/search-with-body). Response envelope reuses gateway/ResponseNormalization
// for consistency with the rest of the Intelligence platform.

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { normalizeSuccess, normalizeError } from '../intelligence/gateway'
import {
  createRepository, getRepository, listRepositories, updateRepository, deleteRepository,
  createDocument, getDocumentWithChunks, listDocuments, deleteDocument,
  retrieve, getKnowledgeAuditHistory,
} from '../intelligence/rag'

const router = express.Router()
const API_VERSION = 'v1'

function caller(req: Request): { tenantId: string; callerId: string } {
  return { tenantId: req.admin!.cafeId, callerId: req.admin!.userId }
}

function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : 'Internal error'
  const status  = message.includes('not found') ? 404 : message.includes('not permitted') ? 403 : 400
  return res.status(status).json(normalizeError(message, API_VERSION))
}

// ─── Repositories ────────────────────────────────────────────────────────────

router.post('/api/admin/knowledge/repositories', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = caller(req)
    const { name, description } = req.body as { name?: string; description?: string }
    if (!name?.trim()) return res.status(400).json(normalizeError('name is required', API_VERSION))
    const repo = await createRepository({ tenantId, name, description })
    res.status(201).json(normalizeSuccess(repo, API_VERSION))
  } catch (err) { handleError(res, err) }
})

router.get('/api/admin/knowledge/repositories', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = caller(req)
    const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true'
    const repos = await listRepositories(tenantId, { isActive })
    res.json(normalizeSuccess(repos, API_VERSION))
  } catch (err) { handleError(res, err) }
})

router.get('/api/admin/knowledge/repositories/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = caller(req)
    const repo = await getRepository(String(req.params.id), tenantId)
    if (!repo) return res.status(404).json(normalizeError('Repository not found', API_VERSION))
    res.json(normalizeSuccess(repo, API_VERSION))
  } catch (err) { handleError(res, err) }
})

router.patch('/api/admin/knowledge/repositories/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = caller(req)
    const { name, description, isActive } = req.body as { name?: string; description?: string | null; isActive?: boolean }
    const repo = await updateRepository(String(req.params.id), tenantId, { name, description, isActive })
    res.json(normalizeSuccess(repo, API_VERSION))
  } catch (err) { handleError(res, err) }
})

router.delete('/api/admin/knowledge/repositories/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = caller(req)
    await deleteRepository(String(req.params.id), tenantId)
    res.json(normalizeSuccess({ deleted: true }, API_VERSION))
  } catch (err) { handleError(res, err) }
})

// ─── Documents ───────────────────────────────────────────────────────────────

router.post('/api/admin/knowledge/repositories/:id/documents', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, callerId } = caller(req)
    const { title, content, sourceType, sourceRef, contentType, metadata } = req.body as {
      title?: string; content?: string; sourceType?: 'MANUAL' | 'UPLOAD' | 'URL' | 'SYSTEM'
      sourceRef?: string; contentType?: string; metadata?: Record<string, unknown>
    }
    if (!title?.trim())   return res.status(400).json(normalizeError('title is required', API_VERSION))
    if (!content?.trim()) return res.status(400).json(normalizeError('content is required', API_VERSION))

    const doc = await createDocument(
      { repositoryId: String(req.params.id), tenantId, title, content, sourceType, sourceRef, contentType, metadata },
      callerId,
    )
    res.status(201).json(normalizeSuccess(doc, API_VERSION))
  } catch (err) { handleError(res, err) }
})

router.get('/api/admin/knowledge/repositories/:id/documents', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = caller(req)
    const docs = await listDocuments(String(req.params.id), tenantId)
    res.json(normalizeSuccess(docs, API_VERSION))
  } catch (err) { handleError(res, err) }
})

router.get('/api/admin/knowledge/documents/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = caller(req)
    const result = await getDocumentWithChunks(String(req.params.id), tenantId)
    if (!result) return res.status(404).json(normalizeError('Document not found', API_VERSION))
    res.json(normalizeSuccess(result, API_VERSION))
  } catch (err) { handleError(res, err) }
})

router.delete('/api/admin/knowledge/documents/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, callerId } = caller(req)
    await deleteDocument(String(req.params.id), tenantId, callerId)
    res.json(normalizeSuccess({ deleted: true }, API_VERSION))
  } catch (err) { handleError(res, err) }
})

// ─── Search / Retrieval ──────────────────────────────────────────────────────

router.post('/api/admin/knowledge/search', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, callerId } = caller(req)
    const { repositoryId, text, limit, maxContextWords } = req.body as {
      repositoryId?: string; text?: string; limit?: number; maxContextWords?: number
    }
    if (!text?.trim()) return res.status(400).json(normalizeError('text is required', API_VERSION))

    const result = await retrieve({ tenantId, repositoryId, text, limit }, callerId, { maxContextWords })
    res.json(normalizeSuccess(result, API_VERSION))
  } catch (err) { handleError(res, err) }
})

// ─── Audit ───────────────────────────────────────────────────────────────────

router.get('/api/admin/knowledge/audit', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = caller(req)
    const limit = req.query.limit ? Number(req.query.limit) : undefined
    const entries = await getKnowledgeAuditHistory(tenantId, limit)
    res.json(normalizeSuccess(entries, API_VERSION))
  } catch (err) { handleError(res, err) }
})

export default router
