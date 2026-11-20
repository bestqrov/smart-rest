'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Copy, Check, Lock, Unlock, LogOut, MessageCircle, Languages, UserRound, KeyRound } from 'lucide-react'

// ─── i18n ─────────────────────────────────────────────────────────────────────

type Lang = 'ar' | 'en'

const T = {
  ar: {
    portal: 'بوابة الشركاء',
    loginTitle: 'تسجيل دخول الوكالة',
    loginSub: 'ادخل ببيانات الحساب التي أرسلناها لك.',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    login: 'دخول',
    badCreds: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    genericError: 'حدث خطأ، حاول مرة أخرى',
    logout: 'تسجيل الخروج',
    currentTier: 'مستواك الحالي',
    commission: 'عمولة متكررة',
    activeRestaurants: 'مطاعم نشطة',
    toNext: 'باقي {n} مطاعم نشطة للوصول إلى {tier} ← {rate}%',
    topTier: 'وصلت إلى أعلى مستوى 🎉',
    perks: 'المزايا',
    perkDiscount: 'خصم 15٪ على رسوم المنصة لعملائك',
    perkMenu: 'إعداد المنيو مجاناً لـ 3 مطاعم',
    perkManager: 'مدير حساب مخصّص',
    perkCobrand: 'علامة تجارية مشتركة',
    unlocksAt: 'يُفتح في {tier}',
    accountManager: 'مدير حسابك',
    referralLink: 'رابط الإحالة الخاص بك',
    referralHint: 'أي مطعم يسجّل عبر هذا الرابط يُحتسب لك.',
    copy: 'نسخ',
    copied: 'تم النسخ',
    shareWhatsapp: 'مشاركة عبر واتساب',
    shareText: 'سجّل مطعمك في SmartRestau عبر هذا الرابط واحصل على خصم 15٪ على رسوم المنصة: ',
    thisMonth: 'هذا الشهر',
    pending: 'قيد المراجعة',
    approved: 'معتمدة',
    paid: 'مدفوعة',
    lifetime: 'الإجمالي',
    last6: 'العمولات في آخر 6 أشهر',
    restaurants: 'المطاعم',
    name: 'الاسم',
    status: 'الحالة',
    signedUp: 'مسجّل',
    paying: 'يدفع',
    rejected: 'مرفوض',
    freeSetup: 'إعداد منيو مجاني',
    totalPaid: 'إجمالي المدفوع',
    yourCommission: 'عمولتك',
    commissions: 'العمولات',
    date: 'التاريخ',
    restaurant: 'المطعم',
    amountPaid: 'المبلغ المدفوع',
    rate: 'النسبة',
    noRestaurants: 'لا توجد مطاعم بعد — شارك رابطك للبدء.',
    noCommissions: 'لا توجد عمولات بعد.',
    changePassword: 'تغيير كلمة المرور',
    currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة (8 أحرف على الأقل)',
    save: 'حفظ',
    pwChanged: 'تم تغيير كلمة المرور',
    pwBad: 'كلمة المرور الحالية غير صحيحة',
    pwWeak: 'يجب أن تكون كلمة المرور الجديدة 8 أحرف على الأقل',
    paidMonthly: 'تُدفع العمولة شهرياً على ما يدفعه كل مطعم فعلياً، طوال مدة استمراره في الدفع.',
    statusPENDING: 'قيد المراجعة',
    statusAPPROVED: 'معتمدة',
    statusPAID: 'مدفوعة',
    SILVER: 'فضي',
    GOLD: 'ذهبي',
    PLATINUM: 'بلاتيني',
  },
  en: {
    portal: 'Partner portal',
    loginTitle: 'Agency login',
    loginSub: 'Sign in with the account details we sent you.',
    email: 'Email',
    password: 'Password',
    login: 'Sign in',
    badCreds: 'Incorrect email or password',
    genericError: 'Something went wrong, please try again',
    logout: 'Log out',
    currentTier: 'Your current tier',
    commission: 'recurring commission',
    activeRestaurants: 'active restaurants',
    toNext: '{n} more active restaurants to reach {tier} → {rate}%',
    topTier: 'You have reached the top tier 🎉',
    perks: 'Perks',
    perkDiscount: '15% off platform fees for your clients',
    perkMenu: 'Free menu setup for 3 restaurants',
    perkManager: 'Dedicated account manager',
    perkCobrand: 'Co-branding',
    unlocksAt: 'Unlocks at {tier}',
    accountManager: 'Your account manager',
    referralLink: 'Your referral link',
    referralHint: 'Every restaurant that signs up through this link is credited to you.',
    copy: 'Copy',
    copied: 'Copied',
    shareWhatsapp: 'Share on WhatsApp',
    shareText: 'Sign up your restaurant on SmartRestau with this link and get 15% off platform fees: ',
    thisMonth: 'This month',
    pending: 'Pending',
    approved: 'Approved',
    paid: 'Paid',
    lifetime: 'Lifetime',
    last6: 'Commission over the last 6 months',
    restaurants: 'Restaurants',
    name: 'Name',
    status: 'Status',
    signedUp: 'Signed up',
    paying: 'Paying',
    rejected: 'Rejected',
    freeSetup: 'Free menu setup',
    totalPaid: 'Total paid',
    yourCommission: 'Your commission',
    commissions: 'Commissions',
    date: 'Date',
    restaurant: 'Restaurant',
    amountPaid: 'Amount paid',
    rate: 'Rate',
    noRestaurants: 'No restaurants yet — share your link to get started.',
    noCommissions: 'No commissions yet.',
    changePassword: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password (at least 8 characters)',
    save: 'Save',
    pwChanged: 'Password changed',
    pwBad: 'Current password is incorrect',
    pwWeak: 'New password must be at least 8 characters',
    paidMonthly: 'Commission is paid monthly on what each restaurant actually pays, for as long as it keeps paying.',
    statusPENDING: 'Pending',
    statusAPPROVED: 'Approved',
    statusPAID: 'Paid',
    SILVER: 'Silver',
    GOLD: 'Gold',
    PLATINUM: 'Platinum',
  },
} satisfies Record<Lang, Record<string, string>>

