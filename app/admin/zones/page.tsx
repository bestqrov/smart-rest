'use client'

import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import {
  QrCode, Plus, Table2, Users, Printer, ToggleLeft, ToggleRight,
  Loader2, X, AlertTriangle, LayoutGrid
} from 'lucide-react'

type ZoneTable = { id: string; tableNumber: number; capacity: number; isActive: boolean }

type Zone = {
  id: string
  cafeId: string
  name: string
  displayType: number
  matchModeActive: boolean
  maxDynamicTokens: number
  tables: ZoneTable[]
  _count: { activeSessions: number }
}

const DISPLAY_TYPE_LABELS: Record<number, string> = {
  1: 'Card',
  2: 'Tent',
  3: 'Stand',
  4: 'Acrylic',
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

// ── QR canvas component ────────────────────────────────────────────────────────
function ZoneQrCanvas({ url, zoneId }: { url: string; zoneId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, url, {
      width: 160,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#1a2744', light: '#ffffff' },
    }).catch(() => {})
  }, [url])

  return (
    <canvas
      ref={canvasRef}
      id={`qr-canvas-${zoneId}`}
      className="rounded-xl border-2 border-emerald-100"
    />
  )
}

// ── Add Zone modal ─────────────────────────────────────────────────────────────
type AddZoneForm = {
  name: string
  displayType: number
  maxDynamicTokens: number
  matchModeActive: boolean
}

function AddZoneModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<AddZoneForm>({
    name: '',
    displayType: 1,
    maxDynamicTokens: 50,
    matchModeActive: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Zone name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to create zone')
      } else {
        onCreated()
        onClose()
      }
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-emerald-600" /> Add Zone
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Terrace, Bar, VIP Room"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              required
            />
          </div>

          {/* Display Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Type</label>
            <select
              value={form.displayType}
              onChange={e => setForm(f => ({ ...f, displayType: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value={1}>1 — Card</option>
              <option value={2}>2 — Tent</option>
              <option value={3}>3 — Stand</option>
              <option value={4}>4 — Acrylic</option>
            </select>
          </div>

          {/* Max Dynamic Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Dynamic Tokens</label>
            <input
              type="number"
              min={1}
              max={500}
              value={form.maxDynamicTokens}
              onChange={e => setForm(f => ({ ...f, maxDynamicTokens: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Match Mode */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.matchModeActive}
              onChange={e => setForm(f => ({ ...f, matchModeActive: e.target.checked }))}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-sm text-gray-700">Enable Match Mode on creation</span>
          </label>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Zone
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Zone card ──────────────────────────────────────────────────────────────────
function ZoneCard({
  zone,
  onMatchModeToggle,
}: {
  zone: Zone
  onMatchModeToggle: (id: string, active: boolean) => void
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const qrUrl = `${origin}/zone-scan?zoneId=${zone.id}`
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      const res = await fetch(`/api/zones/${zone.id}/match-mode`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !zone.matchModeActive }),
      })
      if (res.ok) {
        onMatchModeToggle(zone.id, !zone.matchModeActive)
      }
    } catch {}
    setToggling(false)
  }

  function printQr() {
    const canvas = document.getElementById(`qr-canvas-${zone.id}`) as HTMLCanvasElement | null
    const dataUrl = canvas ? canvas.toDataURL('image/png') : ''
    const w = window.open('', '_blank')!
    w.document.write(`<html><head><title>Zone QR — ${zone.name}</title>
    <style>
      body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; background: #fff; }
      .wrap { text-align: center; padding: 32px; }
      img { width: 240px; height: 240px; }
      h1 { font-size: 22px; font-weight: 900; color: #064e3b; margin-top: 12px; }
      p { font-size: 12px; color: #9ca3af; margin-top: 4px; }
      @media print { @page { margin: 8mm; } }
    </style></head><body>
      <div class="wrap">
        <img src="${dataUrl}" alt="QR ${zone.name}" />
        <h1>${zone.name}</h1>
        <p>${qrUrl}</p>
      </div>
    </body></html>`)
    w.document.close()
    w.print()
  }

  const hasNoTables = zone.tables.length === 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">{zone.name}</h3>
          <span className="text-xs text-gray-400">{DISPLAY_TYPE_LABELS[zone.displayType] ?? `Type ${zone.displayType}`}</span>
        </div>
        {/* Match mode toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={zone.matchModeActive ? 'Disable Match Mode' : 'Enable Match Mode'}
          className="flex items-center gap-1.5 shrink-0 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {toggling ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : zone.matchModeActive ? (
            <>
              <ToggleRight className="w-6 h-6 text-emerald-600" />
              <span className="text-emerald-700">Match On</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-6 h-6 text-gray-400" />
              <span className="text-gray-500">Match Off</span>
            </>
          )}
        </button>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-2">
        <ZoneQrCanvas url={qrUrl} zoneId={zone.id} />
        <p className="text-xs text-gray-300 font-mono text-center break-all px-1">{qrUrl}</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tables or No-Tables badge */}
        {hasNoTables ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-300 px-2.5 py-1 rounded-full">
            <Users className="w-3.5 h-3.5" />
            No Tables — Row Chair Mode
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
            <Table2 className="w-3.5 h-3.5" />
            {zone.tables.length} table{zone.tables.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Active sessions */}
        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
          <QrCode className="w-3.5 h-3.5" />
          {zone._count.activeSessions} active session{zone._count.activeSessions !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Print button */}
      <button
        onClick={printQr}
        className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors w-full"
      >
        <Printer className="w-4 h-4" /> Print QR
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function loadZones() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/zones', { headers: authHeader() })
      if (res.ok) {
        setZones(await res.json())
      } else {
        setLoadError('Failed to load zones')
      }
    } catch {
      setLoadError('Network error')
    }
    setLoading(false)
  }

  useEffect(() => { loadZones() }, [])

  function handleMatchModeToggle(id: string, active: boolean) {
    setZones(prev => prev.map(z => z.id === id ? { ...z, matchModeActive: active } : z))
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-emerald-600" /> Zones &amp; QR
        </h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Zone
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Error */}
      {!loading && loadError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{loadError}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !loadError && zones.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No zones yet.</p>
          <p className="text-sm mt-1">Click &quot;+ Add Zone&quot; to create your first zone.</p>
        </div>
      )}

      {/* Zones grid */}
      {!loading && !loadError && zones.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map(zone => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              onMatchModeToggle={handleMatchModeToggle}
            />
          ))}
        </div>
      )}

      {/* Add Zone modal */}
      {showAdd && (
        <AddZoneModal
          onClose={() => setShowAdd(false)}
          onCreated={loadZones}
        />
      )}
    </div>
  )
}
