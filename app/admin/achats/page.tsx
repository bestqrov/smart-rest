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

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function fmt(n: number, currency = 'MAD') {
  return `${n.toLocaleString('fr-FR')} ${currency}`
}

export default function AchatsPage() {
  const { isRTL } = useLang()
  const [period, setPeriod]   = useState<Period>('month')
  const [report, setReport]   = useState<AchatsReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/achats/report?period=${period}`, { headers: authHeader() })
      if (res.ok) setReport(await res.json())
    } finally {
      setLoading(false)
    }
  }, [period])

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
          <h1 className="text-2xl font-bold text-slate-800">Achats — Comptes Fournisseurs</h1>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(['week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${period === p ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
              {p === 'week' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>
      </div>

      {report && (
        <>
          {/* Aging + spend summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-slate-600">Total dû aux fournisseurs</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{fmt(report.aging.total)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-600">Dépenses ({period === 'week' ? 'semaine' : 'mois'})</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{fmt(report.totals.spendThisPeriod)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-semibold text-slate-600">En attente</span>
              </div>
              <p className="text-sm text-slate-700">{report.pending.pendingRequisitions} demandes · {report.pending.orderedPOs} commandes en cours</p>
            </div>
          </div>

          {/* Aging buckets */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">Antériorité des dettes (Aging)</h3>
            <div className="grid grid-cols-4 gap-3">
              {(['0-30', '31-60', '61-90', '90+'] as const).map(bucket => (
                <div key={bucket} className={`rounded-xl p-3 text-center ${bucket === '90+' ? 'bg-rose-50' : bucket === '61-90' ? 'bg-amber-50' : 'bg-slate-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">{bucket} j.</p>
                  <p className="font-bold text-slate-800">{fmt(report.aging[bucket])}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Spend trend */}
          {report.spendTrend.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4">Tendance des dépenses</h3>
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
                    <Tooltip formatter={(v: number) => [`${v} MAD`, 'Dépenses']} />
                    <Area type="monotone" dataKey="spend" stroke="#8b5cf6" fill="url(#spend)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top suppliers + upcoming due, side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-3">Top fournisseurs</h3>
              {report.topSuppliers.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune dépense sur la période.</p>
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
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Échéances à venir (7 jours)
              </h3>
              {report.upcomingDue.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune échéance dans les 7 prochains jours.</p>
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
            Voir toutes les factures <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </>
      )}
    </div>
  )
}
