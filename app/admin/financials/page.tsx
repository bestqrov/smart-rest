'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '../lang-context'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Loader2,
  Users, Calendar, AlertCircle, CheckCircle, Clock, Edit2, X, ChevronDown
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportData {
  period: { from: string; to: string }
  income:   { total: number; cash: number; card: number }
  expenses: { total: number; byCategory: Record<string, number> }
  netProfit: number
  chart: { date: string; income: number; expense: number; profit: number }[]
}

interface Expense {
  id: string; amount: number; category: string; description: string; date: string
}

interface PayrollMember {
  id: string; name: string; role: string; roles: string[]
  shiftStatus: 'ACTIVE' | 'OFF_DUTY'
  dailyRate: number
  attendanceDays: number; absenceDays: number; lateDays: number
  totalHours: number; workingDays: number
  baseSalary: number; commissions: number; deductions: number; netSalary: number
}

type Period = 'today' | 'week' | 'month' | 'custom'
type Lang = 'ar' | 'fr' | 'en' | 'es'
type Tab  = 'report' | 'payroll'

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
    currency: 'MAD', from: 'من', to: 'إلى',
    tabReport: 'التقارير', tabPayroll: 'الرواتب',
    payrollTitle: 'وحدة الأجور', payrollSub: 'حساب الرواتب حسب الحضور والعمولات',
    filterAll: 'الكل', filterWaiter: 'نادل', filterKitchen: 'مطبخ', filterOther: 'آخر',
    attendance: 'حضور', absence: 'غياب', late: 'تأخر', hours: 'ساعات',
    baseSalary: 'الراتب الأساسي', commissions: 'العمولات', deductions: 'خصومات', netSalary: 'الصافي',
    dailyRate: 'الأجر اليومي', setRate: 'تحديد', approve: 'الموافقة على الصرف',
    approved: 'تمت الموافقة ✓',
    workingDays: 'أيام العمل',
    noStaff: 'لا يوجد موظفون',
    active: 'نشط', offDuty: 'خارج الوردية',
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
    currency: 'MAD', from: 'Du', to: 'au',
    tabReport: 'Rapports', tabPayroll: 'Salaires',
    payrollTitle: 'Module Salaires', payrollSub: 'Calcul par présence et commissions',
    filterAll: 'Tous', filterWaiter: 'Serveur', filterKitchen: 'Cuisine', filterOther: 'Autre',
    attendance: 'Présence', absence: 'Absence', late: 'Retards', hours: 'Heures',
    baseSalary: 'Salaire de base', commissions: 'Commissions', deductions: 'Déductions', netSalary: 'Net',
    dailyRate: 'Taux journalier', setRate: 'Définir', approve: 'Approuver le paiement',
    approved: 'Approuvé ✓',
    workingDays: 'Jours ouvrés',
    noStaff: 'Aucun employé',
    active: 'Actif', offDuty: 'Hors service',
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
    currency: 'MAD', from: 'From', to: 'to',
    tabReport: 'Reports', tabPayroll: 'Payroll',
    payrollTitle: 'Payroll Module', payrollSub: 'Calculated from attendance & commissions',
    filterAll: 'All', filterWaiter: 'Waiter', filterKitchen: 'Kitchen', filterOther: 'Other',
    attendance: 'Days In', absence: 'Absent', late: 'Late', hours: 'Hours',
    baseSalary: 'Base Salary', commissions: 'Commissions', deductions: 'Deductions', netSalary: 'Net',
    dailyRate: 'Daily Rate', setRate: 'Set', approve: 'Approve Payment',
    approved: 'Approved ✓',
    workingDays: 'Working Days',
    noStaff: 'No staff found',
    active: 'Active', offDuty: 'Off Duty',
  },
  es: {
    title: 'Finanzas e Informes',
    income: 'Ingresos', expenses: 'Gastos', netProfit: 'Beneficio neto',
    cash: 'Efectivo', card: 'Tarjeta',
    addExpense: 'Añadir gasto',
    amount: 'Importe', category: 'Categoría', description: 'Descripción', date: 'Fecha',
    save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', delete: 'Eliminar',
    periods: { today: 'Hoy', week: 'Semana', month: 'Mes', custom: 'Personalizado' },
    categories: { supplies: 'Suministros', utilities: 'Factures', wages: 'Salarios', rent: 'Alquiler', other: 'Otro' },
    chartTitle: 'Ingresos vs Gastos',
    noData: 'Sin datos para este período',
    profitLabel: 'Beneficio', incomeLabel: 'Ingresos', expenseLabel: 'Gastos',
    expensesList: 'Lista de gastos',
    noExpenses: 'Sin gastos registrados',
    currency: 'MAD', from: 'Desde', to: 'hasta',
    tabReport: 'Informes', tabPayroll: 'Nóminas',
    payrollTitle: 'Módulo de Nóminas', payrollSub: 'Calculado por asistencia y comisiones',
    filterAll: 'Todos', filterWaiter: 'Mesero', filterKitchen: 'Cocina', filterOther: 'Otro',
    attendance: 'Asistencia', absence: 'Ausencia', late: 'Retrasos', hours: 'Horas',
    baseSalary: 'Salario base', commissions: 'Comisiones', deductions: 'Deducciones', netSalary: 'Neto',
    dailyRate: 'Tarifa diaria', setRate: 'Establecer', approve: 'Aprobar pago',
    approved: 'Aprobado ✓',
    workingDays: 'Días laborables',
    noStaff: 'Sin empleados',
    active: 'Activo', offDuty: 'Fuera de turno',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  const tk = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return { Authorization: `Bearer ${tk ?? ''}`, 'Content-Type': 'application/json' }
}

