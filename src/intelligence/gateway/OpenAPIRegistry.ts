// ─── Smart Intelligence API Gateway — OpenAPI Registration (K50) ───────────
// Minimal manifest built from ServiceRouter's own operation table — no new
// spec authored by hand, no swagger dependency added.

import { getAllOperations } from './ServiceRouter'

const BASE_PATH = '/api/superadmin/intelligence'

export function buildOpenAPIManifest() {
  const paths: Record<string, unknown> = {}

  for (const op of getAllOperations()) {
    paths[`${BASE_PATH}${op.path}`] = {
      get: {
        operationId: op.id,
        summary:     op.summary,
        parameters: [
          { name: 'tenantId', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    }
  }

  return {
    openapi: '3.0.0',
    info:    { title: 'Smart Intelligence API', version: 'v1' },
    paths,
  }
}
