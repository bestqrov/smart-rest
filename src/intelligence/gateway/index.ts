// ─── Smart Intelligence API Gateway — Public API (K50) ─────────────────────

export type { GatewayRequestContext, GatewayOperation, GatewayResponseEnvelope } from './types'

export { getOperation, getAllOperations } from './ServiceRouter'

export { normalizeSuccess, normalizeError } from './ResponseNormalization'

export { GatewayQuerySchema, parseGatewayQuery } from './RequestValidation'

export { checkOperationPermission, type PermissionGateResult } from './PermissionGate'

export { createIntelligenceGatewayLimiter } from './RateLimitHooks'

export { buildOpenAPIManifest } from './OpenAPIRegistry'
