'use client'
/**
 * useLocalRouter — wraps order POST requests with a 3-tier fallback:
 *   1. Cloud endpoint (normal)
 *   2. Local LAN endpoint (if cloud is unreachable but LAN discovered)
 *   3. SW queue via 202 (fully offline)
 */

import { ConnState } from './useOffline'

interface RouterOptions {
  conn:        ConnState
  lanEndpoint: string | null
}

interface PostOptions {
  url:     string
  body:    object
  headers?: HeadersInit
}

const TIMEOUT_MS = 6_000

async function timedFetch(url: string, init: RequestInit, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController()
  const id   = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(id)
  }
}

export function useLocalRouter({ conn, lanEndpoint }: RouterOptions) {
  async function smartPost({ url, body, headers = {} }: PostOptions): Promise<{
    ok: boolean
    queued: boolean
    via: 'cloud' | 'lan' | 'sw-queue'
    data: unknown
  }> {
    const init: RequestInit = {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(headers as Record<string, string>) },
      body:    JSON.stringify(body),
    }

    // ── Tier 1: try cloud (even if we think we're offline — might have just reconnected)
    try {
      const res = await timedFetch(url, init)
      if (res.ok) {
        return { ok: true, queued: false, via: 'cloud', data: await res.json().catch(() => ({})) }
      }
    } catch { /* fall through */ }

    // ── Tier 2: try LAN endpoint (same path, different base)
    if (lanEndpoint) {
      try {
        const lanUrl = `${lanEndpoint}${url.startsWith('/') ? url : '/' + url}`
        const res    = await timedFetch(lanUrl, init, 3_000)
        if (res.ok) {
          return { ok: true, queued: false, via: 'lan', data: await res.json().catch(() => ({})) }
        }
      } catch { /* fall through */ }
    }

    // ── Tier 3: SW offline queue (returns 202 with { queued: true })
    try {
      const res  = await fetch(url, init)          // SW intercepts and queues
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      const wasQueued = res.status === 202 || (data as { queued?: boolean }).queued === true
      return { ok: wasQueued, queued: wasQueued, via: 'sw-queue', data }
    } catch {
      return { ok: false, queued: false, via: 'sw-queue', data: null }
    }
  }

  return { smartPost }
}
