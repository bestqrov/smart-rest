// ─── Smart Intelligence API Gateway — Response Normalization (K50) ─────────

import crypto from 'crypto'
import type { GatewayResponseEnvelope } from './types'

function meta() {
  return { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() }
}

export function normalizeSuccess<T>(data: T, version: string): GatewayResponseEnvelope<T> {
  return { success: true, version, data, meta: meta() }
}

export function normalizeError(error: string, version = 'v1'): GatewayResponseEnvelope<never> {
  return { success: false, version, error, meta: meta() }
}
