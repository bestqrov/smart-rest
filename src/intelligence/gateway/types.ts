// ─── Smart Intelligence API Gateway — Contracts (K50) ──────────────────────
// Read-only introspection only — every registered operation wraps an
// already-existing Intelligence module's discovery/list function. No
// operation creates, mutates, or executes anything.

export interface GatewayRequestContext {
  tenantId?: string
  query:     Record<string, string | undefined>
}

export interface GatewayOperation {
  id:                    string             // also the :service path segment
  version:               string             // e.g. "v1" — informational, response envelope carries it
  summary:               string
  path:                  string             // e.g. "/agents"
  requiredCapabilities?: string[]           // reserved for future K49 capability-gated operations
  handler:               (ctx: GatewayRequestContext) => Promise<unknown> | unknown
}

export interface GatewayResponseEnvelope<T = unknown> {
  success:  boolean
  version:  string
  data?:    T
  error?:   string
  meta: {
    requestId: string
    timestamp: string
  }
}