function fmt(n: number, cur: string) { return `${n.toFixed(2)} ${cur}` }

const ROLE_COLORS: Record<string, string> = {
  WAITER:     'bg-blue-100 text-blue-700',
  CASHIER:    'bg-violet-100 text-violet-700',
  SUPERVISOR: 'bg-amber-100 text-amber-700',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang]

  const [tab, setTab] = useState<Tab>('report')

  // Report state
  const [period, setPeriod]     = useState<Period>('month')
  const [customFrom, setFrom]   = useState('')
  const [customTo,   setTo]     = useState('')
  const [report, setReport]     = useState<ReportData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadingReport, setLoadingReport] = useState(true)
  const [loadingExp,    setLoadingExp]    = useState(true)
  const [achatsSummary, setAchatsSummary] = useState<{ unpaidTotal: number; spendThisPeriod: number } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', category: 'supplies', description: '', date: new Date().toISOString().slice(0,10) })
  const [saving, setSaving]   = useState(false)
  const [formErr, setFormErr] = useState('')

  // Payroll state
  const [payroll, setPayroll]           = useState<PayrollMember[]>([])
  const [loadingPayroll, setLoadingPayroll] = useState(false)
  const [payrollFilter, setPayrollFilter]   = useState<'all'|'waiter'|'kitchen'|'other'>('all')
  const [payrollPeriod, setPayrollPeriod]   = useState<'month'|'custom'>('month')
  const [prFrom, setPrFrom] = useState('')
  const [prTo,   setPrTo]   = useState('')
  const [editingRate, setEditingRate]   = useState<string | null>(null)
  const [rateInput, setRateInput]       = useState('')
  const [approvedIds, setApprovedIds]   = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  // ── Fetch report ────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setLoadingReport(true)
    let url = `/api/admin/financials/report?period=${period}`
    if (period === 'custom' && customFrom) url += `&from=${customFrom}&to=${customTo || new Date().toISOString().slice(0,10)}`
    const res = await fetch(url, { headers: authHeader() })
    if (res.ok) setReport(await res.json())
    setLoadingReport(false)
  }, [period, customFrom, customTo])

  const fetchExpenses = useCallback(async () => {
    setLoadingExp(true)
    let url = `/api/admin/expenses`
    if (period === 'custom' && customFrom) url += `?from=${customFrom}&to=${customTo}`
    const res = await fetch(url, { headers: authHeader() })
    if (res.ok) { const d = await res.json(); setExpenses(d.expenses ?? []) }
    setLoadingExp(false)
  }, [period, customFrom, customTo])

  useEffect(() => { fetchReport(); fetchExpenses() }, [fetchReport, fetchExpenses])

  useEffect(() => {
    fetch(`/api/admin/achats/report?period=${period === 'today' ? 'week' : period === 'custom' ? 'month' : period}`, {
      headers: authHeader(),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAchatsSummary(d.totals) })
      .catch(() => {})
  }, [period])

  // ── Fetch payroll ───────────────────────────────────────────────────────────
  const fetchPayroll = useCallback(async () => {
    setLoadingPayroll(true)
    let url = '/api/admin/payroll'
    if (payrollPeriod === 'custom' && prFrom) url += `?from=${prFrom}&to=${prTo || new Date().toISOString().slice(0,10)}`
    const res = await fetch(url, { headers: authHeader() })
    if (res.ok) { const d = await res.json(); setPayroll(d.payroll ?? []) }
    setLoadingPayroll(false)
  }, [payrollPeriod, prFrom, prTo])

  useEffect(() => { if (tab === 'payroll') fetchPayroll() }, [tab, fetchPayroll])

  // ── Add expense ─────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setFormErr('')
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

  async function handleDelete(id: string) {
    await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE', headers: authHeader() })
    fetchReport(); fetchExpenses()
  }

  async function saveRate(staffId: string) {
    const rate = parseFloat(rateInput)
    if (isNaN(rate) || rate < 0) return
    await fetch(`/api/admin/payroll/${staffId}/rate`, {
      method: 'PATCH', headers: authHeader(),
      body: JSON.stringify({ dailyRate: rate }),
    })
    setEditingRate(null); fetchPayroll()
  }

  const currency = 'MAD'
  const profitColor = (report?.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'

  const filteredPayroll = payroll.filter(m => {
    if (payrollFilter === 'waiter')  return m.role === 'WAITER'
    if (payrollFilter === 'kitchen') return m.roles.some(r => ['COOK','BARISTA','DISHWASHER'].includes(r))
    if (payrollFilter === 'other')   return !['WAITER'].includes(m.role) && !m.roles.some(r => ['COOK','BARISTA','DISHWASHER'].includes(r))
    return true
  })

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t.title}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('report')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'report' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
          📊 {t.tabReport}
        </button>
        <button onClick={() => setTab('payroll')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'payroll' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
          💰 {t.tabPayroll}
        </button>
      </div>

      {/* ── REPORT TAB ── */}
      {tab === 'report' && (
        <>
          {/* Period filter */}
          <div className="flex flex-wrap gap-2 items-center">
            {(['today','week','month','custom'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  period === p ? 'bg-amber-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-300'
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
            <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 animate-spin text-amber-500" /></div>
          ) : report ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-600">{t.income}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900">{fmt(report.income.total, currency)}</p>
                  <div className="flex gap-3 mt-2 text-xs text-slate-400">
                    <span>💵 {t.cash}: {fmt(report.income.cash, currency)}</span>
                    <span>💳 {t.card}: {fmt(report.income.card, currency)}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-600">{t.expenses}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900">{fmt(report.expenses.total, currency)}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(report.expenses.byCategory).map(([cat, amt]) => (
                      <span key={cat} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                        {t.categories[cat as keyof typeof t.categories] ?? cat}: {amt.toFixed(0)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={`rounded-2xl p-5 shadow-sm border ${report.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${report.netProfit >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
                      <DollarSign className={`w-4 h-4 ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`} />
                    </div>
                    <span className={`text-sm font-semibold ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{t.netProfit}</span>
                  </div>
                  <p className={`text-3xl font-extrabold ${profitColor}`}>{fmt(report.netProfit, currency)}</p>
                </div>
              </div>

              {achatsSummary && (
                <Link href="/admin/achats" className="block bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-violet-300 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-600 mb-1">Achats — Comptes fournisseurs</p>
                      <p className="text-xs text-slate-400">Dû aux fournisseurs / dépenses de la période</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Non payé</p>
                        <p className="font-bold text-amber-600">{fmt(achatsSummary.unpaidTotal, currency)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Dépensé</p>
                        <p className="font-bold text-slate-800">{fmt(achatsSummary.spendThisPeriod, currency)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {report.chart.length > 0 ? (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-700 mb-4">{t.chartTitle}</h3>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={report.chart}>
                        <defs>
                          <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="expense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number, name: string) => [
                          `${(v as number).toFixed(2)} ${currency}`,
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
                <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-100">{t.noData}</div>
              )}
            </>
          ) : null}

          {/* Expenses section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">{t.expensesList}</h2>
              <button onClick={() => { setShowForm(true); setFormErr('') }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-colors">
                <Plus className="w-4 h-4" /> {t.addExpense}
              </button>
            </div>

            {showForm && (
              <div className="px-5 py-4 bg-amber-50 border-b border-amber-100">
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
              <div className="divide-y divide-slate-100">
                {expenses.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                        {t.categories[exp.category as keyof typeof t.categories] ?? exp.category}
                      </span>
                      <span className="text-sm text-slate-700 truncate">{exp.description}</span>
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
        </>
      )}

      {/* ── PAYROLL TAB ── */}
      {tab === 'payroll' && (
        <div className="space-y-4">
          {/* Payroll header */}
          <div className="bg-gradient-to-r from-violet-600 to-violet-500 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{t.payrollTitle}</h2>
                <p className="text-violet-200 text-sm">{t.payrollSub}</p>
              </div>
            </div>
          </div>

          {/* Period + filter controls */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              {(['month','custom'] as const).map(p => (
                <button key={p} onClick={() => setPayrollPeriod(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    payrollPeriod === p ? 'bg-violet-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'
                  }`}>
                  {p === 'month' ? t.periods.month : t.periods.custom}
                </button>
              ))}
              {payrollPeriod === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={prFrom} onChange={e => setPrFrom(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <span className="text-slate-400">→</span>
                  <input type="date" value={prTo} onChange={e => setPrTo(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <button onClick={fetchPayroll}
                    className="px-4 py-2 bg-violet-500 text-white rounded-xl text-sm font-semibold">
                    {t.save}
                  </button>
                </div>
              )}
            </div>

            {/* Role filter */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {(['all','waiter','kitchen','other'] as const).map(f => (
                <button key={f} onClick={() => setPayrollFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    payrollFilter === f ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {f === 'all' ? t.filterAll : f === 'waiter' ? t.filterWaiter : f === 'kitchen' ? t.filterKitchen : t.filterOther}
                </button>
              ))}
            </div>
          </div>

          {/* Payroll cards */}
          {loadingPayroll ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-violet-500" /></div>
          ) : filteredPayroll.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-slate-400 border border-slate-100">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>{t.noStaff}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPayroll.map(member => {
                const isExpanded = expandedId === member.id
                const isApproved = approvedIds.has(member.id)
                return (
                  <div key={member.id} className={`bg-white rounded-2xl shadow-sm border transition-all ${
                    isApproved ? 'border-emerald-200' : 'border-slate-100'
                  }`}>
                    {/* Card header — always visible */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer select-none"
                      onClick={() => setExpandedId(isExpanded ? null : member.id)}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 font-bold text-base flex items-center justify-center shrink-0">
                        {member.name[0].toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{member.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[member.role] ?? 'bg-slate-100 text-slate-600'}`}>
                            {member.role}
                          </span>
                          {member.roles.map(r => (
                            <span key={r} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{r}</span>
                          ))}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${member.shiftStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {member.shiftStatus === 'ACTIVE' ? t.active : t.offDuty}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {member.attendanceDays}/{member.workingDays} {t.attendance}</span>
                          <span className="flex items-center gap-1 text-red-400"><AlertCircle className="w-3 h-3" /> {member.absenceDays} {t.absence}</span>
                          <span className="flex items-center gap-1 text-amber-400"><Clock className="w-3 h-3" /> {member.lateDays} {t.late}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-lg font-extrabold text-slate-900">{fmt(member.netSalary, currency)}</div>
                        <div className="text-xs text-slate-400">{t.netSalary}</div>
                      </div>

                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
                        {/* Daily rate editor */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm text-slate-500">{t.dailyRate}:</span>
                          {editingRate === member.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number" step="0.01" min="0" value={rateInput}
                                onChange={e => setRateInput(e.target.value)}
                                className="w-24 px-2 py-1 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                                autoFocus
                              />
                              <button onClick={() => saveRate(member.id)}
                                className="px-3 py-1 bg-violet-500 text-white rounded-lg text-xs font-semibold">{t.setRate}</button>
                              <button onClick={() => setEditingRate(null)}
                                className="p-1 text-slate-400 hover:text-red-400"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingRate(member.id); setRateInput(String(member.dailyRate)) }}
                              className="flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-800"
                            >
                              {member.dailyRate > 0 ? `${member.dailyRate} ${currency}` : '—'}
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Salary breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <SalaryLine label={t.baseSalary}   value={member.baseSalary}  currency={currency} color="text-slate-800" />
                          <SalaryLine label={t.commissions}  value={member.commissions} currency={currency} color="text-emerald-600" />
                          <SalaryLine label={t.deductions}   value={member.deductions}  currency={currency} color="text-red-500" sign="-" />
                          <SalaryLine label={t.netSalary}    value={member.netSalary}   currency={currency} color="text-violet-700" bold />
                        </div>

                        {/* Hours breakdown */}
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>⏱ {t.hours}: <strong className="text-slate-700">{member.totalHours}h</strong></span>
                          <span>📅 {t.workingDays}: <strong className="text-slate-700">{member.workingDays}</strong></span>
                        </div>

                        {/* Approve button */}
                        <button
                          onClick={() => setApprovedIds(prev => new Set([...prev, member.id]))}
                          disabled={isApproved}
                          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                              : 'bg-violet-500 hover:bg-violet-400 text-white active:scale-95'
                          }`}
                        >
                          {isApproved
                            ? <><CheckCircle className="w-4 h-4" /> {t.approved}</>
                            : <><DollarSign className="w-4 h-4" /> {t.approve} — {fmt(member.netSalary, currency)}</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── SalaryLine ────────────────────────────────────────────────────────────────

function SalaryLine({ label, value, currency, color, sign, bold }: {
  label: string; value: number; currency: string; color: string; sign?: string; bold?: boolean
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-sm ${bold ? 'text-base font-extrabold' : 'font-semibold'} ${color}`}>
        {sign}{value.toFixed(2)} {currency}
      </div>
    </div>
  )
}
