'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, Loader2, TrendingDown, AlertTriangle, Clock, ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts'
import { useLang } from '../lang-context'

type Period = 'week' | 'month' | 'custom'

interface AchatsReport {
  period: { from: string; to: string }
  aging: { '0-30': number; '31-60': number; '61-90': number; '90+': number; total: number }
  spendTrend: { date: string; spend: number }[]
  topSuppliers: { supplierName: string; total: number }[]
  upcomingDue: { id: string; supplierName: string; amount: number; amountPaid: number; currency: string; dueDate: string }[]
  pending: { pendingRequisitions: number; orderedPOs: number }
  totals: { unpaidTotal: number; spendThisPeriod: number }
}

const T = {
  ar: {
    title: 'المشتريات — حسابات الموردين', week: 'أسبوع', month: 'شهر',
    totalDue: 'إجمالي الدين للموردين', spend: 'المصاريف', pending: 'قيد الانتظار',
    pendingSentence: (req: number, po: number) => `${req} طلبات · ${po} أوامر شراء جارية`,
    aging: 'أعمار الديون (Aging)', daysSuffix: 'ي.',
    spendTrend: 'اتجاه المصاريف', spendTooltip: 'المصاريف',
    topSuppliers: 'أهم الموردين', noSpend: 'لا توجد مصاريف خلال هذه الفترة.',
    upcomingDue: 'الاستحقاقات القادمة (7 أيام)', noUpcoming: 'لا توجد استحقاقات خلال 7 أيام القادمة.',
    seeAllInvoices: 'عرض جميع الفواتير', loadError: 'حدث خطأ أثناء تحميل التقرير',
  },
  fr: {
    title: 'Achats — Comptes Fournisseurs', week: 'Semaine', month: 'Mois',
    totalDue: 'Total dû aux fournisseurs', spend: 'Dépenses', pending: 'En attente',
    pendingSentence: (req: number, po: number) => `${req} demandes · ${po} commandes en cours`,
    aging: 'Antériorité des dettes (Aging)', daysSuffix: 'j.',
    spendTrend: 'Tendance des dépenses', spendTooltip: 'Dépenses',
    topSuppliers: 'Top fournisseurs', noSpend: 'Aucune dépense sur la période.',
    upcomingDue: 'Échéances à venir (7 jours)', noUpcoming: 'Aucune échéance dans les 7 prochains jours.',
    seeAllInvoices: 'Voir toutes les factures', loadError: 'Erreur lors du chargement du rapport',
  },
  en: {
    title: 'Purchases — Accounts Payable', week: 'Week', month: 'Month',
    totalDue: 'Total owed to suppliers', spend: 'Spend', pending: 'Pending',
    pendingSentence: (req: number, po: number) => `${req} requisitions · ${po} orders in progress`,
    aging: 'Debt Aging', daysSuffix: 'd.',
    spendTrend: 'Spend Trend', spendTooltip: 'Spend',
    topSuppliers: 'Top Suppliers', noSpend: 'No spend over this period.',
    upcomingDue: 'Upcoming Due Dates (7 days)', noUpcoming: 'No due dates in the next 7 days.',
    seeAllInvoices: 'See all invoices', loadError: 'Error loading the report',
  },
  es: {
    title: 'Compras — Cuentas por Pagar', week: 'Semana', month: 'Mes',
    totalDue: 'Total adeudado a proveedores', spend: 'Gastos', pending: 'Pendiente',
    pendingSentence: (req: number, po: number) => `${req} solicitudes · ${po} pedidos en curso`,
    aging: 'Antigüedad de deudas (Aging)', daysSuffix: 'd.',
    spendTrend: 'Tendencia de gastos', spendTooltip: 'Gastos',
    topSuppliers: 'Principales proveedores', noSpend: 'Sin gastos en este período.',
    upcomingDue: 'Vencimientos próximos (7 días)', noUpcoming: 'Sin vencimientos en los próximos 7 días.',
    seeAllInvoices: 'Ver todas las facturas', loadError: 'Error al cargar el informe',
  },
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function fmt(n: number, currency = 'MAD') {
  return `${n.toLocaleString('fr-FR')} ${currency}`
}

export default function AchatsPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang]
  const [period, setPeriod]   = useState<Period>('month')
  const [report, setReport]   = useState<AchatsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/achats/report?period=${period}`, { headers: authHeader() })
      if (res.ok) {
        setReport(await res.json())
      } else {
        setError(T[lang].loadError)
      }
    } catch {
      setError(T[lang].loadError)
    } finally {
      setLoading(false)
    }
  }, [period, lang])

  useEffect(() => { load() }, [load])

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-violet-500" size={36} />
      </div>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-violet-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{t.title}</h1>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(['week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${period === p ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
              {p === 'week' ? t.week : t.month}
            </button>
          ))}
        </div>
      </div>

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 text-sm">{error}</div>
      )}

      {report && (
        <>
          {/* Aging + spend summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-slate-600">{t.totalDue}</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{fmt(report.aging.total)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-600">{t.spend} ({period === 'week' ? t.week : t.month})</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{fmt(report.totals.spendThisPeriod)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-semibold text-slate-600">{t.pending}</span>
              </div>
              <p className="text-sm text-slate-700">{t.pendingSentence(report.pending.pendingRequisitions, report.pending.orderedPOs)}</p>
            </div>
          </div>

          {/* Aging buckets */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">{t.aging}</h3>
            <div className="grid grid-cols-4 gap-3">
              {(['0-30', '31-60', '61-90', '90+'] as const).map(bucket => (
                <div key={bucket} className={`rounded-xl p-3 text-center ${bucket === '90+' ? 'bg-rose-50' : bucket === '61-90' ? 'bg-amber-50' : 'bg-slate-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">{bucket} {t.daysSuffix}</p>
                  <p className="font-bold text-slate-800">{fmt(report.aging[bucket])}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Spend trend */}
          {report.spendTrend.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4">{t.spendTrend}</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.spendTrend}>
                    <defs>
                      <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v} MAD`, t.spendTooltip]} />
                    <Area type="monotone" dataKey="spend" stroke="#8b5cf6" fill="url(#spend)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top suppliers + upcoming due, side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-3">{t.topSuppliers}</h3>
              {report.topSuppliers.length === 0 ? (
                <p className="text-sm text-slate-400">{t.noSpend}</p>
              ) : (
                <div className="space-y-2">
                  {report.topSuppliers.map(s => (
                    <div key={s.supplierName} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{s.supplierName}</span>
                      <span className="font-bold text-slate-900">{fmt(s.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> {t.upcomingDue}
              </h3>
              {report.upcomingDue.length === 0 ? (
                <p className="text-sm text-slate-400">{t.noUpcoming}</p>
              ) : (
                <div className="space-y-2">
                  {report.upcomingDue.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{inv.supplierName}</span>
                      <span className="font-bold text-rose-600">{fmt(inv.amount - inv.amountPaid, inv.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Link href="/admin/invoices" className="flex items-center gap-1.5 text-sm text-violet-600 font-semibold hover:underline w-fit">
            {t.seeAllInvoices} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </>
      )}
    </div>
  )
}
