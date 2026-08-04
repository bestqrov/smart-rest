'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type ConnState =
  | 'online'        // cloud reachable
  | 'lan-only'      // cloud down but LAN reachable — orders silently rerouted
  | 'offline'       // nothing reachable

const CLOUD_PING   = '/api/health'
const PING_TIMEOUT = 4_000  // ms

async function ping(url: string, timeout = PING_TIMEOUT): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const id   = setTimeout(() => ctrl.abort(), timeout)
    const res  = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal })
    clearTimeout(id)
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

interface UseOfflineOptions {
  localIp: string | null
  pollIntervalMs?: number
}

interface OfflineState {
  conn:          ConnState
  lanEndpoint:   string | null   // e.g. "http://192.168.1.100:4000"
  queuedOrders:  number
}

// online/offline browser events (below) already give fast-path detection;
// this interval is just a periodic confirmatory check, not the primary signal.
export function useOffline({ localIp, pollIntervalMs = 30_000 }: UseOfflineOptions) {
  const [state, setState] = useState<OfflineState>({
    conn:         'online',
    lanEndpoint:  null,
    queuedOrders: 0,
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkConnectivity = useCallback(async () => {
    const cloudUp = await ping(CLOUD_PING)

    if (cloudUp) {
      setState(s => ({ ...s, conn: 'online' }))
      // Trigger SW to flush any queued orders now that cloud is back
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.active?.postMessage({ type: 'FLUSH_ORDERS' })
        })
      }
      return
    }

    // Cloud is down — check LAN
    const candidateIps = [
      ...(localIp ? [`http://${localIp}:4000`] : []),
      'http://192.168.1.1:4000',
      'http://192.168.0.1:4000',
      'http://10.0.0.1:4000',
    ]

    for (const base of candidateIps) {
      const lanUp = await ping(`${base}/api/health`, 2_000)
      if (lanUp) {
        setState(s => ({ ...s, conn: 'lan-only', lanEndpoint: base }))
        return
      }
    }

    setState(s => ({ ...s, conn: 'offline', lanEndpoint: null }))
  }, [localIp])

  // Listen to browser online/offline events for fast detection
  useEffect(() => {
    const onOnline  = () => checkConnectivity()
    const onOffline = () => setState(s => ({ ...s, conn: 'offline' }))

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    checkConnectivity()

    // Periodic poll
    const interval = setInterval(checkConnectivity, pollIntervalMs)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [checkConnectivity, pollIntervalMs])

  // Listen to SW messages about queued orders
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'ORDER_QUEUED') {
        setState(s => ({ ...s, queuedOrders: s.queuedOrders + 1 }))
      }
      if (event.data?.type === 'ORDER_SYNCED') {
        setState(s => ({ ...s, queuedOrders: Math.max(0, s.queuedOrders - 1) }))
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  return state
}
