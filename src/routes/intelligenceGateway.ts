import { Router } from 'express'
import {
  getOperation, getAllOperations, normalizeSuccess, normalizeError,
  parseGatewayQuery, checkOperationPermission, createIntelligenceGatewayLimiter, buildOpenAPIManifest,
} from '../intelligence/gateway'

const router = Router()
const gatewayLimiter = createIntelligenceGatewayLimiter()

function requireSuperAdmin(req: any, res: any, next: any) {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (!secret || !email || secret !== process.env.SUPERADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// GET /api/superadmin/intelligence/openapi — manifest of every registered operation below
router.get('/api/superadmin/intelligence/openapi', requireSuperAdmin, gatewayLimiter, (_req, res) => {
  res.json(buildOpenAPIManifest())
})

// GET /api/superadmin/intelligence/services — discovery of available :service ids
router.get('/api/superadmin/intelligence/services', requireSuperAdmin, gatewayLimiter, (_req, res) => {
  const ops = getAllOperations().map(({ id, version, summary, path }) => ({ id, version, summary, path }))
  res.json(normalizeSuccess(ops, 'v1'))
})

// GET /api/superadmin/intelligence/:service — routes to the matching Intelligence module's read API
router.get('/api/superadmin/intelligence/:service', requireSuperAdmin, gatewayLimiter, async (req, res) => {
  const serviceId = String(req.params.service)
  const op = getOperation(serviceId)
  if (!op) {
    return res.status(404).json(normalizeError(`Unknown Intelligence service "${serviceId}"`))
  }

  const permission = checkOperationPermission(op, [])
  if (!permission.allowed) {
    return res.status(403).json(normalizeError(permission.reason ?? 'Forbidden', op.version))
  }

  try {
    const { tenantId } = parseGatewayQuery(req.query)
    const data = await op.handler({ tenantId, query: req.query as Record<string, string | undefined> })
    res.json(normalizeSuccess(data, op.version))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error', op.version))
  }
})

export default router
