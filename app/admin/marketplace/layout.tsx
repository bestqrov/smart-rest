'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Store, Package, Layers, ShoppingCart, Bell } from 'lucide-react'
import { useLang } from '../lang-context'

const NAV = [
  { href: '/admin/marketplace',              icon: Store,         label: { ar: 'الرئيسية', en: 'Home' },    exact: true },
  { href: '/admin/marketplace/catalog',      icon: Package,       label: { ar: 'الكتالوج', en: 'Catalog' },  exact: false },
  { href: '/admin/marketplace/bundles',      icon: Layers,        label: { ar: 'الباقات',  en: 'Bundles' },  exact: false },
  { href: '/admin/marketplace/orders',       icon: ShoppingCart,  label: { ar: 'طلباتي',   en: 'Orders' },   exact: false },
  { href: '/admin/marketplace/notifications',icon: Bell,          label: { ar: 'إشعارات',  en: 'Alerts' },   exact: false },
]

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { lang, isRTL } = useLang()
  const t = (a: string, e: string) => lang === 'en' ? e : a

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top sub-nav */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-20">
        <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-hide">
          {NAV.map(({ href, icon: Icon, label, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label[lang as 'ar' | 'en'] ?? label.ar}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  )
}
