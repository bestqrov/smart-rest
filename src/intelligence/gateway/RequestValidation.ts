// ─── Smart Intelligence API Gateway — Request Validation (K50) ─────────────
// Same zod idiom as middleware/validate.ts, applied to query params instead
// of a body (every gateway operation is a GET).

import { z } from 'zod'

export const GatewayQuerySchema = z.object({
  tenantId: z.string().optional(),
})

export function parseGatewayQuery(query: unknown): { tenantId?: string } {
  const result = GatewayQuerySchema.safeParse(query)
  return result.success ? result.data : {}
}
