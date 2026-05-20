'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, UtensilsCrossed, QrCode, Share2,
  CreditCard, LogOut, ChevronRight, Menu, X,
  AlertTriangle, Loader2, Gift, Zap, ChefHat, Bell
} from 'lucide-react'

const NAV = [
  { href: '/admin/dashboard', icon: LayoutDashboard, labelAr: 'لوحة التحكم',   labelFr: 'Dashboard' },
  { href: '/admin/menu',      icon: UtensilsCrossed,  labelAr: 'إدارة المنيو',   labelFr: 'Menu' },
  { href: '/admin/tables',    icon: QrCode,           labelAr: 'الطاولات & QR',  labelFr: 'Tables' },
  { href: '/admin/social',    icon: Share2,           labelAr: 'التسويق الذكي',  labelFr: 'Social' },
  { href: '/admin/billing',   icon: CreditCard,       labelAr: 'الفواتير',        labelFr: 'Billing' },
]

const STAFF_LINKS = [
  { href: '/kitchen', icon: ChefHat, labelAr: 'شاشة المطبخ', labelFr: 'Kitchen KDS' },
  { href: '/waiter',  icon: Bell,    labelAr: 'شاشة النادل',  labelFr: 'Waiter View' },
]

type CafeState = {
  name: string; subdomain: string; billingStatus: string
  inTrial: boolean; trialEndsAt: string | null; hasExtendedTrial: boolean
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen]   = useState(false)
  const [cafe, setCafe]   = useState<CafeState | null>(null)
  const [gateAction, setGateAction] = useState<string | null>(null)

  function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

  async function loadCafe() {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    const [profile, finance] = await Promise.all([
      fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/finance/status',     { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ])
    if (profile) {
      setCafe({
        name: profile.businessName || profile.name,
        subdomain: profile.subdomain,
        billingStatus: profile.billingStatus,
        inTrial: finance?.inTrial ?? false,
        trialEndsAt: finance?.trialEndsAt ?? null,
        hasExtendedTrial: profile.hasExtendedTrial ?? false
      })
    }
  }

  useEffect(() => { loadCafe() }, [router])

  async function doGateAction(endpoint: string) {
    setGateAction(endpoint)
    await fetch(`/api/finance/${endpoint}`, { method: 'POST', headers: authHeader() })
    setGateAction(null)
    await loadCafe()
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('cafeId')
    router.push('/landing')
  }

  const billingBadge: Record<string, string> = {
    GRACE_PERIOD:    'bg-amber-100 text-amber-700',
    COLLECTING_DEBT: 'bg-blue-100  text-blue-700',
    SUSPENDED:       'bg-red-100   text-red-700'
  }
  const billingLabel: Record<string, string> = {
    GRACE_PERIOD:    'تجريبي',
    COLLECTING_DEBT: 'نشط',
    SUSPENDED:       'موقوف'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">

      {/* ── Sidebar (desktop) ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 min-h-screen shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <Image src="/assets/logo.png" alt="Smart Menu" width={36} height={36} className="rounded-lg shrink-0" />
            <div>
              <div className="text-white font-bold text-sm">SmartMenu</div>
              {cafe && <div className="text-gray-400 text-xs truncate">{cafe.subdomain}.smartmenu.ma</div>}
            </div>
          </Link>
        </div>

        {/* Billing status chip */}
        {cafe && (
          <div className="px-5 py-3 border-b border-gray-800">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${billingBadge[cafe.billingStatus] || 'bg-gray-700 text-gray-300'}`}>
              {billingLabel[cafe.billingStatus] || cafe.billingStatus}
            </span>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.labelAr}</span>
                  <span className="text-xs opacity-60">{item.labelFr}</span>
                </div>
                {active && <ChevronRight className="w-4 h-4 mr-auto opacity-70" />}
              </Link>
            )
          })}
        </nav>

        {/* Staff screens */}
        <div className="px-3 pb-3 border-t border-gray-800 pt-3">
          <p className="text-xs text-gray-600 uppercase tracking-widest px-2 mb-2">Staff Screens</p>
          {STAFF_LINKS.map(item => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors group mb-1"
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-medium">{item.labelAr}</span>
                <span className="text-xs opacity-50">{item.labelFr}</span>
              </div>
              <span className="text-gray-700 text-xs mr-auto group-hover:text-gray-500">↗</span>
            </a>
          ))}
        </div>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-gray-900 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setOpen(true)} className="text-gray-300 p-1">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Image src="/assets/logo.png" alt="Smart Menu" width={28} height={28} className="rounded-lg" />
          <span className="text-white font-bold text-sm">SmartMenu</span>
        </div>
        <div className="w-8" /> {/* spacer */}
      </div>

      {/* ── Mobile slide-over drawer ──────────────────────────────── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative bg-gray-900 w-72 h-full flex flex-col" dir="rtl">
            <div className="px-4 py-4 flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Image src="/assets/logo.png" alt="Smart Menu" width={32} height={32} className="rounded-lg" />
                <span className="text-white font-bold">SmartMenu</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {cafe && (
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-gray-400 text-xs truncate">{cafe.subdomain}.smartmenu.ma</p>
                <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${billingBadge[cafe.billingStatus] || ''}`}>
                  {billingLabel[cafe.billingStatus] || cafe.billingStatus}
                </span>
              </div>
            )}

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl ${
                      active ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.labelAr}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="px-3 py-4 border-t border-gray-800">
              <button
                onClick={logout}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-red-400"
              >
                <LogOut className="w-5 h-5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="flex-1 md:overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>

      {/* ── Billing lock gate ─────────────────────────────────────── */}
      {cafe && pathname !== '/admin/billing' && <BillingGate cafe={cafe} doAction={doGateAction} actionInFlight={gateAction} />}
    </div>
  )
}

