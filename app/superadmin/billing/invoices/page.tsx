'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, Play, Copy, Check } from 'lucide-react'
import { useSAAuth } from '../../context'

type Inv = {
  id: string; invoiceNumber: string; cafeName: string; subdomain: string; suspended: boolean; planId: string | null
  amount: number; currency: string; status: string; method: string | null; issuedAt: string; dueAt: string | null; paidAt: string | null
  transferRef: string | null; transferReportedAt: string | null; reminder1At: string | null; reminder2At: string | null; suspendedAt: string | null; payToken: string
}
const TABS = [
  { v: '', label: 'الكل' }, { v: 'ISSUED', label: 'بانتظار الدفع' }, { v: 'PENDING_CONFIRMATION', label: 'بانتظار التأكيد' },
  { v: 'PAID', label: 'مدفوعة' }, { v: 'VOID', label: 'ملغاة' },
]
const STATUS: Record<string, { label: string; cls: string }> = {
  ISSUED: { label: 'بانتظار الدفع', cls: 'bg-amber-900/40 text-amber-300' },
  PENDING_CONFIRMATION: { label: 'بانتظار التأكيد', cls: 'bg-blue-900/40 text-blue-300' },
  PAID: { label: 'مدفوعة', cls: 'bg-emerald-900/40 text-emerald-300' },
  VOID: { label: 'ملغاة', cls: 'bg-zinc-800 text-zinc-400' },
}
const d = (s: string | null) => s ? new Date(s).toLocaleDateString('ar-MA') : '—'