type Key = keyof typeof T.en

// ─── Types (mirror AgencyService.getAgencyDashboard) ──────────────────────────

type Tier = 'SILVER' | 'GOLD' | 'PLATINUM'
interface Dashboard {
  agency: { name: string; email: string; referralCode: string; accountManager: string | null; coBrandName: string | null }
  tier: {
    tier: Tier; ratePct: number; activeRestaurants: number
    perks: { clientDiscount: boolean; freeMenuSetup: boolean; accountManager: boolean; coBranding: boolean }
    next: { tier: Tier; ratePct: number; restaurantsNeeded: number } | null
  }
  totals: { referred: number; thisMonth: number; pending: number; approved: number; paid: number; lifetime: number; currency: string | null }
  months: { month: string; amount: number }[]
  restaurants: { cafeId: string; name: string; status: string; freeMenuSetup: boolean; totalPaid: number; commission: number }[]
  commissions: { id: string; cafeName: string; paidAmount: number; currency: string; ratePct: number; commissionAmount: number; status: string; createdAt: string }[]
}

const TIER_STYLE: Record<Tier, string> = {
  SILVER: 'from-slate-500 to-slate-700',
  GOLD: 'from-amber-500 to-amber-700',
  PLATINUM: 'from-indigo-500 to-violet-700',
}

const TOKEN_KEY = 'partnerToken'
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}

