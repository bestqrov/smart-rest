'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, UtensilsCrossed, QrCode, Share2,
  CreditCard, LogOut, ChevronRight, Menu, X
} from 'lucide-react'

const NAV = [
  { href: '/admin/dashboard', icon: LayoutDashboard, labelAr: 'لوحة التحكم',   labelFr: 'Dashboard' },
  { href: '/admin/menu',      icon: UtensilsCrossed,  labelAr: 'إدارة المنيو',   labelFr: 'Menu' },
  { href: '/admin/tables',    icon: QrCode,           labelAr: 'الطاولات & QR',  labelFr: 'Tables' },
  { href: '/admin/social',    icon: Share2,           labelAr: 'التسويق الذكي',  labelFr: 'Social' },
  { href: '/admin/billing',   icon: CreditCard,       labelAr: 'الفواتير',        labelFr: 'Billing' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen]   = useState(false)
  const [cafe, setCafe]   = useState<{ name: string; subdomain: string; billingStatus: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/admin/login'); return }
    fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setCafe({ name: d.businessName || d.name, subdomain: d.subdomain, billingStatus: d.billingStatus }))
      .catch(() => {})
  }, [router])

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
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">SM</span>
            </div>
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
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">SM</span>
          </div>
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
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">SM</span>
                </div>
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
    </div>
  )
}
