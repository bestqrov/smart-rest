'use client'

import { useEffect, useState, useCallback } from 'react'
import { Warehouse, RefreshCw, AlertTriangle, Minus, Plus } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string; productId: string; stock: number; reserved: number
  available: number; lowStockThreshold: number; isLowStock: boolean; lastUpdated: string
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'المخزون', subtitle: 'إدارة مخزون المنتجات',
    refresh: 'تحديث', loading: 'جاري التحميل...',
    product: 'المنتج', stock: 'المخزون', reserved: 'محجوز',
    available: 'متاح', threshold: 'حد التنبيه', status: 'الحالة',
    actions: 'إجراءات', lowStock: 'نقص المخزون', allItems: 'كل المخزون',
    noItems: 'لا توجد بيانات مخزون', save: 'حفظ', adjust: 'تعديل',
    setStock: 'تحديد المخزون', delta: 'تعديل (+/-)',
    LOW: 'منخفض', OK: 'جيد',
  },
  en: {
    title: 'Inventory', subtitle: 'Manage product stock levels',
    refresh: 'Refresh', loading: 'Loading...',
    product: 'Product', stock: 'Stock', reserved: 'Reserved',
    available: 'Available', threshold: 'Low Stock Threshold', status: 'Status',
    actions: 'Actions', lowStock: 'Low Stock Only', allItems: 'All Items',
    noItems: 'No inventory data', save: 'Save', adjust: 'Adjust',
    setStock: 'Set Stock', delta: 'Adjust (+/-)',
    LOW: 'Low', OK: 'OK',
  },
}

function StockInput({ productId, current, header, onRefresh }: {
  productId: string; current: number; header: () => Record<string, string>; onRefresh: () => void
}) {
  const [value, setValue] = useState(String(current))
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'set' | 'adjust'>('set')
  const [delta, setDelta] = useState('0')

  async function save() {
    setSaving(true)
    try {
      if (mode === 'set') {
        await fetch(`/api/superadmin/marketplace/inventory/${productId}/stock`, {
          method: 'PATCH', headers: { ...header(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: Number(value) }),
        })
      } else {
        await fetch(`/api/superadmin/marketplace/inventory/${productId}/adjust`, {
          method: 'POST', headers: { ...header(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta: Number(delta) }),
        })
      }
      onRefresh()
    } finally { setSaving(false) }
  }

  return (
    <div className="flex items-center gap-2">
      <select value={mode} onChange={e => setMode(e.target.value as any)}
        className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300">
        <option value="set">Set</option>
        <option value="adjust">±</option>
      </select>
      {mode === 'set' ? (
        <input type="number" value={value} onChange={e => setValue(e.target.value)} min={0}
          className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100" />
      ) : (
        <input type="number" value={delta} onChange={e => setDelta(e.target.value)}
          className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100" />
      )}
      <button onClick={save} disabled={saving}
        className="px-2 py-1 bg-emerald-800 hover:bg-emerald-700 rounded text-xs font-medium disabled:opacity-50">
        {saving ? '...' : 'OK'}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [lang, setLang]         = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [items, setItems]       = useState<InventoryItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [showLowOnly, setShowLowOnly] = useState(false)
  const t = T[lang]
  const isRTL = lang === 'ar'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = showLowOnly
        ? '/api/superadmin/marketplace/inventory/low-stock'
        : '/api/superadmin/marketplace/inventory'
      const res  = await fetch(url, { headers: header() })
      const json = await res.json()
      setItems(json.inventory ?? json.items ?? [])
    } finally { setLoading(false) }
  }, [header, showLowOnly])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  const lowCount = items.filter(i => i.isLowStock).length

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Warehouse className="w-7 h-7 text-violet-400" />{t.title}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg">{lang === 'ar' ? 'EN' : 'ع'}</button>
          <button onClick={load} disabled={loading} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Low stock alert banner */}
      {lowCount > 0 && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-800 rounded-xl p-4 mb-5">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            {lowCount} {isRTL ? 'منتج يعاني من نقص المخزون' : 'products are below their low stock threshold'}
          </p>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setShowLowOnly(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!showLowOnly ? 'bg-violet-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
          {t.allItems}
        </button>
        <button onClick={() => setShowLowOnly(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${showLowOnly ? 'bg-red-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
          <AlertTriangle className="w-4 h-4" />{t.lowStock} {lowCount > 0 && `(${lowCount})`}
        </button>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
              <th className="px-4 py-3 text-start">{t.product}</th>
              <th className="px-4 py-3 text-center">{t.stock}</th>
              <th className="px-4 py-3 text-center hidden md:table-cell">{t.reserved}</th>
              <th className="px-4 py-3 text-center">{t.available}</th>
              <th className="px-4 py-3 text-center hidden lg:table-cell">{t.threshold}</th>
              <th className="px-4 py-3 text-center hidden sm:table-cell">{t.status}</th>
              <th className="px-4 py-3 text-end">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />{t.loading}
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">{t.noItems}</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className={`hover:bg-zinc-800/40 transition-colors ${item.isLowStock ? 'border-s-2 border-red-600' : ''}`}>
                <td className="px-4 py-3">
                  <div className="text-xs font-mono text-zinc-400 truncate max-w-[120px]">{item.productId}</div>
                </td>
                <td className="px-4 py-3 text-center font-mono text-zinc-200">{item.stock}</td>
                <td className="px-4 py-3 text-center font-mono text-yellow-400 hidden md:table-cell">{item.reserved}</td>
                <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">{item.available}</td>
                <td className="px-4 py-3 text-center text-zinc-400 hidden lg:table-cell">{item.lowStockThreshold}</td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  <span className={`px-2 py-0.5 rounded text-xs ${item.isLowStock ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                    {item.isLowStock ? t.LOW : t.OK}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <StockInput productId={item.productId} current={item.stock} header={header} onRefresh={load} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