function fmt(n: number, lang: Lang, cur?: string | null) {
  const s = (n ?? 0).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 })
  return cur ? `${s} ${cur}` : s
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartnersPage() {
  const [lang, setLang] = useState<Lang>('ar')
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const t = (k: Key, vars?: Record<string, string | number>) =>
    Object.entries(vars ?? {}).reduce<string>((s, [a, b]) => s.replace(`{${a}}`, String(b)), T[lang][k])

  useEffect(() => {
    setToken(store.get(TOKEN_KEY))
    const l = store.get('partnerLang')
    if (l === 'ar' || l === 'en') setLang(l)
    setReady(true)
  }, [])

  function toggleLang() {
    const l: Lang = lang === 'ar' ? 'en' : 'ar'
    setLang(l); store.set('partnerLang', l)
  }
  const logout = useCallback(() => { store.del(TOKEN_KEY); setToken(null) }, [])

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <span className="font-bold truncate">SmartRestau · {t('portal')}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={toggleLang} className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
              <Languages className="w-4 h-4" />{lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            {token && (
              <button onClick={logout} className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
                <LogOut className="w-4 h-4" /><span className="hidden sm:inline">{t('logout')}</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {!ready ? null : token
          ? <DashboardView token={token} lang={lang} t={t} onUnauthorized={logout} />
          : <LoginForm t={t} onToken={tk => { store.set(TOKEN_KEY, tk); setToken(tk) }} />}
      </main>
    </div>
  )
}

type TFn = (k: Key, vars?: Record<string, string | number>) => string

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginForm({ t, onToken }: { t: TFn; onToken: (tk: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/partners/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.token) onToken(d.token)
      else setErr(r.status === 401 ? t('badCreds') : (d.error || t('genericError')))
    } catch { setErr(t('genericError')) } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-10 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
      <div>
        <h1 className="text-xl font-bold">{t('loginTitle')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('loginSub')}</p>
      </div>
      <label className="block text-sm space-y-1">
        <span className="text-slate-600">{t('email')}</span>
        <input type="email" dir="ltr" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </label>
      <label className="block text-sm space-y-1">
        <span className="text-slate-600">{t('password')}</span>
        <input type="password" dir="ltr" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}{t('login')}
      </button>
    </form>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ token, lang, t, onUnauthorized }: { token: string; lang: Lang; t: TFn; onUnauthorized: () => void }) {
  const [d, setD] = useState<Dashboard | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    try {
      const r = await fetch('/api/partners/me', { headers: { Authorization: `Bearer ${token}` } })
      if (r.status === 401) { onUnauthorized(); return }
      if (!r.ok) throw new Error()
      setD(await r.json())
    } catch { setErr('x') }
  }, [token, onUnauthorized])

  useEffect(() => { load() }, [load])

  if (err) return <p className="text-center text-red-600 mt-10">{t('genericError')}</p>
  if (!d) return <div className="flex justify-center mt-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>

  const cur = d.totals.currency
  const link = `${window.location.origin}/signup?ref=${d.agency.referralCode}`
  const tierName = (x: Tier) => t(x)
  const nextMin = d.tier.next ? d.tier.activeRestaurants + d.tier.next.restaurantsNeeded : 0
  const pct = d.tier.next && nextMin > 0 ? Math.min(100, Math.round((d.tier.activeRestaurants / nextMin) * 100)) : 100
  const perks: { key: Key; on: boolean; at: Tier }[] = [
    { key: 'perkDiscount', on: d.tier.perks.clientDiscount, at: 'SILVER' },
    { key: 'perkMenu', on: d.tier.perks.freeMenuSetup, at: 'GOLD' },
    { key: 'perkManager', on: d.tier.perks.accountManager, at: 'PLATINUM' },
    { key: 'perkCobrand', on: d.tier.perks.coBranding, at: 'PLATINUM' },
  ]
  const maxMonth = Math.max(1, ...d.months.map(m => m.amount))
  const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { month: 'short' })

  function copy() {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold break-words">{d.agency.coBrandName || d.agency.name}</h1>

      {/* Tier + perks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${TIER_STYLE[d.tier.tier]}`}>
          <p className="text-white/80 text-sm">{t('currentTier')}</p>
          <div className="flex items-end justify-between gap-3 mt-1">
            <h2 className="text-2xl font-extrabold">{tierName(d.tier.tier)}</h2>
            <div className="text-end"><div className="text-3xl font-extrabold">{d.tier.ratePct}%</div><div className="text-xs text-white/80">{t('commission')}</div></div>
          </div>
          <p className="text-sm mt-3">{d.tier.activeRestaurants} {t('activeRestaurants')}</p>
          <div className="h-2 bg-white/25 rounded-full mt-2 overflow-hidden"><div className="h-full bg-white" style={{ width: `${pct}%` }} /></div>
          <p className="text-xs text-white/90 mt-2">
            {d.tier.next ? t('toNext', { n: d.tier.next.restaurantsNeeded, tier: tierName(d.tier.next.tier), rate: d.tier.next.ratePct }) : t('topTier')}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">{t('perks')}</h3>
          <ul className="space-y-2">
            {perks.map(p => (
              <li key={p.key} className={`flex items-start gap-2 text-sm ${p.on ? 'text-slate-800' : 'text-slate-400'}`}>
                {p.on ? <Unlock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <Lock className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{t(p.key)}{!p.on && <span className="text-xs"> · {t('unlocksAt', { tier: tierName(p.at) })}</span>}</span>
              </li>
            ))}
          </ul>
          {d.agency.accountManager && (
            <div className="mt-4 flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
              <UserRound className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-slate-500">{t('accountManager')}:</span><span className="font-medium break-all">{d.agency.accountManager}</span>
            </div>
          )}
        </div>
      </div>

      {/* Referral link */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-semibold">{t('referralLink')}</h3>
        <p className="text-xs text-slate-500 mt-1">{t('referralHint')}</p>
        <div className="mt-3 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <code dir="ltr" className="flex-1 min-w-0 text-xs sm:text-sm break-all">{link}</code>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={copy} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? t('copied') : t('copy')}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(t('shareText') + link)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            <MessageCircle className="w-4 h-4" />{t('shareWhatsapp')}
          </a>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([['thisMonth', d.totals.thisMonth], ['pending', d.totals.pending], ['approved', d.totals.approved], ['paid', d.totals.paid], ['lifetime', d.totals.lifetime]] as [Key, number][]).map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-xl p-3 min-w-0">
            <p className="text-xs text-slate-500">{t(k)}</p>
            <p className="font-bold text-sm sm:text-base break-words">{fmt(v, lang, cur)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">{t('paidMonthly')}</p>

      {/* 6-month chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-semibold mb-4">{t('last6')}</h3>
        <div className="flex items-end gap-2 h-40" dir="ltr">
          {d.months.map(m => (
            <div key={m.month} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1">
              <span className="text-[10px] text-slate-500 truncate max-w-full">{m.amount ? fmt(m.amount, lang) : ''}</span>
              <div className="w-full max-w-[40px] bg-blue-500 rounded-t" style={{ height: `${Math.max(2, (m.amount / maxMonth) * 100)}%`, opacity: m.amount ? 1 : 0.25 }} />
              <span className="text-[11px] text-slate-500">{monthLabel(m.month)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Restaurants */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-semibold mb-3">{t('restaurants')} ({d.restaurants.length})</h3>
        {d.restaurants.length === 0 ? <p className="text-sm text-slate-500">{t('noRestaurants')}</p> : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="text-xs text-slate-500"><tr className="border-b border-slate-200">
                <th className="text-start py-2 pe-3">{t('name')}</th><th className="text-start py-2 pe-3">{t('status')}</th>
                <th className="text-end py-2 pe-3">{t('totalPaid')}</th><th className="text-end py-2">{t('yourCommission')}</th>
              </tr></thead>
              <tbody>
                {d.restaurants.map(r => (
                  <tr key={r.cafeId} className="border-b border-slate-100">
                    <td className="py-2 pe-3">
                      {r.name}
                      {r.freeMenuSetup && <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 whitespace-nowrap">{t('freeSetup')}</span>}
                    </td>
                    <td className="py-2 pe-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-700' : r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {r.status === 'CONVERTED' ? t('paying') : r.status === 'REJECTED' ? t('rejected') : t('signedUp')}
                      </span>
                    </td>
                    <td className="py-2 pe-3 text-end whitespace-nowrap">{fmt(r.totalPaid, lang, cur)}</td>
                    <td className="py-2 text-end whitespace-nowrap font-semibold">{fmt(r.commission, lang, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commissions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-semibold mb-3">{t('commissions')}</h3>
        {d.commissions.length === 0 ? <p className="text-sm text-slate-500">{t('noCommissions')}</p> : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-xs text-slate-500"><tr className="border-b border-slate-200">
                <th className="text-start py-2 pe-3">{t('date')}</th><th className="text-start py-2 pe-3">{t('restaurant')}</th>
                <th className="text-end py-2 pe-3">{t('amountPaid')}</th><th className="text-end py-2 pe-3">{t('rate')}</th>
                <th className="text-end py-2 pe-3">{t('yourCommission')}</th><th className="text-start py-2">{t('status')}</th>
              </tr></thead>
              <tbody>
                {d.commissions.map(c => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2 pe-3 whitespace-nowrap text-slate-500">{new Date(c.createdAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en')}</td>
                    <td className="py-2 pe-3">{c.cafeName}</td>
                    <td className="py-2 pe-3 text-end whitespace-nowrap">{fmt(c.paidAmount, lang, c.currency)}</td>
                    <td className="py-2 pe-3 text-end">{c.ratePct}%</td>
                    <td className="py-2 pe-3 text-end whitespace-nowrap font-semibold">{fmt(c.commissionAmount, lang, c.currency)}</td>
                    <td className="py-2 whitespace-nowrap">
                      {c.status === 'PENDING' ? t('statusPENDING') : c.status === 'APPROVED' ? t('statusAPPROVED') : c.status === 'PAID' ? t('statusPAID') : c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ChangePassword token={token} t={t} onUnauthorized={onUnauthorized} />
    </div>
  )
}

// ─── Change password ──────────────────────────────────────────────────────────

function ChangePassword({ token, t, onUnauthorized }: { token: string; t: TFn; onUnauthorized: () => void }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) { setMsg({ ok: false, text: t('pwWeak') }); return }
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/partners/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      })
      if (r.status === 401) { onUnauthorized(); return }
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setMsg({ ok: true, text: t('pwChanged') }); setCur(''); setNext('') }
      else setMsg({ ok: false, text: d.code === 'BAD_PASSWORD' ? t('pwBad') : d.code === 'WEAK_PASSWORD' ? t('pwWeak') : t('genericError') })
    } catch { setMsg({ ok: false, text: t('genericError') }) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" />{t('changePassword')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input type="password" dir="ltr" required placeholder={t('currentPassword')} value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input type="password" dir="ltr" required minLength={8} placeholder={t('newPassword')} value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button disabled={busy} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('save')}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
    </form>
  )
}
