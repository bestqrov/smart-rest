'use client'

/**
 * useZoneSocket
 *
 * Authenticated socket hook for the waiter/admin zone dashboard.
 * Joins room_{cafeId} and listens for zone-specific events:
 *   zone_token_ready  → a zone-session order reached READY status
 *   order_status_updated → general order update (clears pulsing on DELIVERED)
 *
 * Returns:
 *   readyTokens  — map of activeSessionId → ZoneTokenAlert (drives pulsing cards)
 *   clearToken   — call after waiter_mark_served to optimistically clear the pulse
 *   connected    — socket connection state
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket }                   from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

export interface ZoneTokenAlert {
  activeSessionId: string
  orderId:         string
  tokenNumber:     number
  zoneName:        string
  zoneId:          string
  arrivedAt:       Date
}

interface UseZoneSocketOptions {
  cafeId:    string
  authToken: string           // JWT Bearer token for the waiter/admin
}

export function useZoneSocket({ cafeId, authToken }: UseZoneSocketOptions) {
  const socketRef  = useRef<Socket | null>(null)
  const [connected,   setConnected]   = useState(false)
  const [readyTokens, setReadyTokens] = useState<Map<string, ZoneTokenAlert>>(new Map())

  // Optimistically clear a pulsing card after mark-as-served
  const clearToken = useCallback((activeSessionId: string) => {
    setReadyTokens(prev => {
      const next = new Map(prev)
      next.delete(activeSessionId)
      return next
    })
  }, [])

  useEffect(() => {
    if (!cafeId || !authToken) return

    const socket = socketIO(SOCKET_URL || window.location.origin, {
      transports: ['polling', 'websocket'],
      auth:       { token: authToken },
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join', `room_${cafeId}`)
    })

    socket.on('disconnect', () => setConnected(false))

    // Zone-session order reached READY → add pulsing alert
    socket.on('zone_token_ready', (payload: Omit<ZoneTokenAlert, 'arrivedAt'>) => {
      setReadyTokens(prev => {
        const next = new Map(prev)
        next.set(payload.activeSessionId, { ...payload, arrivedAt: new Date() })
        return next
      })
    })

    // Order moved to DELIVERED (by waiter_mark_served) → remove alert
    socket.on('order_status_updated', (payload: { status: string; activeSessionId?: string }) => {
      if (payload.status === 'DELIVERED' && payload.activeSessionId) {
        clearToken(payload.activeSessionId)
      }
    })

    return () => {
      socket.disconnect()
      setConnected(false)
    }
  }, [cafeId, authToken, clearToken])

  return { readyTokens, clearToken, socket: socketRef, connected }
}
