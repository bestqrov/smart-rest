'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  QrCode, Download, Printer, Loader2, Plus, Minus,
  RefreshCw, CheckCircle, Layers, Unlink, PowerOff, Power
} from 'lucide-react'

type Seat = { id: string; seatNumber: number; qrToken: string }
type TableRow = {
  id: string; tableNumber: number; isActive: boolean; seats: Seat[]
  mergedIntoTableId: string | null
  mergedIntoTable?: { id: string; tableNumber: number } | null
}

export default function TablesPage() {
  const [tables, setTables]       = useState<TableRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [tableCount, setTableCount] = useState(5)
  const [seatsPerTable, setSeatsPerTable] = useState(4)
  const [qrImages, setQrImages]   = useState<Record<string, string>>({})
  const [subdomain, setSubdomain] = useState('')
  const [mergeSource, setMergeSource] = useState<string[]>([])
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [merging, setMerging]     = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  async function loadTables() {
    setLoading(true)
    const r = await fetch('/api/tables', { headers: authHeader() })
    if (r.ok) {
      const data: TableRow[] = await r.json()
      setTables(data)
      await renderQrCodes(data, subdomain)
    }
    setLoading(false)
  }

  async function renderQrCodes(data: TableRow[], sub = subdomain) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const imgs: Record<string, string> = {}
    for (const t of data) {
      for (const s of t.seats) {
        const url = `${origin}/${sub}/t/${t.tableNumber}/s/${s.seatNumber}?token=${s.qrToken}`
        try {
          imgs[s.qrToken] = await QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#064e3b', light: '#ffffff' } })
        } catch {}
      }
    }
    setQrImages(imgs)
  }

  useEffect(() => {
    ;(async () => {
      const token = localStorage.getItem('token')
      const sub   = localStorage.getItem('subdomain') || ''
      setSubdomain(sub)
      setLoading(true)
      const r = await fetch('/api/tables', { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) {
        const data: TableRow[] = await r.json()
        setTables(data)
        await renderQrCodes(data, sub)
      }
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generate() {
    setSyncError(null)
    setGenerating(true)
    const r = await fetch('/api/tables/sync', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableCount, seatsPerTable })
    })
    if (r.ok) {
      const data = await r.json()
      setTables(data.tables)
      await renderQrCodes(data.tables, subdomain)
    } else {
      const body = await r.json().catch(() => ({}))
      setSyncError(body.error || 'فشل المزامنة')
    }
    setGenerating(false)
  }

  async function handleMerge() {
    if (!mergeTarget || mergeSource.length === 0) return
    setMerging(true)
    await fetch('/api/tables/merge', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceTableIds: mergeSource, targetTableId: mergeTarget })
    })
    setMergeSource([]); setMergeTarget(null)
    await loadTables()
    setMerging(false)
  }

  async function handleUnmerge(tableId: string) {
    await fetch('/api/tables/unmerge', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTableId: tableId })
    })
    await loadTables()
  }

  function toggleMergeSource(id: string) {
    setMergeSource(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function toggleActive(tableId: string, activate: boolean) {
    const r = await fetch(`/api/admin/tables/${tableId}/activate`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ activate })
    })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      alert(body.error || 'فشل تغيير حالة الطاولة')
      return
    }
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, isActive: activate } : t))
  }

  function printQr() {
    const w = window.open('', '_blank')!
    w.document.write(`<html><head><title>QR Stickers</title>
    <style>
      body { margin: 0; font-family: sans-serif; }
      .grid { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; }
      .card { border: 2px solid #064e3b; border-radius: 12px; padding: 12px; text-align: center; width: 160px; break-inside: avoid; }
      .card img { width: 120px; height: 120px; }
      .table { font-weight: bold; font-size: 14px; color: #064e3b; }
      .seat { font-size: 11px; color: #555; margin-top: 2px; }
      @media print { @page { margin: 8mm; } }
    </style></head><body><div class="grid">`)
    tables.forEach(t => t.seats.forEach(s => {
      const img = qrImages[s.qrToken] || ''
      w.document.write(`<div class="card"><img src="${img}" /><div class="table">طاولة ${t.tableNumber}</div><div class="seat">مقعد ${s.seatNumber}</div></div>`)
    }))
    w.document.write('</div></body></html>')
    w.document.close()
    w.print()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  )

  const mergedTableIds = new Set(tables.filter(t => t.mergedIntoTableId).map(t => t.id))

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900">الطاولات والـ QR</h1>
        <button onClick={loadTables} className="text-gray-400 hover:text-emerald-600 transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* ── Generate form ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-emerald-600" /> مزامنة الطاولات + QR
        </h2>
        <p className="text-xs text-gray-400 mb-4">يضيف الطاولات/المقاعد الناقصة ويحذف الزائدة (مع الحفاظ على الـ QR الحالية)</p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">عدد الطاولات</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setTableCount(c => Math.max(1, c - 1))} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"><Minus className="w-4 h-4" /></button>
              <span className="w-8 text-center font-bold text-gray-800">{tableCount}</span>
              <button onClick={() => setTableCount(c => c + 1)} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">مقاعد / طاولة</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setSeatsPerTable(c => Math.max(1, c - 1))} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"><Minus className="w-4 h-4" /></button>
              <span className="w-8 text-center font-bold text-gray-800">{seatsPerTable}</span>
              <button onClick={() => setSeatsPerTable(c => c + 1)} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            مزامنة
          </button>
          {tables.length > 0 && (
            <button
              onClick={printQr}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-700 px-5 py-2.5 rounded-xl font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" /> طباعة الـ QR
            </button>
          )}
        </div>
        {syncError && (
          <p className="text-xs text-red-500 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{syncError}</p>
        )}
        {tables.length > 0 && !syncError && (
          <p className="text-xs text-gray-400 mt-3">
            {tables.length} طاولة · {tables.reduce((s, t) => s + t.seats.length, 0)} مقعد · الرابط: <span className="text-emerald-600">{typeof window !== 'undefined' ? window.location.origin : ''}/{subdomain}/t/:n/s/:n?token=...</span>
          </p>
        )}
      </div>

      {/* ── Table merge tool ─────────────────────────────────────── */}
      {tables.length > 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-600" /> دمج الطاولات (لمجموعات كبيرة)
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {tables.filter(t => !t.mergedIntoTableId).map(t => (
              <button
                key={t.id}
                onClick={() => toggleMergeSource(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  mergeSource.includes(t.id)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'border-gray-200 text-gray-700 hover:border-violet-400'
                }`}
              >
                T{t.tableNumber}
              </button>
            ))}
          </div>
          {mergeSource.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500">دمج في:</span>
              <select
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                value={mergeTarget || ''}
                onChange={e => setMergeTarget(e.target.value || null)}
              >
                <option value="">اختر الطاولة الرئيسية</option>
                {tables.filter(t => !mergeSource.includes(t.id) && !t.mergedIntoTableId).map(t => (
                  <option key={t.id} value={t.id}>T{t.tableNumber}</option>
                ))}
              </select>
              <button
                onClick={handleMerge}
                disabled={!mergeTarget || merging}
                className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'دمج'}
              </button>
            </div>
          )}
          {tables.some(t => t.mergedIntoTableId) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">الطاولات المدمجة حالياً:</p>
              <div className="flex flex-wrap gap-2">
                {tables.filter(t => t.mergedIntoTableId).map(t => (
                  <div key={t.id} className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-xs">
                    <span className="text-amber-800">T{t.tableNumber} → T{t.mergedIntoTable?.tableNumber}</span>
                    <button onClick={() => handleUnmerge(t.id)} className="text-amber-500 hover:text-red-500 ml-1">
                      <Unlink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── QR grid ──────────────────────────────────────────────── */}
      {tables.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد طاولات بعد. ابدأ بتوليد طاولاتك.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tables.map(table => (
            <div key={table.id} className={`rounded-2xl p-5 shadow-sm border transition-colors ${
              !table.isActive
                ? 'bg-gray-50 border-gray-200 opacity-75'
                : table.mergedIntoTableId
                  ? 'bg-amber-50/30 border-amber-200'
                  : 'bg-white border-gray-100'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-800">طاولة {table.tableNumber}</h3>

                  {/* ── Activation badge ── */}
                  {table.isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      <Power className="w-3 h-3" /> نشطة
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                      <PowerOff className="w-3 h-3" /> خاملة
                    </span>
                  )}

                  {table.mergedIntoTableId && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      مدمجة مع T{table.mergedIntoTable?.tableNumber}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{table.seats.length} مقاعد</span>

                  {/* ── Manager activation toggle ── */}
                  {table.isActive ? (
                    <button
                      onClick={() => toggleActive(table.id, false)}
                      className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 px-3 py-1.5 rounded-lg transition-colors"
                      title="تعطيل الطاولة (تصبح غير متاحة للطلب)"
                    >
                      <PowerOff className="w-3.5 h-3.5" /> تعطيل
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleActive(table.id, true)}
                      className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold"
                      title="تفعيل الطاولة — تصبح متاحة للطلب ميدانياً"
                    >
                      <Power className="w-3.5 h-3.5" /> تفعيل الطاولة
                    </button>
                  )}
                </div>
              </div>

              {/* QR codes — dimmed for inactive tables */}
              <div className={`flex flex-wrap gap-4 ${!table.isActive ? 'pointer-events-none' : ''}`}>
                {table.seats.map(seat => (
                  <div key={seat.seatNumber} className="flex flex-col items-center gap-1">
                    {qrImages[seat.qrToken] ? (
                      <div className="relative">
                        <img
                          src={qrImages[seat.qrToken]}
                          alt={`T${table.tableNumber}-S${seat.seatNumber}`}
                          className={`w-24 h-24 rounded-lg border ${!table.isActive ? 'border-gray-200 grayscale' : 'border-gray-100'}`}
                        />
                        {!table.isActive && (
                          <div className="absolute inset-0 rounded-lg bg-gray-100/70 flex items-center justify-center">
                            <span className="text-2xl">🔒</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    )}
                    <span className="text-xs text-gray-500">م{seat.seatNumber}</span>
                    {table.isActive && (
                      <a
                        href={qrImages[seat.qrToken] || '#'}
                        download={`T${table.tableNumber}-S${seat.seatNumber}.png`}
                        className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5"
                      >
                        <Download className="w-3 h-3" /> حفظ
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
