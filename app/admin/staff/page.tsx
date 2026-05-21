'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string
  name: string
  role: 'WAITER' | 'CASHIER' | 'SUPERVISOR'
  shiftStatus: 'ACTIVE' | 'OFF_DUTY'
  clockInTime: string | null
  assignedTables: { id: string; tableNumber: number; zone: string | null }[]
}

interface QRData {
  token: string
  expiresAt: string
  ttlSeconds: number
}

const ROLE_LABELS: Record<string, string> = {
  WAITER: 'Waiter',
  CASHIER: 'Cashier',
  SUPERVISOR: 'Supervisor',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  const tk = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return tk ? { Authorization: `Bearer ${tk}` } : {}
}

function elapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [qrData, setQrData] = useState<QRData | null>(null)
  const [qrCountdown, setQrCountdown] = useState(0)
  const [qrError, setQrError] = useState('')
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch staff list ────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/pos/waiters/status', { headers: authHeader() })
    if (!res.ok) return
    const data = await res.json()
    setStaff(data.waiters ?? [])
    setLoading(false)
  }, [])

  // ── Generate QR token ───────────────────────────────────────────────────────
  const generateQR = useCallback(async () => {
    setQrError('')
    try {
      const res = await fetch('/api/admin/waiter-qr-token', { headers: authHeader() })
      if (!res.ok) {
        setQrError('Failed to generate QR token')
        return
      }
      const data: QRData = await res.json()
      setQrData(data)

      // Build the full login URL with token
      const origin = window.location.origin
      const loginUrl = `${origin}/w/login?token=${data.token}`
      const dataUrl = await QRCode.toDataURL(loginUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#0f172a', light: '#f8fafc' },
      })
      setQrDataUrl(dataUrl)
      setQrCountdown(data.ttlSeconds)

      // Countdown ticker
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        setQrCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Auto-refresh 10 s before expiry
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(generateQR, (data.ttlSeconds - 10) * 1000)
    } catch {
      setQrError('Network error generating QR token')
    }
  }, [])

  useEffect(() => {
    fetchStaff()
    generateQR()
    const pollStaff = setInterval(fetchStaff, 15_000)
    return () => {
      clearInterval(pollStaff)
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchStaff, generateQR])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeWaiters = staff.filter(s => s.shiftStatus === 'ACTIVE')
  const offDuty = staff.filter(s => s.shiftStatus === 'OFF_DUTY')
  const countdownPct = qrData ? (qrCountdown / qrData.ttlSeconds) * 100 : 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Staff Management</h1>
          <p className="text-sm text-slate-500">Manage waiters, shifts, and zones</p>
        </div>
        <button
          onClick={fetchStaff}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── QR Login Panel ──────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <span>📱</span> Waiter QR Login
          </h2>

          {qrError ? (
            <div className="text-red-500 text-sm mb-3">{qrError}</div>
          ) : null}

          {qrDataUrl ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl overflow-hidden shadow-lg ring-4 ring-amber-500/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Waiter QR login code" width={240} height={240} />
              </div>

              {/* Countdown bar */}
              <div className="w-full">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Expires in</span>
                  <span className={qrCountdown < 30 ? 'text-red-500 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                    {qrCountdown}s
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      countdownPct > 50 ? 'bg-green-500' : countdownPct > 20 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${countdownPct}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Single-use · Auto-refreshes · Waiter scans with phone camera
              </p>

              <button
                onClick={generateQR}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Generate New QR
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-4">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{activeWaiters.length}</p>
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">On Duty</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-2xl p-4">
              <p className="text-3xl font-bold text-slate-600 dark:text-slate-300">{offDuty.length}</p>
              <p className="text-sm text-slate-500 font-medium">Off Duty</p>
            </div>
          </div>

          {/* Active waiters detail */}
          {activeWaiters.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide">
                Currently On Duty
              </h3>
              <div className="space-y-2">
                {activeWaiters.map(w => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      <div>
                        <p className="font-medium text-sm text-slate-800 dark:text-white">{w.name}</p>
                        <p className="text-xs text-slate-500">
                          {ROLE_LABELS[w.role]}
                          {w.assignedTables.length > 0 && ` · Tables: ${w.assignedTables.map(t => t.tableNumber).join(', ')}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {w.clockInTime && (
                        <p className="text-xs text-slate-400">{elapsed(w.clockInTime)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Full staff table ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow border border-slate-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200">All Staff ({staff.length})</h2>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No staff found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Tables</th>
                  <th className="px-5 py-3 font-medium">Shift Duration</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-100 dark:border-slate-700 last:border-0 ${
                      i % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-slate-700/20'
                    }`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-white">{s.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.role === 'SUPERVISOR'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : s.role === 'CASHIER'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {ROLE_LABELS[s.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          s.shiftStatus === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'
                        }`} />
                        <span className={s.shiftStatus === 'ACTIVE' ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}>
                          {s.shiftStatus === 'ACTIVE' ? 'On Duty' : 'Off Duty'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {s.assignedTables.length > 0
                        ? s.assignedTables.map(t => `#${t.tableNumber}${t.zone ? ` (${t.zone})` : ''}`).join(', ')
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {s.clockInTime ? elapsed(s.clockInTime) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
