'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO } from 'socket.io-client'
import {
  LogOut, AlertTriangle, Clock, Users, TrendingUp,
  CreditCard, Banknote, Smartphone, Loader2, Check,
  RefreshCw, Bell
} from 'lucide-react'
import { tr, getLang, setLang, isRTL, POS_LANGS, type Lang } from '../../src/lib/posI18n'

// ─── Types ────────────────────────────────────────────────────────────────────

type TableStatus = 'EMPTY' | 'OPEN_QR' | 'OPEN_MANUAL' | 'BILL_REQUESTED' | 'INACTIVE'
type PayMethod   = 'CASH' | 'CARD' | 'ONLINE'

interface TableItem { name: string; quantity: number; unitPrice: number }
interface SuperTable {
  id: string; tableNumber: number; isActive: boolean; capacity: number
  status: TableStatus; totalPrice: number; openedAt: string | null
  waiterName: string | null; items: TableItem[]; orderIds: string[]
}
interface Stats { openCount: number; billCount: number; dailyRevenue: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsedStr(openedAt: string | null, lang: Lang): string {
  if (!openedAt) return ''
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  if (mins < 60) return `${mins} ${tr('min', lang)}`
  return `${Math.floor(mins / 60)}${tr('hr', lang)} ${mins % 60}${tr('min', lang)}`
}

function isLongOpen(openedAt: string | null): boolean {
  if (!openedAt) return false
  return Date.now() - new Date(openedAt).getTime() > 90 * 60 * 1000
}

function printReceipt(cafeName: string, tableNumber: number, items: TableItem[], total: number, currency: string) {
  const lines = items.map(i => `<tr>
    <td>${i.name}</td><td style="text-align:center">${i.quantity}</td>
    <td style="text-align:right">${(i.unitPrice * i.quantity).toFixed(2)}</td></tr>`).join('')
  const win = window.open('', '_blank', 'width=340,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:8px}
  .c{text-align:center}.b{font-weight:bold}.d{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}th{font-size:10px;text-align:left;border-bottom:1px solid #000;padding:2px 0}
  td{padding:2px 0}.tot td{font-weight:bold;border-top:1px dashed #000;padding-top:4px}
  @media print{body{width:80mm}@page{margin:0;size:80mm auto}}</style></head>
  <body><div class="c b" style="font-size:16px">${cafeName}</div>
  <div class="c" style="font-size:10px;color:#555">Smart Menu POS</div><div class="d"></div>
  <div>Table: <b>${tableNumber}</b></div><div>Date: ${new Date().toLocaleString()}</div><div class="d"></div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
  <tbody>${lines}</tbody>
  <tfoot><tr class="tot"><td colspan="2">TOTAL</td><td style="text-align:right">${total.toFixed(2)} ${currency}</td></tr></tfoot>
  </table><div class="d"></div><div class="c" style="font-size:10px">Thank you · شكراً · Merci</div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`)
  win.document.close()
}

const STATUS_STYLE: Record<TableStatus, string> = {
  INACTIVE:       'bg-gray-900 border-gray-800 opacity-40',
  EMPTY:          'bg-gray-800/60 border-gray-700',
  OPEN_QR:        'bg-sky-900/60 border-sky-500',
  OPEN_MANUAL:    'bg-amber-900/60 border-amber-500',
  BILL_REQUESTED: 'bg-red-900/80 border-red-400',
}
const STATUS_DOT: Record<TableStatus, string> = {
  INACTIVE: 'bg-gray-600', EMPTY: 'bg-gray-500',
  OPEN_QR: 'bg-sky-400', OPEN_MANUAL: 'bg-amber-400', BILL_REQUESTED: 'bg-red-400',
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupervisorPage() {
  const [lang, setLangState]   = useState<Lang>('ar')
  const [posToken, setPosToken] = useState<string | null>(null)
  const [cafeId,   setCafeId]   = useState('')
  const [cafeName, setCafeName] = useState('')
  const [currency, setCurrency] = useState('MAD')
  const [staff,    setStaff]    = useState<{ name: string; role: string } | null>(null)

  // login form
  const [subdomain, setSubdomain] = useState('')
  const [pin,       setPin]       = useState('')
  const [loginErr,  setLoginErr]  = useState('')
  const [logging,   setLogging]   = useState(false)

  // tables
  const [tables,    setTables]    = useState<SuperTable[]>([])
  const [stats,     setStats]     = useState<Stats>({ openCount: 0, billCount: 0, dailyRevenue: 0 })
  const [loading,   setLoading]   = useState(false)
  const [tick,      setTick]      = useState(0) // force re-render for elapsed time

  // selected table detail
  const [selTable,   setSelTable]   = useState<SuperTable | null>(null)
  const [payMethod,  setPayMethod]  = useState<PayMethod>('CASH')
  const [cashInput,  setCashInput]  = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutErr, setCheckoutErr] = useState('')
  const [doneTable,  setDoneTable]  = useState<number | null>(null)

  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null)

  const L = (key: Parameters<typeof tr>[0]) => tr(key, lang)
  const rtl = isRTL(lang)

  // init lang from localStorage
  useEffect(() => { setLangState(getLang()) }, [])

  // restore session
  useEffect(() => {
    const tok = localStorage.getItem('supervisorToken')
    const cid = localStorage.getItem('supervisorCafeId')
    const cur = localStorage.getItem('supervisorCurrency') || 'MAD'
    const cn  = localStorage.getItem('supervisorCafeName') || ''
    const st  = localStorage.getItem('supervisorStaff')
    if (tok && cid) {
      setPosToken(tok); setCafeId(cid); setCurrency(cur); setCafeName(cn)
      if (st) setStaff(JSON.parse(st))
    }
  }, [])

  const fetchTables = useCallback(async (token: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/supervisor/tables', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { if (res.status === 401) logout(); return }
      const data = await res.json()
      setTables(data.tables ?? [])
      setStats(data.stats ?? { openCount: 0, billCount: 0, dailyRevenue: 0 })
      // keep selected table in sync
      if (selTable) {
        const updated = (data.tables as SuperTable[]).find(t => t.id === selTable.id)
        if (updated) setSelTable(updated)
      }
    } finally { setLoading(false) }
  }, [selTable])

  // poll + socket
  useEffect(() => {
    if (!posToken || !cafeId) return
    fetchTables(posToken)
    const id = setInterval(() => fetchTables(posToken), 20_000)

    const socket = socketIO(SOCKET_URL || window.location.origin, { auth: { token: posToken }, transports: ['polling', 'websocket'] })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('join', `room_${cafeId}`))
    socket.on('new_order',       () => fetchTables(posToken))
    socket.on('bill_requested',  () => fetchTables(posToken))
    socket.on('order_completed', () => fetchTables(posToken))

    return () => { clearInterval(id); socket.disconnect(); socketRef.current = null }
  }, [posToken, cafeId, fetchTables])

  // elapsed time ticker
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginErr(''); setLogging(true)
    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.trim(), pinCode: pin.trim(), action: 'login' })
      })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error ?? 'Login failed'); return }

      const payload = JSON.parse(atob(data.token.split('.')[1]))
      if (data.staff?.role !== 'SUPERVISOR' && data.staff?.role !== 'CASHIER') {
        // Fetch cafe info for currency
      }
      localStorage.setItem('supervisorToken', data.token)
      localStorage.setItem('supervisorCafeId', payload.cafeId)
      localStorage.setItem('supervisorStaff', JSON.stringify(data.staff))

      // Fetch cafe profile for name + currency
      const prof = await fetch(`/api/public/cafe/${subdomain.trim()}`)
      if (prof.ok) {
        const pd = await prof.json()
        localStorage.setItem('supervisorCafeName', pd.name ?? '')
        localStorage.setItem('supervisorCurrency', pd.currency ?? 'MAD')
        setCafeName(pd.name ?? ''); setCurrency(pd.currency ?? 'MAD')
      }
      setPin('')
      setPosToken(data.token); setCafeId(payload.cafeId); setStaff(data.staff)
    } catch { setLoginErr('Network error') }
    finally   { setLogging(false) }
  }

  function logout() {
    ['supervisorToken','supervisorCafeId','supervisorStaff','supervisorCafeName','supervisorCurrency']
      .forEach(k => localStorage.removeItem(k))
    setPosToken(null); setStaff(null); setCafeId(''); setTables([])
    setSelTable(null)
  }

  async function handleCheckout(doPrint: boolean) {
    if (!selTable || !posToken) return
    setCheckingOut(true); setCheckoutErr('')
    try {
      const res = await fetch(`/api/pos/tables/${selTable.id}/checkout`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: payMethod, printReceipt: doPrint })
      })
      if (!res.ok) { const d = await res.json(); setCheckoutErr(d.error ?? 'Failed'); return }
      if (doPrint) {
        const d = await res.json()
        printReceipt(cafeName, selTable.tableNumber, d.items, d.totalPrice, currency)
      }
      setDoneTable(selTable.tableNumber)
      setTimeout(() => { setSelTable(null); setDoneTable(null); fetchTables(posToken) }, 2000)
    } finally { setCheckingOut(false) }
  }

  const cashVal = parseFloat(cashInput) || 0
  const change  = payMethod === 'CASH' && cashVal > 0 ? cashVal - (selTable?.totalPrice ?? 0) : null

  // ── Login screen ──────────────────────────────────────────────────────────

  if (!posToken) return (
    <div className={`min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 ${rtl ? 'rtl' : 'ltr'}`}>
      {/* Lang selector */}
      <div className="flex gap-2 mb-8">
        {POS_LANGS.map(l => (
          <button key={l.code} onClick={() => { setLang(l.code); setLangState(l.code) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${lang === l.code ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">👁</span>
          </div>
          <h1 className="text-white font-black text-xl">{L('supervisor')}</h1>
          <p className="text-gray-500 text-sm mt-1">{L('pin_subtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs font-semibold mb-1">{L('pin_subdomain')}</label>
            <input value={subdomain} onChange={e => setSubdomain(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              placeholder="plage" autoComplete="off" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs font-semibold mb-1">{L('pin_code')}</label>
            <input value={pin} onChange={e => setPin(e.target.value)} type="password" inputMode="numeric"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-center text-2xl tracking-widest"
              placeholder="••••" />
          </div>
          {loginErr && <p className="text-red-400 text-sm text-center">{loginErr}</p>}
          <button type="submit" disabled={logging}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {logging ? <><Loader2 className="w-4 h-4 animate-spin" />{L('pin_logging')}</> : L('pin_enter')}
          </button>
        </form>
      </div>
    </div>
  )

  // ── Main supervisor view ───────────────────────────────────────────────────

  return (
    <div className={`min-h-screen bg-gray-950 flex flex-col ${rtl ? 'rtl' : 'ltr'}`}>

      {/* Header */}
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm">👁</div>
          <div>
            <span className="text-white font-black text-sm">{L('supervisor')}</span>
            {cafeName && <span className="text-gray-500 text-xs ml-2">— {cafeName}</span>}
          </div>
          {staff && <span className="text-purple-400 text-xs font-medium px-2 py-0.5 bg-purple-900/40 rounded-full">{staff.name}</span>}
        </div>

        <div className="flex items-center gap-3">
          {/* Lang selector */}
          <div className="flex gap-1">
            {POS_LANGS.map(l => (
              <button key={l.code} onClick={() => { setLang(l.code); setLangState(l.code) }}
                className={`w-7 h-7 rounded-lg text-sm transition-all ${lang === l.code ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                {l.flag}
              </button>
            ))}
          </div>
          <button onClick={() => fetchTables(posToken)}
            className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={logout}
            className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-gray-900/60 border-b border-gray-800 px-4 py-3 flex items-center gap-6 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-gray-500 text-[10px] font-medium">{L('daily_total')}</p>
            <p className="text-emerald-400 font-black text-sm">{stats.dailyRevenue.toFixed(2)} {currency}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-gray-800" />
        <div className="flex items-center gap-2 shrink-0">
          <Users className="w-4 h-4 text-sky-400" />
          <div>
            <p className="text-gray-500 text-[10px] font-medium">{L('open_tables')}</p>
            <p className="text-sky-400 font-black text-sm">{stats.openCount}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-gray-800" />
        <div className="flex items-center gap-2 shrink-0">
          <Bell className="w-4 h-4 text-red-400" />
          <div>
            <p className="text-gray-500 text-[10px] font-medium">{L('pending_bills')}</p>
            <p className="text-red-400 font-black text-sm">{stats.billCount}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Table grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {tables.map(t => {
              const long = isLongOpen(t.openedAt)
              const elapsed = elapsedStr(t.openedAt, lang)
              const isSelected = selTable?.id === t.id
              return (
                <button key={t.id}
                  disabled={t.status === 'INACTIVE' || t.status === 'EMPTY'}
                  onClick={() => { setSelTable(t); setCheckoutErr(''); setDoneTable(null); setPayMethod('CASH'); setCashInput('') }}
                  className={`relative rounded-2xl border-2 p-3 text-left transition-all flex flex-col gap-1
                    ${STATUS_STYLE[t.status]}
                    ${t.status === 'INACTIVE' || t.status === 'EMPTY' ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'}
                    ${isSelected ? 'ring-2 ring-purple-400' : ''}
                    ${long ? 'ring-2 ring-yellow-400' : ''}
                  `}>
                  {/* Status dot */}
                  <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${STATUS_DOT[t.status]} ${t.status === 'BILL_REQUESTED' ? 'animate-pulse' : ''}`} />

                  {/* Alert icon */}
                  {long && <AlertTriangle className="absolute top-2 left-2 w-3.5 h-3.5 text-yellow-400" />}

                  <span className="text-white font-black text-lg leading-none mt-1">
                    {L('table')} {t.tableNumber}
                  </span>

                  {t.status !== 'EMPTY' && t.status !== 'INACTIVE' && (
                    <>
                      <span className="text-white font-extrabold text-base leading-none">
                        {t.totalPrice.toFixed(2)} <span className="text-xs font-normal text-gray-400">{currency}</span>
                      </span>
                      {elapsed && (
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${long ? 'text-yellow-300' : 'text-gray-400'}`}>
                          <Clock className="w-3 h-3" /> {elapsed}
                        </span>
                      )}
                      {t.waiterName && (
                        <span className="text-[10px] text-gray-400 truncate">{t.waiterName}</span>
                      )}
                      <span className="text-[10px] text-gray-500">{t.items.reduce((s,i)=>s+i.quantity,0)} {L('item')}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        {selTable && (
          <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
            {/* Panel header */}
            <div className="h-12 border-b border-gray-800 px-4 flex items-center justify-between shrink-0">
              <span className="text-white font-extrabold">{L('table')} {selTable.tableNumber}</span>
              <button onClick={() => setSelTable(null)}
                className="w-7 h-7 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white text-sm">✕</button>
            </div>

            {/* Meta */}
            <div className="px-4 py-3 border-b border-gray-800 shrink-0 space-y-1">
              {selTable.waiterName && (
                <p className="text-xs text-gray-400">{L('waiter')}: <span className="text-white font-semibold">{selTable.waiterName}</span></p>
              )}
              {selTable.openedAt && (
                <p className={`text-xs flex items-center gap-1 ${isLongOpen(selTable.openedAt) ? 'text-yellow-300' : 'text-gray-400'}`}>
                  <Clock className="w-3 h-3" /> {L('open_since')}: {elapsedStr(selTable.openedAt, lang)}
                  {isLongOpen(selTable.openedAt) && <AlertTriangle className="w-3 h-3 text-yellow-400 ml-1" />}
                </p>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {doneTable ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center">
                    <Check className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-white font-extrabold">{L('paid_success')}</p>
                </div>
              ) : selTable.items.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">{L('no_orders')}</p>
              ) : (
                selTable.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-800/60 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-sm">{item.quantity}</span>
                    </div>
                    <p className="text-white text-sm font-medium flex-1 truncate">{item.name}</p>
                    <span className="text-gray-300 tabular-nums text-sm shrink-0">
                      {(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Checkout panel */}
            {!doneTable && selTable.items.length > 0 && (
              <div className="shrink-0 border-t border-gray-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-semibold text-sm">{L('total')}</span>
                  <span className="text-2xl font-extrabold text-white">
                    {selTable.totalPrice.toFixed(2)} <span className="text-sm font-bold text-gray-400">{currency}</span>
                  </span>
                </div>

                {/* Payment method */}
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: 'CASH' as PayMethod,   icon: Banknote,   label: L('pay_cash') },
                    { key: 'CARD' as PayMethod,   icon: CreditCard, label: L('pay_card') },
                    { key: 'ONLINE' as PayMethod, icon: Smartphone, label: L('pay_online') },
                  ]).map(({ key, icon: Icon, label }) => (
                    <button key={key} onClick={() => setPayMethod(key)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-semibold transition-all
                        ${payMethod === key ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Cash input */}
                {payMethod === 'CASH' && (
                  <div className="space-y-1.5">
                    <input value={cashInput} onChange={e => setCashInput(e.target.value)}
                      type="number" inputMode="decimal"
                      placeholder={`${L('cash_given')}…`}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                    {change !== null && change >= 0 && (
                      <p className="text-emerald-400 text-sm font-bold text-center">
                        {L('change')}: {change.toFixed(2)} {currency}
                      </p>
                    )}
                  </div>
                )}

                {checkoutErr && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {checkoutErr}
                  </p>
                )}

                <button onClick={() => handleCheckout(true)} disabled={checkingOut}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {checkingOut ? <><Loader2 className="w-4 h-4 animate-spin" />{L('processing')}</> : L('approve_checkout')}
                </button>
                <button onClick={() => handleCheckout(false)} disabled={checkingOut}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2 rounded-xl transition-all text-sm disabled:opacity-50">
                  {L('pay_now')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
