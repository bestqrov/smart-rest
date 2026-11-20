'use client'

import { useCallback, useEffect, useState } from 'react'
import { Handshake, Plus, Loader2, X, Copy, Check, KeyRound, AlertTriangle, RefreshCw } from 'lucide-react'
import { useSAAuth } from '../context'

// ─── Types (mirror src/routes/agencyPartners.ts + AgencyService.getAgencyDashboard) ───

type Tier = 'SILVER' | 'GOLD' | 'PLATINUM'

interface AgencyRow {
  id: string; name: string; email: string; phone: string | null; status: string; referralCode: string
  lastLoginAt: string | null; createdAt: string
  tier: Tier; ratePct: number; activeRestaurants: number; referred: number
  pending: number; approved: number; paid: number
}

interface Dashboard {
  agency: { id: string; name: string; email: string; phone: string | null; status: string; referralCode: string; accountManager: string | null; coBrandName: string | null; createdAt: string }
  tier: Record<string, unknown> & { tier: Tier; ratePct: number; activeRestaurants: number }
  totals: { referred: number; thisMonth: number; pending: number; approved: number; paid: number; lifetime: number; currency: string | null }
  months: { month: string; amount: number }[]
  restaurants: { cafeId: string; name: string; country: string | null; isActive: boolean; status: string; freeMenuSetup: boolean; joinedAt: string; totalPaid: number; commission: number }[]
  commissions: { id: string; cafeName: string; paidAmount: number; currency: string; tier: string; ratePct: number; commissionAmount: number; status: string; createdAt: string }[]
}

const TIERS: { tier: Tier; min: number; max: number | null; rate: number }[] = [
  { tier: 'SILVER', min: 0, max: 5, rate: 25 },
  { tier: 'GOLD', min: 6, max: 15, rate: 30 },
  { tier: 'PLATINUM', min: 16, max: null, rate: 35 },
]

const TIER_BADGE: Record<Tier, string> = {
  SILVER: 'bg-zinc-700 text-zinc-100',
  GOLD: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  PLATINUM: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-300',
  APPROVED: 'bg-blue-500/15 text-blue-300',
  PAID: 'bg-emerald-500/15 text-emerald-300',
  ACTIVE: 'bg-emerald-500/15 text-emerald-300',
  SUSPENDED: 'bg-red-500/15 text-red-300',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'قيد الانتظار', APPROVED: 'معتمد', PAID: 'مدفوع', ACTIVE: 'نشط', SUSPENDED: 'موقوف',
  CONVERTED: 'يدفع', TRACKED: 'مسجّل',
}
const TIER_LABEL: Record<Tier, string> = { SILVER: 'فضي', GOLD: 'ذهبي', PLATINUM: 'بلاتيني' }
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s

