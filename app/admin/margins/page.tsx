'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useLang } from '../lang-context'
import { A } from '../../../lib/adminI18n'

interface MarginItem {
  id: string; nameEn: string; nameAr: string; nameFr: string; imageUrl: string | null
  categoryName: string; sell: number; cost: number; profit: number; marginPct: number
}
interface MarginData {
  items: MarginItem[]; avgMarginPct: number; best: MarginItem[]; worst: MarginItem[]
  totalWithCost: number
}

function getName(item: { nameAr: string; nameEn: string; nameFr?: string }, lang: string) {
  if (lang === 'ar') return item.nameAr || item.nameEn
  if (lang === 'fr') return item.nameFr || item.nameEn
  return item.nameEn || item.nameAr
}

function MarginBadge({ pct }: { pct: number }) {
  const color = pct >= 60 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  const Icon  = pct >= 50 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      <Icon className="w-3 h-3" /> {pct}%
    </span>
  )
}

export default function MarginsPage() {
  const { lang } = useLang()
  const t = A[lang]
  const [data,    setData]    = useState<MarginData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'all' | 'best' | 'worst'>('all')

  function auth() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

  useEffect(() => {
    fetch('/api/admin/stats/margins', { headers: auth() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  const label = {
    title:      { ar: 'تحليل الهوامش والتكاليف', fr: 'Analyse des marges', en: 'Margin & Cost Analysis' },
    sub:        { ar: 'ربحية كل منتج بناءً على سعر التكلفة المُدخل', fr: 'Rentabilité par produit selon le coût saisi', en: 'Profitability per product based on entered cost price' },
    avg:        { ar: 'متوسط الهامش', fr: 'Marge moyenne', en: 'Avg Margin' },
    products:   { ar: 'منتج بسعر تكلفة', fr: 'produits avec coût', en: 'products with cost' },
    best5:      { ar: 'أعلى 5 هوامش', fr: 'Top 5 marges', en: 'Top 5 Margins' },
    worst5:     { ar: 'أدنى 5 هوامش', fr: 'Bas 5 marges', en: 'Lowest 5 Margins' },
    all:        { ar: 'الكل', fr: 'Tous', en: 'All' },
    sell:       { ar: 'سعر البيع', fr: 'Prix de vente', en: 'Sell' },
    cost:       { ar: 'التكلفة', fr: 'Coût', en: 'Cost' },
    profit:     { ar: 'الربح', fr: 'Bénéfice', en: 'Profit' },
    noData:     { ar: 'لا توجد منتجات بسعر تكلفة بعد — أضف التكاليف من إدارة المنيو', fr: "Aucun produit avec coût — ajoutez les coûts depuis la gestion du menu", en: 'No products with cost price yet — add costs from Menu Management' },
  }
  function L(k: keyof typeof label) { return (label[k] as Record<string, string>)[lang] ?? (label[k] as Record<string, string>).en }

  const displayItems = tab === 'best' ? data?.best : tab === 'worst' ? data?.worst : data?.items

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="font-extrabold text-gray-900 text-xl">{L('title')}</h1>
          <p className="text-gray-400 text-sm mt-0.5">{L('sub')}</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{L('avg')}</p>
              <p className={`text-3xl font-extrabold mt-1 ${data.avgMarginPct >= 60 ? 'text-emerald-600' : data.avgMarginPct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                {data.avgMarginPct}%
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{L('products')}</p>
              <p className="text-3xl font-extrabold mt-1 text-gray-800">{data.totalWithCost}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{L('best5')}</p>
              <p className="text-lg font-extrabold mt-1 text-emerald-600 truncate">
                {data.best[0] ? `${getName(data.best[0], lang)} · ${data.best[0].marginPct}%` : '—'}
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-2">
            {(['all', 'best', 'worst'] as const).map(k => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {k === 'all' ? L('all') : k === 'best' ? `↑ ${L('best5')}` : `↓ ${L('worst5')}`}
              </button>
            ))}
          </div>

          {/* No data hint */}
          {data.items.length === 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-700 text-sm">{L('noData')}</p>
            </div>
          )}

          {/* Products table */}
          {(displayItems?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold">Produit</th>
                    <th className="px-4 py-3 text-right font-semibold">{L('sell')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{L('cost')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{L('profit')}</th>
                    <th className="px-4 py-3 text-right font-semibold">Marge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayItems!.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            : <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />}
                          <div>
                            <p className="font-semibold text-gray-900 truncate max-w-[160px]">{getName(item, lang)}</p>
                            <p className="text-xs text-gray-400">{item.categoryName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700 tabular-nums">{item.sell.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-amber-600 font-medium tabular-nums">{item.cost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        <span className={item.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>{item.profit.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MarginBadge pct={item.marginPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
