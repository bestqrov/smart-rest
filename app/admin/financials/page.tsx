'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Loader2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportData {
  period: { from: string; to: string }
  income:   { total: number; cash: number; card: number }
  expenses: { total: number; byCategory: Record<string, number> }
  netProfit: number
  chart: { date: string; income: number; expense: number; profit: number }[]
}

interface Expense {
  id: string
  amount: number
  category: string
  description: string
  date: string
}

type Period = 'today' | 'week' | 'month' | 'custom'
type Lang = 'ar' | 'fr' | 'en' | 'es'

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'المالية والتقارير',
    income: 'المداخيل', expenses: 'المصاريف', netProfit: 'صافي الربح',
    cash: 'نقداً', card: 'بطاقة',
    addExpense: 'إضافة مصروف',
    amount: 'المبلغ', category: 'الفئة', description: 'الوصف', date: 'التاريخ',
    save: 'حفظ', saving: 'جارٍ الحفظ…', cancel: 'إلغاء', delete: 'حذف',
    periods: { today: 'اليوم', week: 'الأسبوع', month: 'الشهر', custom: 'مخصص' },
    categories: { supplies: 'مستلزمات', utilities: 'فواتير', wages: 'أجور', rent: 'إيجار', other: 'أخرى' },
    chartTitle: 'تطور المداخيل والمصاريف',
    noData: 'لا توجد بيانات في هذه الفترة',
    profitLabel: 'صافي الربح', incomeLabel: 'مداخيل', expenseLabel: 'مصاريف',
    expensesList: 'قائمة المصاريف',
    noExpenses: 'لا توجد مصاريف مسجلة',
    currency: 'MAD',
    from: 'من', to: 'إلى',
  },
  fr: {
    title: 'Finances & Rapports',
    income: 'Recettes', expenses: 'Dépenses', netProfit: 'Bénéfice net',
    cash: 'Espèces', card: 'Carte',
    addExpense: 'Ajouter une dépense',
    amount: 'Montant', category: 'Catégorie', description: 'Description', date: 'Date',
    save: 'Enregistrer', saving: 'Enregistrement…', cancel: 'Annuler', delete: 'Supprimer',
    periods: { today: "Aujourd'hui", week: 'Semaine', month: 'Mois', custom: 'Personnalisé' },
    categories: { supplies: 'Fournitures', utilities: 'Factures', wages: 'Salaires', rent: 'Loyer', other: 'Autre' },
    chartTitle: 'Évolution recettes / dépenses',
    noData: 'Aucune donnée sur cette période',
    profitLabel: 'Bénéfice', incomeLabel: 'Recettes', expenseLabel: 'Dépenses',
    expensesList: 'Liste des dépenses',
    noExpenses: 'Aucune dépense enregistrée',
    currency: 'MAD',
    from: 'Du', to: 'au',
  },
  en: {
    title: 'Finances & Reports',
    income: 'Income', expenses: 'Expenses', netProfit: 'Net Profit',
    cash: 'Cash', card: 'Card',
    addExpense: 'Add Expense',
    amount: 'Amount', category: 'Category', description: 'Description', date: 'Date',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel', delete: 'Delete',
    periods: { today: 'Today', week: 'Week', month: 'Month', custom: 'Custom' },
    categories: { supplies: 'Supplies', utilities: 'Utilities', wages: 'Wages', rent: 'Rent', other: 'Other' },
    chartTitle: 'Income vs Expenses',
    noData: 'No data for this period',
    profitLabel: 'Profit', incomeLabel: 'Income', expenseLabel: 'Expenses',
    expensesList: 'Expenses List',
    noExpenses: 'No expenses recorded',
    currency: 'MAD',
    from: 'From', to: 'to',
  },
  es: {
    title: 'Finanzas e Informes',
    income: 'Ingresos', expenses: 'Gastos', netProfit: 'Beneficio neto',
    cash: 'Efectivo', card: 'Tarjeta',
    addExpense: 'Añadir gasto',
    amount: 'Importe', category: 'Categoría', description: 'Descripción', date: 'Fecha',
    save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', delete: 'Eliminar',
    periods: { today: 'Hoy', week: 'Semana', month: 'Mes', custom: 'Personalizado' },
    categories: { supplies: 'Suministros', utilities: 'Facturas', wages: 'Salarios', rent: 'Alquiler', other: 'Otro' },
    chartTitle: 'Ingresos vs Gastos',
    noData: 'Sin datos para este período',
    profitLabel: 'Beneficio', incomeLabel: 'Ingresos', expenseLabel: 'Gastos',
    expensesList: 'Lista de gastos',
    noExpenses: 'Sin gastos registrados',
    currency: 'MAD',
    from: 'Desde', to: 'hasta',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  const tk = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return { Authorization: `Bearer ${tk ?? ''}`, 'Content-Type': 'application/json' }
}

