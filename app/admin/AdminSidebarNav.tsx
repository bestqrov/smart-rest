'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, UtensilsCrossed, QrCode, Share2, CreditCard, ChevronDown,
  Users, BarChart3, Sparkles, Settings, TrendingUp, Film,
  Package, Lock, LayoutGrid, Wrench, Receipt, ShoppingCart, CalendarDays, Radio, ShieldCheck,
  Store, ChevronRight, CalendarClock, Gift, Wallet,
} from 'lucide-react'
import type { AdminT } from '@/lib/adminI18n'

export type NavItem = { href: string; icon: any; key: keyof AdminT }

export type NavGroup = {
  group: 'overview' | 'menuOrdering' | 'team' | 'finance' | 'growth' | 'settingsGroup'
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  { group: 'overview', items: [
    { href: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  ]},
  { group: 'menuOrdering', items: [
    { href: '/admin/menu-gen',     icon: Sparkles,        key: 'menuAI'        },
    { href: '/admin/menu',         icon: UtensilsCrossed, key: 'menu'          },
    { href: '/admin/tables',       icon: QrCode,          key: 'tables'        },
    { href: '/admin/zones',        icon: LayoutGrid,      key: 'zones'         },
    { href: '/admin/reservations', icon: CalendarDays,    key: 'reservations'  },
  ]},
  { group: 'team', items: [
    { href: '/admin/staff',      icon: Users,         key: 'staff'      },
    { href: '/admin/control',    icon: Radio,         key: 'control'    },
    { href: '/admin/attendance', icon: CalendarClock, key: 'attendance' },
  ]},
  { group: 'finance', items: [
    { href: '/admin/financials',    icon: BarChart3,    key: 'financials'   },
    { href: '/admin/margins',       icon: TrendingUp,   key: 'margins'      },
    { href: '/admin/achats',        icon: Package,      key: 'achats'       },
    { href: '/admin/invoices',      icon: Receipt,      key: 'invoices'     },
    { href: '/admin/requisitions',  icon: ShoppingCart, key: 'requisitions' },
    { href: '/admin/equipment',     icon: Wrench,       key: 'equipment'    },
    { href: '/admin/billing',       icon: CreditCard,   key: 'billing'      },
    { href: '/admin/billing/subscription', icon: Wallet, key: 'subscription' },
  ]},
  { group: 'growth', items: [
    { href: '/admin/loyalty',       icon: Gift,        key: 'loyalty'       },
    { href: '/admin/certification', icon: ShieldCheck, key: 'certification' },
    { href: '/admin/marketing',     icon: Film,        key: 'marketing'     },
    { href: '/admin/social',        icon: Share2,      key: 'social'        },
  ]},
  { group: 'settingsGroup', items: [
    { href: '/admin/settings', icon: Settings, key: 'settings' },
  ]},
]

const GROUP_LABEL: Record<NavGroup['group'], Record<string, string>> = {
  overview:      { ar: 'نظرة عامة',       en: 'Overview',           fr: 'Aperçu',                 es: 'Resumen'        },
  menuOrdering:  { ar: 'المنيو والطلبات', en: 'Menu & Ordering',    fr: 'Menu & Commandes',       es: 'Menú y Pedidos' },
  team:          { ar: 'الفريق',          en: 'Team',               fr: 'Équipe',                 es: 'Equipo'         },
  finance:       { ar: 'المالية',         en: 'Finance',            fr: 'Finance',                es: 'Finanzas'       },
  growth:        { ar: 'النمو والتسويق',  en: 'Growth & Marketing', fr: 'Croissance & Marketing', es: 'Crecimiento'    },
  settingsGroup: { ar: 'الإعدادات',       en: 'Settings',           fr: 'Paramètres',             es: 'Ajustes'        },
}

function groupOf(pathname: string): NavGroup['group'] {
  for (const g of NAV_GROUPS) {
    if (g.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))) return g.group
  }
  if (pathname.startsWith('/admin/marketplace')) return 'growth'
  if (pathname.startsWith('/admin/inventory'))   return 'settingsGroup'
  return 'overview'
}

export default function AdminSidebarNav({
  pathname, lang, isRTL, t, marketplaceEnabled, cafeInventoryEnabled, onNavigate,
  itemClassName = 'px-3 py-2.5 rounded-lg text-sm',
}: {
  pathname: string
  lang: string
  isRTL: boolean
  // Accepts any of the 4 language tables (their values differ, keys match).
  t: Record<keyof AdminT, string>
  marketplaceEnabled: boolean
  cafeInventoryEnabled: boolean | null
  onNavigate?: () => void
  itemClassName?: string
}) {
  const [expanded, setExpanded] = useState<NavGroup['group'] | null>(() => groupOf(pathname))

  useEffect(() => { setExpanded(groupOf(pathname)) }, [pathname])

  function linkClass(active: boolean) {
    return `flex items-center gap-3 ${itemClassName} transition-colors group ${
      active ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-[#243460] hover:text-white'
    }`
  }

  return (
    <>
      {NAV_GROUPS.map(g => {
        const isOpen = expanded === g.group
        const label = GROUP_LABEL[g.group][lang] ?? GROUP_LABEL[g.group].en
        // Single-item groups render their item directly — no accordion header.
        const isSingleItem = g.group === 'overview' || g.group === 'settingsGroup'

        return (
          <div key={g.group} className="mb-1">
            {!isSingleItem && (
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : g.group)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 hover:text-gray-200"
              >
                <span>{label}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-0' : (isRTL ? 'rotate-90' : '-rotate-90')}`} />
              </button>
            )}
            {isSingleItem ? g.items.map(item => (
              <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(pathname === item.href || pathname.startsWith(item.href + '/'))}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="font-medium flex-1">{t[item.key]}</span>
              </Link>
            )) : (
              <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  {g.items.map(item => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(active)}>
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="font-medium flex-1">{t[item.key]}</span>
                        {item.href === '/admin/marketing' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                            <Sparkles className="w-2.5 h-2.5" />
                            PRO
                          </span>
                        )}
                        {active && <ChevronRight className={`w-4 h-4 opacity-70 ${!isRTL ? 'rotate-180' : ''}`} />}
                      </Link>
                    )
                  })}
                  {g.group === 'growth' && marketplaceEnabled && (
                    <Link href="/admin/marketplace" onClick={onNavigate}
                      className={linkClass(pathname.startsWith('/admin/marketplace'))}>
                      <Store className="w-5 h-5 shrink-0" />
                      <span className="font-medium flex-1">{lang === 'ar' ? 'المتجر' : 'Marketplace'}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">AI</span>
                    </Link>
                  )}
                  {g.group === 'settingsGroup' && cafeInventoryEnabled !== null && (
                    <Link href="/admin/inventory" onClick={onNavigate}
                      className={linkClass(pathname.startsWith('/admin/inventory')) + ' relative'}>
                      <Package className="w-5 h-5 shrink-0" />
                      <span className="font-medium flex-1">
                        {lang === 'ar' ? 'المخزون' : lang === 'fr' ? 'Inventaire' : 'Inventory'}
                      </span>
                      {!cafeInventoryEnabled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Lock className="w-2.5 h-2.5" />
                          PRO
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
