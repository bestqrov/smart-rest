'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface CashierShift {
  id:                  string
  status:              'OPEN' | 'CLOSED'
  startTime:            string
  endTime:              string | null
  initialCash:          number
  totalCollectedCash:   number
  plannedEndTime:       string | null
  countedCash:          number | null
  discrepancy:          number | null
  lockedAt:             string | null
}

export type TimingState = 'none' | 'ontime' | 'warning' | 'overtime'

export interface TimingStatus {
  state: TimingState
  label: string
}

const WARNING_WINDOW_MS = 15 * 60 * 1000 // start warning 15 min before plannedEndTime
const POLL_INTERVAL_MS  = 30_000

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

export function computeTimingStatus(shift: CashierShift | null, now: Date): TimingStatus {
  if (!shift?.plannedEndTime) return { state: 'none', label: '' }
  const planned = new Date(shift.plannedEndTime).getTime()
  const diff = planned - now.getTime()

  if (diff > WARNING_WINDOW_MS) {
    return { state: 'ontime', label: `⏱ Sortie dans ${formatDuration(diff)}` }
  }
  if (diff > 0) {
    return { state: 'warning', label: `⏱ Sortie dans ${formatDuration(diff)}` }
  }
  return { state: 'overtime', label: `⏱ +${formatDuration(diff)} — verrouillage à +1h` }
}

export function useCashierShift(token: string | null, subdomain: string) {
  const [shift, setShift]     = useState<CashierShift | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow]         = useState(() => new Date())
  const tokenRef = useRef(token)
  tokenRef.current = token

  const fetchStatus = useCallback(async () => {
    if (!tokenRef.current) return
    setLoading(true)
    try {
      const res = await fetch('/api/pos/shift/current', {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
      if (res.ok) {
        const data = await res.json()
        setShift(data.shift ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    fetchStatus()
    const poll = setInterval(fetchStatus, POLL_INTERVAL_MS)
    const clock = setInterval(() => setNow(new Date()), 30_000)
    return () => { clearInterval(poll); clearInterval(clock) }
  }, [token, fetchStatus])

  const openShift = useCallback(async (params: {
    pinCode?: string; demoStaffId?: string; initialCash: number; plannedEndTime?: string
  }) => {
    const res = await fetch('/api/pos/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain,
        action: 'open',
        pinCode: params.pinCode,
        demoStaffId: params.demoStaffId,
        initialCash: params.initialCash,
        plannedEndTime: params.plannedEndTime,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to open shift')
    setShift(data.shift)
    return data as { token: string; shift: CashierShift }
  }, [subdomain])

  const closeShift = useCallback(async (params: {
    pinCode?: string; demoStaffId?: string; countedCash: number
  }) => {
    const res = await fetch('/api/pos/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain,
        action: 'close',
        pinCode: params.pinCode,
        demoStaffId: params.demoStaffId,
        countedCash: params.countedCash,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to close shift')
    setShift(data.shift)
    return data.shift as CashierShift
  }, [subdomain])

  const timing = computeTimingStatus(shift, now)
  const isLocked = !!shift?.lockedAt

  return { shift, loading, timing, isLocked, fetchStatus, openShift, closeShift }
}
