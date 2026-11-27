'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { useLang } from '../lang-context'
import PlanGate from '../PlanGate'

interface Row { cafeId: string; name: string; orderCount: number; revenue: number }
interface Report {
  branches: Row[]; totalOrders: number; totalRevenue: number
  parentId: string; currentId: string; currency: string
}
type Range = 'today' | 'week' | 'month'

const T = {
  ar: { title: 'الفروع', subtitle: 'مبيعات كل فروعك في شاشة واحدة (الطلبات المدفوعة)', today: 'اليوم', week: '7 أيام', month: '30 يوماً',
        branch: 'الفرع', orders: 'الطلبات', revenue: 'المبيعات', share: 'الحصة', total: 'المجموع', main: 'الرئيسي', you: 'أنت هنا',
        empty: 'لا توجد فروع مربوطة بعد. تواصل مع فريق الدعم لربط فروعك بهذا الحساب.', error: 'تعذّر تحميل التقرير' },
  en: { title: 'Branches', subtitle: 'Sales of all your branches on one screen (paid orders)', today: 'Today', week: '7 days', month: '30 days',
        branch: 'Branch', orders: 'Orders', revenue: 'Sales', share: 'Share', total: 'Total', main: 'Main', you: 'You are here',
        empty: 'No branches linked yet. Contact support to link your branches to this account.', error: 'Could not load the report' },
  fr: { title: 'Succursales', subtitle: 'Les ventes de toutes vos succursales sur un écran (commandes payées)', today: "Aujourd'hui", week: '7 jours', month: '30 jours',
        branch: 'Succursale', orders: 'Commandes', revenue: 'Ventes', share: 'Part', total: 'Total', main: 'Principale', you: 'Vous êtes ici',
        empty: 'Aucune succursale liée. Contactez le support pour lier vos succursales à ce compte.', error: 'Impossible de charger le rapport' },
  es: { title: 'Sucursales', subtitle: 'Ventas de todas tus sucursales en una pantalla (pedidos pagados)', today: 'Hoy', week: '7 días', month: '30 días',
        branch: 'Sucursal', orders: 'Pedidos', revenue: 'Ventas', share: 'Cuota', total: 'Total', main: 'Principal', you: 'Estás aquí',
        empty: 'Aún no hay sucursales vinculadas. Contacta con soporte para vincularlas.', error: 'No se pudo cargar el informe' },
} as const

function BranchesInner() {
  const { lang, isRTL } = useLang()
  const t = T[(lang in T ? lang : 'en') as keyof typeof T]
  const [range, setRange] = useState<Range>('today')
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  const load = useCallback(async (r: Range) => {
    setLoading(true); setErr(false)
    try {
      const res = await fetch(`/api/admin/branches/report?range=${r}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { setErr(true) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(range) }, [load, range])

  const fmt = (n: number) => `${n.toLocaleString(lang === 'ar' ? 'ar' : lang, { maximumFractionDigits: 2 })} ${data?.currency ?? ''}`
  const hasBranches = (data?.branches.length ?? 0) > 1

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="w-6 h-6 text-blue-600" />{t.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {(['today', 'week', 'month'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm rounded-md ${range === r ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t[r]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : err ? (
        <p className="text-center text-red-600 py-10">{t.error}</p>
      ) : !hasBranches ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">{t.empty}</div>
      ) : data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label={t.branch} value={String(data.branches.length)} />
            <Stat label={t.orders} value={data.totalOrders.toLocaleString()} />
            <Stat label={t.revenue} value={fmt(data.totalRevenue)} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t.branch}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.orders}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.revenue}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.share}</th>
                </tr>
              </thead>
              <tbody>
                {[...data.branches].sort((a, b) => b.revenue - a.revenue).map(row => {
                  const share = data.totalRevenue > 0 ? Math.round((row.revenue / data.totalRevenue) * 100) : 0
                  return (
                    <tr key={row.cafeId} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {row.name}
                        {row.cafeId === data.parentId && <span className="ms-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{t.main}</span>}
                        {row.cafeId === data.currentId && <span className="ms-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{t.you}</span>}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">{row.orderCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{fmt(row.revenue)}</td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-20 rounded bg-gray-100"><div className="h-1.5 rounded bg-blue-500" style={{ width: `${share}%` }} /></div>
                          <span className="tabular-nums w-9">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="px-4 py-3">{t.total}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{data.totalOrders.toLocaleString()}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{fmt(data.totalRevenue)}</td>
                  <td className="px-4 py-3 text-end">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  )
}

export default function BranchesPage() {
  return <PlanGate feature="multiBranch"><BranchesInner /></PlanGate>
}