const money = (n: number, cur?: string | null) => `${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${cur ? ' ' + cur : ''}`
const signupLink = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref=${code}`

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) }).catch(() => {}) }}
      className="shrink-0 p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700" title="نسخ">
      {ok ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-300" />}
    </button>
  )
}

function SecretBox({ title, password, link, onClose }: { title: string; password: string; link?: string; onClose: () => void }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-amber-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{title}</p>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-amber-200/80">تُعرض كلمة المرور المؤقتة هذه مرة واحدة فقط ولا يمكن استرجاعها لاحقاً. انسخها الآن وأرسلها إلى الوكالة بطريقة آمنة.</p>
      <div className="flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2">
        <code className="flex-1 font-mono text-sm text-zinc-100 break-all">{password}</code>
        <CopyBtn text={password} />
      </div>
      {link && (
        <div>
          <p className="text-xs text-zinc-400 mb-1">رابط التسجيل بالإحالة</p>
          <div className="flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2">
            <code className="flex-1 font-mono text-xs text-zinc-300 break-all">{link}</code>
            <CopyBtn text={link} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgenciesPage() {
  const { header } = useSAAuth()
  const [rows, setRows] = useState<AgencyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ name: string; password: string; code: string } | null>(null)

  const [selId, setSelId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/superadmin/agencies', { headers: header() })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setRows(d.agencies ?? [])
    } catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [header])

  useEffect(() => { load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setErr('')
    try {
      const r = await fetch('/api/superadmin/agencies', { method: 'POST', headers: header(), body: JSON.stringify(form) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setCreated({ name: d.agency.name, password: d.temporaryPassword, code: d.agency.referralCode })
      setForm({ name: '', email: '', phone: '' }); setShowNew(false)
      load()
    } catch (e) { setErr((e as Error).message) } finally { setCreating(false) }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Handshake className="w-7 h-7 text-blue-400" />الوكالات</h1>
          <p className="text-zinc-400 text-sm mt-1">برنامج الشركاء — عمولة متكررة: فضي 25% · ذهبي 30% · بلاتيني 35%</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />تحديث
          </button>
          <button onClick={() => setShowNew(v => !v)} className="px-3 py-2 text-sm bg-blue-600 rounded-lg hover:bg-blue-500 flex items-center gap-2">
            <Plus className="w-4 h-4" />وكالة جديدة
          </button>
        </div>
      </div>

      {err && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-2">{err}</div>}

      {created && (
        <SecretBox title={`تم إنشاء الوكالة "${created.name}"`} password={created.password} link={signupLink(created.code)} onClose={() => setCreated(null)} />
      )}

      {showNew && (
        <form onSubmit={create} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input required placeholder="اسم الوكالة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
          <input required type="email" placeholder="البريد الإلكتروني" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="الهاتف (اختياري)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
          <button disabled={creating} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2">
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}إنشاء
          </button>
        </form>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="text-zinc-400 text-xs uppercase">
            <tr className="border-b border-zinc-800">
              <th className="text-start px-4 py-3">الوكالة</th><th className="text-start px-4 py-3">المستوى</th>
              <th className="text-end px-4 py-3">النشطة / المُحالة</th><th className="text-end px-4 py-3">قيد الانتظار</th>
              <th className="text-end px-4 py-3">معتمد</th><th className="text-end px-4 py-3">مدفوع</th>
              <th className="text-start px-4 py-3">الرمز</th><th className="text-start px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} onClick={() => setSelId(a.id)} className={`border-b border-zinc-800/60 cursor-pointer hover:bg-zinc-800/50 ${selId === a.id ? 'bg-zinc-800/60' : ''}`}>
                <td className="px-4 py-3"><div className="font-medium">{a.name}</div><div className="text-xs text-zinc-500">{a.email}</div></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${TIER_BADGE[a.tier]}`}>{TIER_LABEL[a.tier] ?? a.tier} · {a.ratePct}%</span></td>
                <td className="px-4 py-3 text-end">{a.activeRestaurants} / {a.referred}</td>
                <td className="px-4 py-3 text-end">{money(a.pending)}</td>
                <td className="px-4 py-3 text-end">{money(a.approved)}</td>
                <td className="px-4 py-3 text-end">{money(a.paid)}</td>
                <td className="px-4 py-3 font-mono text-xs">{a.referralCode}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[a.status] ?? 'bg-zinc-800'}`}>{statusLabel(a.status)}</span></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">لا توجد وكالات بعد.</td></tr>}
          </tbody>
        </table>
      </div>

      {selId && <AgencyDetail id={selId} header={header} onClose={() => setSelId(null)} onChanged={load} />}
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function AgencyDetail({ id, header, onClose, onChanged }: { id: string; header: () => Record<string, string>; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Dashboard | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [edit, setEdit] = useState({ status: 'ACTIVE', accountManager: '', coBrandName: '' })
  const [saved, setSaved] = useState(false)
  const [resetPw, setResetPw] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr('')
    try {
      const r = await fetch(`/api/superadmin/agencies/${id}`, { headers: header() })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setD(j)
      setEdit({ status: j.agency.status, accountManager: j.agency.accountManager ?? '', coBrandName: j.agency.coBrandName ?? '' })
    } catch (e) { setErr((e as Error).message) }
  }, [id, header])

  useEffect(() => { setD(null); setResetPw(null); load() }, [load])

  async function call(key: string, url: string, method: string, body?: unknown) {
    setBusy(key); setErr('')
    try {
      const r = await fetch(url, { method, headers: header(), body: body ? JSON.stringify(body) : undefined })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      return j
    } catch (e) { setErr((e as Error).message); return null } finally { setBusy(null) }
  }

  async function save() {
    const j = await call('save', `/api/superadmin/agencies/${id}`, 'PATCH', edit)
    if (j) { setSaved(true); setTimeout(() => setSaved(false), 1500); load(); onChanged() }
  }
  async function commission(cid: string, action: 'approve' | 'pay') {
    const j = await call(cid, `/api/superadmin/commissions/${cid}/${action}`, 'PATCH')
    if (j) { load(); onChanged() }
  }
  async function reset() {
    if (!confirm('إنشاء كلمة مرور مؤقتة جديدة؟ ستتوقف كلمة المرور الحالية عن العمل.')) return
    const j = await call('reset', `/api/superadmin/agencies/${id}/reset-password`, 'POST')
    if (j) setResetPw(j.temporaryPassword)
  }

  const cur = d?.totals.currency
  const idx = d ? TIERS.findIndex(t => t.tier === d.tier.tier) : 0
  const next = TIERS[idx + 1]
  const active = d?.tier.activeRestaurants ?? 0
  const pct = next ? Math.min(100, Math.round((active / next.min) * 100)) : 100

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold truncate">{d?.agency.name ?? 'جارٍ التحميل…'}</h2>
          {d && <p className="text-xs text-zinc-500 break-all">{d.agency.email}{d.agency.phone ? ` · ${d.agency.phone}` : ''}</p>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700"><X className="w-4 h-4" /></button>
      </div>

      {err && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-2">{err}</div>}
      {!d && !err && <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />}

      {d && (<>
        {resetPw && <SecretBox title="كلمة مرور مؤقتة جديدة" password={resetPw} onClose={() => setResetPw(null)} />}

        {/* Tier progress + totals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_BADGE[d.tier.tier]}`}>{TIER_LABEL[d.tier.tier] ?? d.tier.tier} · {d.tier.ratePct}%</span>
            <p className="text-sm mt-3">{active} مطعم نشط</p>
            <div className="h-2 bg-zinc-800 rounded-full mt-2 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${pct}%` }} /></div>
            <p className="text-xs text-zinc-400 mt-2">{next ? `باقي ${Math.max(0, next.min - active)} للوصول إلى المستوى ${TIER_LABEL[next.tier]} (${next.rate}%)` : 'تم بلوغ أعلى مستوى'}</p>
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([['هذا الشهر', d.totals.thisMonth], ['قيد الانتظار', d.totals.pending], ['معتمد', d.totals.approved], ['مدفوع', d.totals.paid], ['الإجمالي', d.totals.lifetime]] as [string, number][]).map(([l, v]) => (
              <div key={l} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                <p className="text-xs text-zinc-500">{l}</p><p className="font-semibold">{money(v, cur)}</p>
              </div>
            ))}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              <p className="text-xs text-zinc-500">رابط الإحالة</p>
              <div className="flex items-center gap-2"><code className="text-xs truncate flex-1">{d.agency.referralCode}</code><CopyBtn text={signupLink(d.agency.referralCode)} /></div>
            </div>
          </div>
        </div>

        {/* Edit */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <label className="text-xs text-zinc-400 space-y-1">الحالة
            <select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100">
              <option value="ACTIVE">نشط</option><option value="SUSPENDED">موقوف</option>
            </select>
          </label>
          <label className="text-xs text-zinc-400 space-y-1">مدير الحساب
            <input value={edit.accountManager} onChange={e => setEdit({ ...edit, accountManager: e.target.value })} placeholder="الاسم / الهاتف" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100" />
          </label>
          <label className="text-xs text-zinc-400 space-y-1">اسم العلامة المشتركة
            <input value={edit.coBrandName} onChange={e => setEdit({ ...edit, coBrandName: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100" />
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy === 'save'} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-center gap-1">
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}حفظ
            </button>
            <button onClick={reset} disabled={busy === 'reset'} title="إعادة تعيين كلمة المرور" className="bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3 py-2 text-sm flex items-center gap-1">
              <KeyRound className="w-4 h-4" />إعادة تعيين
            </button>
          </div>
        </div>

        {/* Restaurants */}
        <div>
          <h3 className="font-semibold mb-2">المطاعم ({d.restaurants.length})</h3>
          <div className="overflow-x-auto border border-zinc-800 rounded-xl">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs text-zinc-400 uppercase"><tr className="border-b border-zinc-800">
                <th className="text-start px-3 py-2">الاسم</th><th className="text-start px-3 py-2">الدولة</th><th className="text-start px-3 py-2">الحالة</th>
                <th className="text-end px-3 py-2">إجمالي المدفوع</th><th className="text-end px-3 py-2">العمولة</th><th className="text-start px-3 py-2">تاريخ الانضمام</th>
              </tr></thead>
              <tbody>
                {d.restaurants.map(r => (
                  <tr key={r.cafeId} className="border-b border-zinc-800/60">
                    <td className="px-3 py-2">{r.name}{r.freeMenuSetup && <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">إعداد قائمة مجاني</span>}</td>
                    <td className="px-3 py-2">{r.country ?? '—'}</td>
                    <td className="px-3 py-2">{statusLabel(r.status)}{!r.isActive && <span className="ms-1 text-xs text-red-400">(غير نشط)</span>}</td>
                    <td className="px-3 py-2 text-end">{money(r.totalPaid, cur)}</td>
                    <td className="px-3 py-2 text-end">{money(r.commission, cur)}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{new Date(r.joinedAt).toLocaleDateString('ar')}</td>
                  </tr>
                ))}
                {d.restaurants.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-500">لا توجد مطاعم مُحالة بعد.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Commissions */}
        <div>
          <h3 className="font-semibold mb-2">العمولات</h3>
          <div className="overflow-x-auto border border-zinc-800 rounded-xl">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-xs text-zinc-400 uppercase"><tr className="border-b border-zinc-800">
                <th className="text-start px-3 py-2">التاريخ</th><th className="text-start px-3 py-2">المطعم</th><th className="text-end px-3 py-2">المدفوع</th>
                <th className="text-start px-3 py-2">المستوى</th><th className="text-end px-3 py-2">العمولة</th><th className="text-start px-3 py-2">الحالة</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {d.commissions.map(c => (
                  <tr key={c.id} className="border-b border-zinc-800/60">
                    <td className="px-3 py-2 text-xs text-zinc-500">{new Date(c.createdAt).toLocaleDateString('ar')}</td>
                    <td className="px-3 py-2">{c.cafeName}</td>
                    <td className="px-3 py-2 text-end">{money(c.paidAmount, c.currency)}</td>
                    <td className="px-3 py-2 text-xs">{TIER_LABEL[c.tier as Tier] ?? c.tier} · {c.ratePct}%</td>
                    <td className="px-3 py-2 text-end font-semibold">{money(c.commissionAmount, c.currency)}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status] ?? 'bg-zinc-800'}`}>{statusLabel(c.status)}</span></td>
                    <td className="px-3 py-2 text-end">
                      {c.status === 'PENDING' && <button disabled={busy === c.id} onClick={() => commission(c.id, 'approve')} className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-2 py-1">اعتماد</button>}
                      {c.status === 'APPROVED' && <button disabled={busy === c.id} onClick={() => commission(c.id, 'pay')} className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded px-2 py-1">تحديد كمدفوع</button>}
                    </td>
                  </tr>
                ))}
                {d.commissions.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-500">لا توجد عمولات بعد.</td></tr>}
              </tbody>
            </table>
          </div>
          {d.commissions.length >= 100 && <p className="text-xs text-zinc-500 mt-1">يتم عرض آخر 100 عمولة.</p>}
        </div>
      </>)}
    </div>
  )
}
