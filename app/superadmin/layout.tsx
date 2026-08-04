'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Store, CreditCard,
  Brain, ShieldCheck, LogOut,
  ChevronDown, ChevronLeft, ChevronRight, Menu, X, KeyRound, HeartPulse,
  ShoppingBag, Tag, Package, Truck, ClipboardList, Warehouse, Contact,
} from 'lucide-react'
import { SAAuthProvider, useSAAuth } from './context'

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV = [
  {
    items: [
      { href: '/superadmin',             icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    section: 'Business',
    items: [
      { href: '/superadmin/restaurants', icon: Store,      label: 'Restaurants' },
      { href: '/superadmin/billing',     icon: CreditCard, label: 'Billing' },
    ],
  },
  {
    section: 'Artificial Intelligence',
    items: [
      { href: '/superadmin/ai-center',   icon: Brain,      label: 'AI Center' },
    ],
  },
  {
    section: 'Trust',
    items: [
      { href: '/superadmin/certification', icon: ShieldCheck, label: 'Certification' },
    ],
  },
  {
    section: 'Marketplace',
    items: [
      { href: '/superadmin/marketplace',            icon: ShoppingBag,   label: 'Dashboard' },
      { href: '/superadmin/marketplace/categories', icon: Tag,           label: 'Categories' },
      { href: '/superadmin/marketplace/products',   icon: Package,       label: 'Products' },
      { href: '/superadmin/marketplace/suppliers',  icon: Truck,         label: 'Suppliers' },
      { href: '/superadmin/marketplace/orders',     icon: ClipboardList, label: 'Orders' },
      { href: '/superadmin/marketplace/inventory',  icon: Warehouse,     label: 'Inventory' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/superadmin/ops', icon: HeartPulse, label: 'Operations' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { href: '/superadmin/client',      icon: Contact,     label: 'Clients' },
      { href: '/superadmin/credentials', icon: KeyRound,   label: 'Credentials' },
    ],
  },
]

// ─── Login Wall ───────────────────────────────────────────────────────────────

function LoginWall() {
  const { login } = useSAAuth()
  const [email,   setEmail]   = useState('')
  const [secret,  setSecret]  = useState('')
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  async function handleLogin() {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/superadmin/overview', {
        headers: { 'x-superadmin-secret': secret, 'x-superadmin-email': email },
      })
      if (res.ok) { login(email, secret) }
      else setErr('Invalid credentials')
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-black text-white text-lg">SmartRestau</p>
            <p className="text-xs text-zinc-500">SuperAdmin Platform</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h1 className="font-bold text-white text-lg">Sign in</h1>

          <input
            type="email" placeholder="admin@smartrestau.com"
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
          />
          <input
            type="password" placeholder="Secret key"
            value={secret} onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
          />

          {err && <p className="text-red-400 text-xs">{err}</p>}

          <button
            onClick={handleLogin} disabled={loading || !email || !secret}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-all"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

// Routes whose own page already renders a second in-page sidebar (e.g. the
// restaurants dashboard) — entering them auto-collapses this global sidebar
// to a slim rail so the two don't fight for width. The user can still
// re-expand it manually via the toggle next to the logo.
const AUTO_COLLAPSE_ROUTES = ['/superadmin/restaurants']

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { email, logout } = useSAAuth()
  const [collapsed, setCollapsed] = useState(() => AUTO_COLLAPSE_ROUTES.some(r => pathname.startsWith(r)))
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (prevPathname.current === pathname) return
    const entering = AUTO_COLLAPSE_ROUTES.some(r => pathname.startsWith(r))
    const wasIn    = AUTO_COLLAPSE_ROUTES.some(r => prevPathname.current.startsWith(r))
    if (entering && !wasIn) setCollapsed(true)
    if (!entering && wasIn) setCollapsed(false)
    prevPathname.current = pathname
  }, [pathname])

  const isActive = (href: string) =>
    href === '/superadmin' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-full ${collapsed ? 'w-16' : 'w-60'} bg-zinc-900 border-r border-zinc-800
        flex flex-col transition-all duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:relative lg:z-auto
      `}>
        {/* Logo + collapse toggle */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-black text-white text-sm truncate">SmartRestau</p>
              <p className="text-[10px] text-zinc-500">Enterprise OS</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expand' : 'Collapse'}
            className="ml-auto hidden lg:flex w-6 h-6 rounded-md text-zinc-600 hover:text-white hover:bg-zinc-800 items-center justify-center transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className={`text-zinc-600 hover:text-white lg:hidden ${collapsed ? 'ml-auto' : ''}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((group, gi) => (
            <div key={gi}>
              {group.section && !collapsed && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  {group.section}
                </p>
              )}
              {group.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={item.label}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''} ${
                    isActive(item.href)
                      ? 'bg-purple-600/20 text-purple-300'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className={`border-t border-zinc-800 px-4 py-3 flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-purple-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {email?.[0]?.toUpperCase() ?? 'S'}
          </div>
          {!collapsed && <p className="text-xs text-zinc-400 truncate flex-1">{email}</p>}
          {!collapsed && (
            <button onClick={logout} className="text-zinc-600 hover:text-red-400 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }) {
  const { authed } = useSAAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!authed) return <LoginWall />

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <button onClick={() => setSidebarOpen(true)} className="text-zinc-400">
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-bold text-white text-sm">SmartRestau OS</p>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <SAAuthProvider>
      <Shell>{children}</Shell>
    </SAAuthProvider>
  )
}