function fmt(n: number, cur: string) {
  return `${n.toFixed(2)} ${cur}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const [lang, setLang] = useState<Lang>('ar')
  const t = T[lang]
  const isRTL = lang === 'ar'

  const [period, setPeriod]     = useState<Period>('month')
  const [customFrom, setFrom]   = useState('')
  const [customTo,   setTo]     = useState('')
  const [report, setReport]     = useState<ReportData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadingReport, setLoadingReport] = useState(true)
  const [loadingExp,    setLoadingExp]    = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', category: 'supplies', description: '', date: new Date().toISOString().slice(0,10) })
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')

  // ── Fetch report ────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setLoadingReport(true)
    let url = `/api/admin/financials/report?period=${period}`
    if (period === 'custom' && customFrom) url += `&from=${customFrom}&to=${customTo || new Date().toISOString().slice(0,10)}`
    const res = await fetch(url, { headers: authHeader() })
    if (res.ok) setReport(await res.json())
    setLoadingReport(false)
  }, [period, customFrom, customTo])

  // ── Fetch expenses list ────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    setLoadingExp(true)
    let url = `/api/admin/expenses`
    if (period === 'custom' && customFrom) url += `?from=${customFrom}&to=${customTo}`
    const res = await fetch(url, { headers: authHeader() })
    if (res.ok) { const d = await res.json(); setExpenses(d.expenses ?? []) }
    setLoadingExp(false)
  }, [period, customFrom, customTo])

  useEffect(() => { fetchReport(); fetchExpenses() }, [fetchReport, fetchExpenses])

  // ── Add expense ─────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormErr('')
    if (!form.amount || Number(form.amount) <= 0) { setFormErr('Amount must be positive'); return }
    if (!form.description.trim()) { setFormErr('Description required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      const data = await res.json()
      if (!res.ok) { setFormErr(data.error ?? 'Failed'); return }
      setShowForm(false)
      setForm({ amount: '', category: 'supplies', description: '', date: new Date().toISOString().slice(0,10) })
      fetchReport(); fetchExpenses()
    } finally { setSaving(false) }
  }

  // ── Delete expense ──────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE', headers: authHeader() })
    fetchReport(); fetchExpenses()
  }

  const currency = 'MAD'
  const profitColor = (report?.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t.title}</h1>
        <div className="flex items-center gap-2">
          {(Object.keys(T) as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2 py-1 rounded text-xs font-bold ${lang === l ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap gap-2 items-center">
        {(['today','week','month','custom'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              period === p ? 'bg-amber-500 text-white shadow' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-300'
            }`}>
            {t.periods[p]}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-500">{t.from}</span>
            <input type="date" value={customFrom} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <span className="text-sm text-slate-500">{t.to}</span>
            <input type="date" value={customTo} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        )}
      </div>

      {loadingReport ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
        </div>
      ) : report ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t.income}</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{fmt(report.income.total, currency)}</p>
              <div className="flex gap-3 mt-2 text-xs text-slate-400">
                <span>💵 {t.cash}: {fmt(report.income.cash, currency)}</span>
                <span>💳 {t.card}: {fmt(report.income.card, currency)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                </div>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t.expenses}</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{fmt(report.expenses.total, currency)}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(report.expenses.byCategory).map(([cat, amt]) => (
                  <span key={cat} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                    {t.categories[cat as keyof typeof t.categories] ?? cat}: {amt.toFixed(0)}
                  </span>
                ))}
              </div>
            </div>

            <div className={`rounded-2xl p-5 shadow-sm border ${(report.netProfit >= 0) ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${report.netProfit >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
                  <DollarSign className={`w-4 h-4 ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`} />
                </div>
                <span className={`text-sm font-semibold ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{t.netProfit}</span>
              </div>
              <p className={`text-3xl font-extrabold ${profitColor}`}>{fmt(report.netProfit, currency)}</p>
            </div>
          </div>

          {/* Chart */}
          {report.chart.length > 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">{t.chartTitle}</h3>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.chart}>
                    <defs>
                      <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) => [
                      `${v.toFixed(2)} ${currency}`,
                      name === 'income' ? t.incomeLabel : name === 'expense' ? t.expenseLabel : t.profitLabel
                    ]} />
                    <Legend formatter={v => v === 'income' ? t.incomeLabel : v === 'expense' ? t.expenseLabel : t.profitLabel} />
                    <Area type="monotone" dataKey="income"  stroke="#10b981" fill="url(#income)"  strokeWidth={2} />
                    <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expense)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-slate-400 border border-slate-100 dark:border-slate-700">
              {t.noData}
            </div>
          )}
        </>
      ) : null}

      {/* Expenses section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-slate-700 dark:text-slate-200">{t.expensesList}</h2>
          <button onClick={() => { setShowForm(true); setFormErr('') }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> {t.addExpense}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="px-5 py-4 bg-amber-50 dark:bg-slate-700/40 border-b border-amber-100 dark:border-slate-600">
            <form onSubmit={handleAdd} className="grid sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.amount}</label>
                <input type="number" step="0.01" min="0" value={form.amount}
                  onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="0.00"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.category}</label>
                <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {Object.entries(t.categories).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.description}</label>
                <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  placeholder={t.description}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.date}</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              {formErr && <p className="sm:col-span-4 text-red-500 text-sm">{formErr}</p>}
              <div className="sm:col-span-4 flex gap-2">
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white rounded-xl font-semibold text-sm">
                  {saving ? t.saving : t.save}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setFormErr('') }}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-sm">
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        )}

        {loadingExp ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.noExpenses}</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {expenses.map(exp => (
              <div key={exp.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full shrink-0">
                    {t.categories[exp.category as keyof typeof t.categories] ?? exp.category}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{exp.description}</span>
                  <span className="text-xs text-slate-400 shrink-0">{new Date(exp.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-red-600 text-sm">{fmt(exp.amount, currency)}</span>
                  <button onClick={() => handleDelete(exp.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