// ─── Billing Gate Overlay ─────────────────────────────────────────────────────

function BillingGate({ cafe, doAction, actionInFlight }: {
  cafe: CafeState
  doAction: (endpoint: string) => Promise<void>
  actionInFlight: string | null
}) {
  const trialJustExpired = !cafe.inTrial && cafe.billingStatus === 'GRACE_PERIOD'
  const suspended        = cafe.billingStatus === 'SUSPENDED'

  if (!trialJustExpired && !suspended) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">
            {suspended ? 'حسابك موقوف' : 'انتهت فترتك التجريبية'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {suspended
              ? 'رصيدك سالب ولم يُسدَّد. اختر أحد الخيارين لاستعادة الخدمة.'
              : 'أسبوع التجربة المجاني انتهى. اختر كيف تريد الاستمرار.'}
          </p>
        </div>

        {/* Route A — Accept AI commission */}
        <div className="border border-emerald-200 rounded-2xl p-4 bg-emerald-50">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-emerald-900">المسار أ — الباقة الذكية (مجانية)</span>
          </div>
          <p className="text-xs text-emerald-700 mb-3 leading-relaxed">
            نظام عمولة ذكي: تدفع رسوم رمزية فقط على كل طلب مكتمل. لا اشتراك شهري.
            الرسوم تُحسب تلقائياً وتُسوَّى كل إثنين.
          </p>
          <button
            onClick={() => doAction('accept-ai-package')}
            disabled={!!actionInFlight}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {actionInFlight === 'accept-ai-package'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />}
            تفعيل الباقة الذكية
          </button>
        </div>

        {/* Route B — $5 extension (only if not already used) */}
        {!cafe.hasExtendedTrial && (
          <div className="border border-violet-200 rounded-2xl p-4 bg-violet-50">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-5 h-5 text-violet-600" />
              <span className="font-bold text-violet-900">المسار ب — تمديد 7 أيام مجانية ($5)</span>
            </div>
            <p className="text-xs text-violet-700 mb-3 leading-relaxed">
              ادفع 5 دولار مرة واحدة واستمتع بـ 7 أيام إضافية مجانية 100% بدون أي عمولات.
              هذا الخيار متاح مرة واحدة فقط.
            </p>
            <button
              onClick={() => doAction('extend-trial')}
              disabled={!!actionInFlight}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {actionInFlight === 'extend-trial'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Gift className="w-4 h-4" />}
              تمديد مقابل $5
            </button>
          </div>
        )}

        {/* Link to billing page for settle-debt */}
        {suspended && (
          <p className="text-center text-xs text-gray-400">
            إذا سددت الدين بالفعل،{' '}
            <a href="/admin/billing" className="text-emerald-600 underline font-medium">اذهب لصفحة الفواتير</a>
            {' '}لتأكيد التسوية.
          </p>
        )}
      </div>
    </div>
  )
}