export default function SubscriptionInvoicesPage() {
  const { header } = useSAAuth()
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Inv[]>([])
  const [paidAll, setPaidAll] = useState<Inv[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [r, p] = await Promise.all([
      fetch(`/api/superadmin/subscription-invoices?status=${status}`, { headers: header() }),
      fetch('/api/superadmin/subscription-invoices?status=PAID', { headers: header() }),
    ])
    if (r.ok) setRows((await r.json()).invoices ?? []); else setMsg({ ok: false, text: 'تعذّر تحميل الفواتير' })
    if (p.ok) setPaidAll((await p.json()).invoices ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthTotals = useMemo(() => {
    const now = new Date(); const out: Record<string, number> = {}
    for (const i of paidAll) {
      if (!i.paidAt) continue
      const p = new Date(i.paidAt)
      if (p.getFullYear() === now.getFullYear() && p.getMonth() === now.getMonth()) out[i.currency] = (out[i.currency] ?? 0) + i.amount
    }
    return out
  }, [paidAll])

  async function act(inv: Inv, kind: 'confirm' | 'void') {
    const q = kind === 'confirm'
      ? `تأكيد استلام ${inv.amount} ${inv.currency} من ${inv.cafeName} (${inv.invoiceNumber})؟`
      : `إلغاء الفاتورة ${inv.invoiceNumber}؟`
    if (!confirm(q)) return
    setBusy(inv.id + kind); setMsg(null)
    const r = await fetch(`/api/superadmin/subscription-invoices/${inv.id}/${kind}`, { method: 'POST', headers: header(), body: '{}' })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? { ok: true, text: kind === 'confirm' ? 'تم تأكيد الاستلام' : 'تم إلغاء الفاتورة' } : { ok: false, text: j.error ?? 'فشلت العملية' })
    setBusy(null); load()
  }

  async function runCycle() {
    if (!confirm('تشغيل دورة الفوترة الآن؟ (إصدار الفواتير المستحقة، التذكيرات، والإيقاف)')) return
    setBusy('cycle'); setMsg(null)
    const r = await fetch('/api/superadmin/billing/run-cycle', { method: 'POST', headers: header(), body: '{}' })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok
      ? { ok: true, text: `تمت الدورة — فواتير صادرة: ${j.issued ?? 0} · تذكير أول: ${j.reminder1 ?? 0} · تذكير ثانٍ: ${j.reminder2 ?? 0} · إيقاف: ${j.suspended ?? 0}` }
      : { ok: false, text: j.error ?? 'فشلت دورة الفوترة' })
    setBusy(null); load()
  }

  function copyLink(inv: Inv) {
    navigator.clipboard?.writeText(`${window.location.origin}/billing/pay/${inv.payToken}`)
      .then(() => { setCopied(inv.id); setTimeout(() => setCopied(null), 1500) }).catch(() => {})
  }

  const now = Date.now()

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><FileText className="w-7 h-7 text-blue-400" />فواتير الاشتراكات</h1>
          <p className="text-zinc-400 text-sm mt-1">تذكير بعد 3 و7 أيام من الاستحقاق، وإيقاف بعد 14 يوماً</p>
        </div>
        <button onClick={runCycle} disabled={busy !== null} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-semibold">
          {busy === 'cycle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}تشغيل دورة الفوترة الآن
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <p className="text-sm text-zinc-400 mb-2">المدفوع هذا الشهر</p>
        <div className="flex flex-wrap gap-6">
          {Object.keys(monthTotals).length === 0
            ? <span className="text-zinc-500">لا شيء بعد</span>
            : Object.entries(monthTotals).map(([c, v]) => <span key={c} className="text-2xl font-bold" dir="ltr">{v.toLocaleString('en')} <span className="text-base text-zinc-400">{c}</span></span>)}
        </div>
      </div>

      {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>{msg.text}</div>}

      <div className="flex flex-wrap gap-2">
        {TABS.map(tb => (
          <button key={tb.v} onClick={() => setStatus(tb.v)} className={`px-3 py-1.5 rounded-lg text-sm ${status === tb.v ? 'bg-blue-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800'}`}>{tb.label}</button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        : rows.length === 0 ? <p className="text-center text-zinc-500 py-16">لا توجد فواتير</p>
        : (
          <table className="w-full text-sm">
            <thead className="text-zinc-400 border-b border-zinc-800">
              <tr className="text-right">
                {['رقم الفاتورة', 'المطعم', 'الخطة', 'المبلغ', 'الحالة', 'الاستحقاق', 'التذكيرات', 'مرجع التحويل', ''].map(h => <th key={h} className="px-3 py-3 font-medium whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map(i => {
                const open = i.status === 'ISSUED' || i.status === 'PENDING_CONFIRMATION'
                const overdue = open && i.dueAt && new Date(i.dueAt).getTime() < now
                const st = STATUS[i.status] ?? { label: i.status, cls: 'bg-zinc-800 text-zinc-300' }
                return (
                  <tr key={i.id} className="hover:bg-zinc-800/40">
                    <td className="px-3 py-3 font-mono whitespace-nowrap" dir="ltr">{i.invoiceNumber}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{i.cafeName}</div>
                      <div className="text-xs text-zinc-500" dir="ltr">{i.subdomain}</div>
                      {i.suspended && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-red-900/50 text-red-300">موقوف</span>}
                    </td>
                    <td className="px-3 py-3">{i.planId ?? '—'}</td>
                    <td className="px-3 py-3 font-semibold whitespace-nowrap" dir="ltr">{i.amount} {i.currency}</td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${st.cls}`}>{st.label}</span></td>
                    <td className={`px-3 py-3 whitespace-nowrap ${overdue ? 'text-red-400 font-semibold' : ''}`}>{d(i.dueAt)}</td>
                    <td className="px-3 py-3 text-zinc-400">{[i.reminder1At, i.reminder2At].filter(Boolean).length}/2</td>
                    <td className="px-3 py-3 font-mono text-xs" dir="ltr">{i.transferRef ?? '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2 justify-end whitespace-nowrap">
                        {open && <button onClick={() => act(i, 'confirm')} disabled={busy !== null} className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-md px-2 py-1 text-xs">{busy === i.id + 'confirm' ? '…' : 'تأكيد الاستلام'}</button>}
                        {open && <button onClick={() => act(i, 'void')} disabled={busy !== null} className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-md px-2 py-1 text-xs">{busy === i.id + 'void' ? '…' : 'إلغاء'}</button>}
                        <button onClick={() => copyLink(i)} title="نسخ رابط الدفع" className="bg-zinc-800 hover:bg-zinc-700 rounded-md px-2 py-1">{copied === i.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
