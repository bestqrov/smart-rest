'use client'

import { useEffect, useState } from 'react'
import { Landmark, CreditCard, Loader2, Save } from 'lucide-react'
import { useSAAuth } from '../../context'

const ERR: Record<string, string> = {
  NO_TAP_KEY: 'أضف مفتاح Tap أولاً',
  KEY_REJECTED: 'رفضت Tap هذا المفتاح',
  BAD_KEY_FORMAT: 'صيغة المفتاح غير صحيحة — يجب أن يبدأ بـ sk_live_ أو sk_test_',
  NO_ENCRYPTION: 'مفتاح التشفير غير مضبوط على الخادم',
}
type Bank = { bankName: string; accountHolder: string; iban: string; swift: string; instructions: string }

export default function PaymentSettingsPage() {
  const { header } = useSAAuth()
  const [bank, setBank] = useState<Bank>({ bankName: '', accountHolder: '', iban: '', swift: '', instructions: '' })
  const [tapEnabled, setTapEnabled] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [hint, setHint] = useState('')
  const [newKey, setNewKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const r = await fetch('/api/superadmin/platform-payment', { headers: header() })
    if (r.ok) {
      const d = await r.json()
      setBank({ bankName: d.bankName ?? '', accountHolder: d.accountHolder ?? '', iban: d.iban ?? '', swift: d.swift ?? '', instructions: d.instructions ?? '' })
      setTapEnabled(!!d.tapEnabled); setKeySaved(!!d.tapKeySaved); setHint(d.tapSecretHint ?? '')
    } else setMsg({ ok: false, text: 'تعذّر تحميل الإعدادات' })
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(tag: string, body: Record<string, unknown>) {
    setBusy(tag); setMsg(null)
    const r = await fetch('/api/superadmin/platform-payment', { method: 'PUT', headers: header(), body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { setMsg({ ok: true, text: 'تم الحفظ' }); setNewKey(''); await load() }
    else setMsg({ ok: false, text: ERR[d.code] ?? d.error ?? 'فشل الحفظ' })
    setBusy(null)
  }

  const field = (k: keyof Bank, label: string, ltr = false) => (
    <label className="block">
      <span className="text-sm text-zinc-400">{label}</span>
      <input value={bank[k]} onChange={e => setBank({ ...bank, [k]: e.target.value })} dir={ltr ? 'ltr' : undefined}
        className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500" />
    </label>
  )

  if (loading) return <div dir="rtl" className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">إعدادات الدفع</h1>
        <p className="text-zinc-400 text-sm mt-1">كيف تدفع المطاعم فواتير اشتراكها لك</p>
      </div>
      {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>{msg.text}</div>}

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Landmark className="w-5 h-5 text-blue-400" />التحويل البنكي</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {field('bankName', 'اسم البنك')}
          {field('accountHolder', 'صاحب الحساب')}
          {field('iban', 'IBAN', true)}
          {field('swift', 'SWIFT', true)}
        </div>
        <label className="block">
          <span className="text-sm text-zinc-400">تعليمات إضافية</span>
          <textarea value={bank.instructions} onChange={e => setBank({ ...bank, instructions: e.target.value })} rows={3} maxLength={500}
            className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500" />
        </label>
        <p className="text-xs text-zinc-500">يظهر التحويل البنكي في صفحة الدفع فقط عند تعبئة IBAN وصاحب الحساب.</p>
        <button onClick={() => save('bank', bank)} disabled={busy !== null} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-semibold">
          {busy === 'bank' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ بيانات البنك
        </button>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><CreditCard className="w-5 h-5 text-violet-400" />الدفع بالبطاقة (Tap)</h2>
        <p className="text-sm">{keySaved
          ? <span className="text-emerald-400">مفتاح محفوظ <span dir="ltr" className="font-mono">••••{hint}</span></span>
          : <span className="text-zinc-400">لا يوجد مفتاح محفوظ</span>}</p>
        <div className="flex gap-2">
          <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)} dir="ltr" autoComplete="off"
            placeholder={keySaved ? 'استبدال المفتاح: sk_live_…' : 'sk_live_… أو sk_test_…'}
            className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 font-mono text-sm focus:outline-none focus:border-violet-500" />
          <button onClick={() => save('key', { tapSecretKey: newKey.trim() })} disabled={busy !== null || !newKey.trim()} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg px-4 text-sm font-semibold">
            {busy === 'key' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ المفتاح'}
          </button>
        </div>
        <div className="pt-3 border-t border-zinc-800">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="font-medium">تفعيل الدفع بالبطاقة</span>
            <button type="button" role="switch" aria-checked={tapEnabled} disabled={busy !== null}
              onClick={() => save('toggle', { tapEnabled: !tapEnabled })}
              className={`relative w-12 h-6 rounded-full transition ${tapEnabled ? 'bg-emerald-500' : 'bg-zinc-700'} disabled:opacity-50`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${tapEnabled ? 'right-0.5' : 'right-6'}`} />
            </button>
          </label>
          <p className="text-xs text-zinc-500 mt-2">يبقى معطّلاً حتى تفعّله أنت</p>
        </div>
      </section>
    </div>
  )
}
