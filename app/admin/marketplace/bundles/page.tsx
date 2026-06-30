'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Layers, Package, RefreshCw, ShoppingCart, Tag, ChevronRight } from 'lucide-react'
import { useLang } from '../../lang-context'

interface Bundle {
  id: string; name: string; slug: string; description: string; type: string
  bundlePrice: number; currency: string; savings: number
  productIds: string[]; active: boolean
}

const T = {
  ar: {
    title: 'الباقات الجاهزة', subtitle: 'حزم منسّقة بأسعار خاصة لمطعمك',
    savings: 'وفّر', products: 'منتج', viewBundle: 'تفاصيل الباقة',
    noData: 'لا توجد باقات متاحة حالياً', loading: 'جاري التحميل...',
    currency: 'د.م.', refresh: 'تحديث',
    TYPE: { STARTER:'باقة بداية', PROFESSIONAL:'احترافية', PREMIUM:'بريميوم', CUSTOM:'مخصصة' } as Record<string,string>,
  },
  en: {
    title: 'Ready Bundles', subtitle: 'Curated packages at special bundle prices',
    savings: 'Save', products: 'products', viewBundle: 'Bundle Details',
    noData: 'No bundles available', loading: 'Loading...',
    currency: 'MAD', refresh: 'Refresh',
    TYPE: { STARTER:'Starter', PROFESSIONAL:'Professional', PREMIUM:'Premium', CUSTOM:'Custom' } as Record<string,string>,
  },
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }
function fmt(n: number, cur = 'د.م.') { return `${cur} ${n.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

const BUNDLE_COLORS: Record<string, string> = {
  STARTER:      'from-emerald-900/40 to-gray-900 border-emerald-800/40',
  PROFESSIONAL: 'from-blue-900/40 to-gray-900 border-blue-800/40',
  PREMIUM:      'from-purple-900/40 to-gray-900 border-purple-800/40',
  CUSTOM:       'from-gray-900 to-gray-900 border-gray-700',
}

const BUNDLE_ACCENT: Record<string, string> = {
  STARTER: 'text-emerald-400', PROFESSIONAL: 'text-blue-400',
  PREMIUM: 'text-purple-400',  CUSTOM: 'text-gray-400',
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

export default function BundlesPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar

  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/restaurant/marketplace/bundles', { headers: authHeader() })
      const data = await res.json()
      setBundles(data.bundles ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">{t.title}</h1>
          </div>
          <p className="text-sm text-gray-400">{t.subtitle}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Bundles Grid ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : bundles.length === 0 ? (
        <div className="text-center py-16">
          <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">{t.noData}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bundles.filter(b => b.active).map(b => {
            const colors = BUNDLE_COLORS[b.type] ?? BUNDLE_COLORS.CUSTOM
            const accent = BUNDLE_ACCENT[b.type] ?? BUNDLE_ACCENT.CUSTOM
            return (
              <div key={b.id}
                className={`bg-gradient-to-br ${colors} border rounded-2xl p-5 flex flex-col justify-between hover:opacity-90 transition-opacity`}>
                {/* Top */}
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>
                        {t.TYPE[b.type] ?? b.type}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1 leading-tight">{b.name}</h3>
                    </div>
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0 ms-2">
                      <Layers className={`w-5 h-5 ${accent}`} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed line-clamp-3 mb-4">{b.description}</p>

                  {/* Products count + savings */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 rounded-lg px-2.5 py-1.5">
                      <Package className="w-3.5 h-3.5" />
                      {b.productIds.length} {t.products}
                    </div>
                    {b.savings > 0 && (
                      <div className="flex items-center gap-1.5 text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 rounded-lg px-2.5 py-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        {t.savings} {fmt(b.savings, t.currency)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-2xl font-bold ${accent}`}>{fmt(b.bundlePrice, t.currency)}</p>
                  </div>
                  <Link href={`/admin/marketplace/bundles/${b.id}`}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                    {t.viewBundle}
                    <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
