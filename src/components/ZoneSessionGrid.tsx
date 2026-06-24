'use client'

/**
 * ZoneSessionGrid
 *
 * Waiter tablet dashboard showing active sessions grouped by zone.
 * Pulsing cards appear when an order reaches READY status (flash signal active).
 * "Mark as Served" emits waiter_mark_served → server READY → DELIVERED + dismiss client flash.
 *
 * Props:
 *   cafeId    — current cafe
 *   authToken — waiter JWT (passed from the page that already authenticated)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Wifi, WifiOff, Zap }         from 'lucide-react'
import { useZoneSocket, ZoneTokenAlert }             from '../hooks/useZoneSocket'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveSessionSummary {
  id:          string
  tokenNumber: number
  status:      string
  zoneId:      string
  zoneName:    string
  tableId:     string | null
  orderCount:  number
  createdAt:   string
}

interface ZoneGroup {
  zoneId:   string
  zoneName: string
  sessions: ActiveSessionSummary[]
}

interface Props {
  cafeId:    string
  authToken: string
}

// ─── Elapsed time label (e.g. "3 min ago") ────────────────────────────────────

function useElapsed(dateStr: string): string {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function update() {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
      if (diff < 60)        setLabel(`${diff}s`)
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m`)
      else                  setLabel(`${Math.floor(diff / 3600)}h`)
    }
    update()
    const t = setInterval(update, 10_000)
    return () => clearInterval(t)
  }, [dateStr])
  return label
}

// ─── Individual session card ───────────────────────────────────────────────────

interface CardProps {
  session:    ActiveSessionSummary
  alert:      ZoneTokenAlert | undefined
  authToken:  string
  cafeId:     string
  onServed:   (activeSessionId: string) => void
}

function SessionCard({ session, alert, authToken, cafeId, onServed }: CardProps) {
  const elapsed    = useElapsed(session.createdAt)
  const [busy, setBusy] = useState(false)
  const isReady    = !!alert

  async function handleMarkServed() {
    if (!alert || busy) return
    setBusy(true)
    try {
      // Emit via REST — simpler than passing the socket ref down
      await fetch('/api/zones/sessions/mark-served', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body:    JSON.stringify({ cafeId, orderId: alert.orderId, activeSessionId: session.id })
      })
      onServed(session.id)
    } catch (err) {
      console.error('mark-served error', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`
        relative rounded-2xl border-2 p-4 transition-all duration-300 select-none
        ${isReady
          ? 'border-orange-400 bg-orange-50 animate-pulse-card shadow-orange-200 shadow-lg'
          : 'border-gray-200 bg-white shadow-sm'
        }
      `}
    >
      {/* Ready badge */}
      {isReady && (
        <span className="
          absolute -top-3 left-1/2 -translate-x-1/2
          flex items-center gap-1
          rounded-full bg-orange-500 px-3 py-0.5
          text-[10px] font-bold uppercase tracking-widest text-white
          shadow-md
        ">
          <Zap size={10} />
          Needs Service
        </span>
      )}

      {/* Token number */}
      <div className={`text-5xl font-black tabular-nums leading-none mb-1 ${isReady ? 'text-orange-600' : 'text-gray-800'}`}>
        #{session.tokenNumber}
      </div>

      {/* Meta */}
      <p className="text-xs text-gray-400 mb-3">
        {elapsed} ago · {session.orderCount} order{session.orderCount !== 1 ? 's' : ''}
        {session.tableId && <span className="ml-1 text-gray-500">· table</span>}
      </p>

      {/* Status chip */}
      <span className={`
        inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide
        ${session.status === 'ACTIVE'          ? 'bg-emerald-100 text-emerald-700' : ''}
        ${session.status === 'PENDING_PAYMENT' ? 'bg-yellow-100  text-yellow-700'  : ''}
      `}>
        {session.status.replace('_', ' ')}
      </span>

      {/* Mark as served button */}
      {isReady && (
        <button
          onClick={handleMarkServed}
          disabled={busy}
          className="
            mt-4 w-full flex items-center justify-center gap-2
            rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95
            px-4 py-2.5 text-sm font-bold text-white
            transition-all duration-150 disabled:opacity-60
          "
        >
          <CheckCircle2 size={16} />
          {busy ? 'Marking…' : 'Mark as Served'}
        </button>
      )}
    </div>
  )
}

// ─── Zone group header ────────────────────────────────────────────────────────

function ZoneSectionHeader({ zoneName, count, readyCount }: { zoneName: string; count: number; readyCount: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-gray-800">{zoneName}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
          {count} active
        </span>
      </div>
      {readyCount > 0 && (
        <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white animate-bounce">
          {readyCount} ready
        </span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ZoneSessionGrid({ cafeId, authToken }: Props) {
  const [zones,   setZones]   = useState<ZoneGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const { readyTokens, clearToken, connected } = useZoneSocket({ cafeId, authToken })

  // ── Fetch active sessions from REST API ────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const res  = await fetch(`/api/zones/sessions/active?cafeId=${cafeId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (!res.ok) throw new Error('fetch failed')
      const data: ZoneGroup[] = await res.json()
      setZones(data)
    } catch {
      setError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [cafeId, authToken])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // Refresh list after a token is served
  const handleServed = useCallback((activeSessionId: string) => {
    clearToken(activeSessionId)
    setZones(prev => prev.map(z => ({
      ...z,
      sessions: z.sessions.filter(s => s.id !== activeSessionId)
    })))
  }, [clearToken])

  // ── Inject CSS for the pulsing card animation ──────────────────────────────
  // Tailwind doesn't ship this intensity of pulse by default
  const styleRef = useRef(false)
  if (!styleRef.current && typeof document !== 'undefined') {
    styleRef.current = true
    const s = document.createElement('style')
    s.textContent = `
      @keyframes pulse-card {
        0%,100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(249,115,22,0.4); }
        50%      { transform: scale(1.02); box-shadow: 0 0 0 12px rgba(249,115,22,0); }
      }
      .animate-pulse-card { animation: pulse-card 0.9s ease-in-out infinite; }
    `
    document.head.appendChild(s)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
      Loading sessions…
    </div>
  )

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600 text-center">
      {error}
    </div>
  )

  const totalReady = readyTokens.size

  return (
    <div className="space-y-8">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Zone Sessions</h2>
          {totalReady > 0 && (
            <p className="text-sm text-orange-600 font-semibold mt-0.5">
              {totalReady} token{totalReady > 1 ? 's' : ''} waiting for service
            </p>
          )}
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-600' : 'text-gray-400'}`}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'Live' : 'Connecting…'}
        </div>
      </div>

      {/* ── Zone groups ── */}
      {zones.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No active sessions right now.</p>
        </div>
      ) : (
        zones.map(zone => {
          const readyInZone = zone.sessions.filter(s => readyTokens.has(s.id)).length

          return (
            <section key={zone.zoneId}>
              <ZoneSectionHeader
                zoneName={zone.zoneName}
                count={zone.sessions.length}
                readyCount={readyInZone}
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {zone.sessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    alert={readyTokens.get(session.id)}
                    authToken={authToken}
                    cafeId={cafeId}
                    onServed={handleServed}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
