'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Receipt, Plus, Trash2, Edit3, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, Clock, XCircle, ExternalLink,
  TrendingDown, AlertTriangle, Wallet,
} from 'lucide-react'
import { useLang } from '../lang-context'

type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled'

interface SupplierInvoice {
  id:            string
  supplierName:  string
  invoiceNumber: string | null
  amount:        number
  amountPaid:    number
  currency:      string
  issueDate:     string
  dueDate:       string | null
  status:        InvoiceStatus
  documentUrl:   string | null
  notes:         string | null
}

interface SupplierPayment {
  id:       string
  amount:   number
  paidAt:   string
  method:   string
  notes:    string | null
}

interface Summary {
  unpaidTotal:    number
  overdueCount:   number
  paidThisMonth:  number
  total:          number
}

const T = {
  ar: {
    title: 'الفواتير', subtitle: 'تتبع فواتير الموردين والمدفوعات',
    add: 'إضافة فاتورة', refresh: 'تحديث', newInvoice: 'فاتورة جديدة', editInvoice: 'تعديل الفاتورة',
    save: 'حفظ', saving: 'جارٍ الحفظ…', cancel: 'إلغاء',
    totalInvoices: 'إجمالي الفواتير', unpaid: 'غير مدفوعة', overdue: 'متأخرة', paidMonth: 'مدفوعة هذا الشهر',
    all: 'الكل', unpaidTab: 'غير مدفوعة', overdueTab: 'متأخرة', paidTab: 'مدفوعة', cancelledTab: 'ملغاة',
    supplier: 'المورد *', invoiceNum: 'رقم الفاتورة', amount: 'المبلغ *', currency: 'العملة',
    issueDate: 'تاريخ الإصدار *', dueDate: 'تاريخ الاستحقاق', docUrl: 'رابط الوثيقة', notes: 'ملاحظات',
    status: 'الحالة', markPaid: '✓ مدفوعة', document: 'الوثيقة',
    issued: 'صدرت', due: 'استحقاق', empty: 'لا توجد فواتير', emptyFilter: ' في هذا الفلتر',
    deleteConfirm: 'حذف هذه الفاتورة؟',
    statusLabels: { unpaid: 'غير مدفوعة', overdue: 'متأخرة', paid: 'مدفوعة', cancelled: 'ملغاة' },
  },
  fr: {
    title: 'Factures', subtitle: 'Suivez vos factures fournisseurs et paiements',
    add: 'Ajouter', refresh: 'Actualiser', newInvoice: 'Nouvelle facture', editInvoice: 'Modifier la facture',
    save: 'Enregistrer', saving: 'Enregistrement…', cancel: 'Annuler',
    totalInvoices: 'Total factures', unpaid: 'Non payé', overdue: 'En retard', paidMonth: 'Payé ce mois',
    all: 'Toutes', unpaidTab: 'Non payées', overdueTab: 'En retard', paidTab: 'Payées', cancelledTab: 'Annulées',
    supplier: 'Fournisseur *', invoiceNum: 'N° Facture', amount: 'Montant *', currency: 'Devise',
    issueDate: 'Date facture *', dueDate: 'Échéance', docUrl: 'URL document', notes: 'Notes',
    status: 'Statut', markPaid: '✓ Payée', document: 'Document',
    issued: 'Émise', due: 'Échéance', empty: 'Aucune facture', emptyFilter: ' dans ce filtre',
    deleteConfirm: 'Supprimer cette facture ?',
    statusLabels: { unpaid: 'Non payée', overdue: 'En retard', paid: 'Payée', cancelled: 'Annulée' },
  },
  en: {
    title: 'Invoices', subtitle: 'Track your supplier invoices and payments',
    add: 'Add Invoice', refresh: 'Refresh', newInvoice: 'New Invoice', editInvoice: 'Edit Invoice',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel',
    totalInvoices: 'Total Invoices', unpaid: 'Unpaid', overdue: 'Overdue', paidMonth: 'Paid This Month',
    all: 'All', unpaidTab: 'Unpaid', overdueTab: 'Overdue', paidTab: 'Paid', cancelledTab: 'Cancelled',
    supplier: 'Supplier *', invoiceNum: 'Invoice #', amount: 'Amount *', currency: 'Currency',
    issueDate: 'Issue Date *', dueDate: 'Due Date', docUrl: 'Document URL', notes: 'Notes',
    status: 'Status', markPaid: '✓ Mark Paid', document: 'Document',
    issued: 'Issued', due: 'Due', empty: 'No invoices found', emptyFilter: ' for this filter',
    deleteConfirm: 'Delete this invoice?',
    statusLabels: { unpaid: 'Unpaid', overdue: 'Overdue', paid: 'Paid', cancelled: 'Cancelled' },
  },
  es: {
    title: 'Facturas', subtitle: 'Gestiona tus facturas de proveedores y pagos',
    add: 'Agregar', refresh: 'Actualizar', newInvoice: 'Nueva factura', editInvoice: 'Editar factura',
    save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar',
    totalInvoices: 'Total facturas', unpaid: 'Sin pagar', overdue: 'Vencidas', paidMonth: 'Pagado este mes',
    all: 'Todas', unpaidTab: 'Sin pagar', overdueTab: 'Vencidas', paidTab: 'Pagadas', cancelledTab: 'Canceladas',
    supplier: 'Proveedor *', invoiceNum: 'Nº Factura', amount: 'Monto *', currency: 'Divisa',
    issueDate: 'Fecha factura *', dueDate: 'Vencimiento', docUrl: 'URL documento', notes: 'Notas',
    status: 'Estado', markPaid: '✓ Pagada', document: 'Documento',
    issued: 'Emitida', due: 'Vence', empty: 'Sin facturas', emptyFilter: ' en este filtro',
    deleteConfirm: '¿Eliminar esta factura?',
    statusLabels: { unpaid: 'Sin pagar', overdue: 'Vencida', paid: 'Pagada', cancelled: 'Cancelada' },
  },
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

const STATUS_ICONS: Record<InvoiceStatus, React.ElementType> = {
  unpaid: Clock, partial: Wallet, overdue: AlertCircle, paid: CheckCircle2, cancelled: XCircle,
}
const STATUS_COLORS: Record<InvoiceStatus, { color: string; bg: string }> = {
  unpaid:    { color: 'text-amber-400',   bg: 'bg-amber-500/15'   },
  partial:   { color: 'text-sky-400',     bg: 'bg-sky-500/15'     },
  overdue:   { color: 'text-rose-400',    bg: 'bg-rose-500/15'    },
  paid:      { color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  cancelled: { color: 'text-slate-500',   bg: 'bg-slate-500/15'   },
}

const STATUSES: InvoiceStatus[] = ['unpaid', 'partial', 'overdue', 'paid', 'cancelled']

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(dueDate: string | null, status: InvoiceStatus) {
  if (!dueDate || status === 'paid' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}

const EMPTY_FORM = {
  supplierName: '', invoiceNumber: '', amount: '', currency: 'MAD',
  issueDate: '', dueDate: '', status: 'unpaid' as InvoiceStatus,
  documentUrl: '', notes: '',
}

type FilterTab = 'all' | InvoiceStatus

export default function InvoicesPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang]

  const [items,    setItems]    = useState<SupplierInvoice[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<SupplierInvoice | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

  const [payingId,  setPayingId]  = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payBusy,   setPayBusy]   = useState(false)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [history,   setHistory]   = useState<SupplierPayment[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/v1/invoices?status=${filter}`, { headers: authHeader() }),
        fetch('/api/v1/invoices/summary/stats',    { headers: authHeader() }),
      ])
      if (listRes.ok) setItems((await listRes.json()).items ?? [])
      if (sumRes.ok)  setSummary(await sumRes.json())
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const body = {
        ...form,
        amount:        form.amount    ? Number(form.amount) : undefined,
        dueDate:       form.dueDate   || null,
        invoiceNumber: form.invoiceNumber || null,
        documentUrl:   form.documentUrl   || null,
        notes:         form.notes         || null,
      }
      const url    = editItem ? `/api/v1/invoices/${editItem.id}` : '/api/v1/invoices'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setShowForm(false); setEditItem(null); setForm({ ...EMPTY_FORM }); await load() }
    } finally {
      setSaving(false)
    }
  }

  async function quickStatus(id: string, status: InvoiceStatus) {
    await fetch(`/api/v1/invoices/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  async function del(id: string) {
    if (!confirm(t.deleteConfirm)) return
    await fetch(`/api/v1/invoices/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }

  async function recordPayment(id: string) {
    if (!payAmount || Number(payAmount) <= 0) return
    setPayBusy(true)
    try {
      const res = await fetch(`/api/v1/invoices/${id}/payments`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(payAmount), method: payMethod }),
      })
      if (res.ok) { setPayingId(null); setPayAmount(''); await load() }
    } finally {
      setPayBusy(false)
    }
  }

  async function toggleHistory(id: string) {
    if (historyId === id) { setHistoryId(null); return }
    setHistoryId(id)
    const res = await fetch(`/api/v1/invoices/${id}/payments`, { headers: authHeader() })
    if (res.ok) setHistory((await res.json()).items ?? [])
  }

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: t.all         },
    { key: 'unpaid',    label: t.unpaidTab   },
    { key: 'overdue',   label: t.overdueTab  },
    { key: 'paid',      label: t.paidTab     },
    { key: 'cancelled', label: t.cancelledTab },
  ]

  const inputCls = 'w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-violet-500" size={36} />
      </div>
    )
  }

  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 p-6 shadow-xl shadow-violet-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.10),transparent_65%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Receipt className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t.title}</h1>
              <p className="text-sm text-violet-100/70 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} title={t.refresh} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => { setShowForm(true); setEditItem(null); setForm({ ...EMPTY_FORM }) }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-violet-700 text-sm font-bold hover:bg-violet-50 shadow-lg transition-colors"
            >
              <Plus size={15} /> {t.add}
            </button>
          </div>
        </div>

        {summary && (
          <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t.totalInvoices, value: summary.total,                          color: 'text-white',       icon: <Receipt size={14} className="text-white/60" /> },
              { label: t.unpaid,        value: `${summary.unpaidTotal.toLocaleString()} MAD`, color: 'text-amber-300',   icon: <TrendingDown size={14} className="text-amber-300/60" /> },
              { label: t.overdue,       value: summary.overdueCount,                   color: 'text-rose-300',    icon: <AlertTriangle size={14} className="text-rose-300/60" /> },
              { label: t.paidMonth,     value: `${summary.paidThisMonth.toLocaleString()} MAD`, color: 'text-emerald-300', icon: <Wallet size={14} className="text-emerald-300/60" /> },
            ].map(c => (
              <div key={c.label} className="bg-white/10 rounded-xl p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-1.5 mb-1">{c.icon}<p className="text-xs text-white/55 truncate">{c.label}</p></div>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Add/Edit form ── */}
      {showForm && (
        <div className="rounded-2xl border border-violet-500/30 bg-slate-800/80 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-violet-500/10 to-purple-500/5 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-violet-500/20"><Edit3 className="text-violet-400" size={16} /></div>
            <h2 className="text-base font-semibold text-white">{editItem ? t.editInvoice : t.newInvoice}</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: 'supplierName',  label: t.supplier,   type: 'text'   },
                { key: 'invoiceNumber', label: t.invoiceNum, type: 'text'   },
                { key: 'amount',        label: t.amount,     type: 'number' },
                { key: 'currency',      label: t.currency,   type: 'text'   },
                { key: 'issueDate',     label: t.issueDate,  type: 'date'   },
                { key: 'dueDate',       label: t.dueDate,    type: 'date'   },
                { key: 'documentUrl',   label: t.docUrl,     type: 'url'    },
              ] as { key: keyof typeof EMPTY_FORM; label: string; type: string }[]).map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key] as string}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.status}</label>
                <select
                  value={form.status}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value as InvoiceStatus }))}
                  className={inputCls}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s} className="bg-slate-800">{t.statusLabels[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.notes}</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className={inputCls}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={saving || !form.supplierName || !form.amount || !form.issueDate}
                className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : t.save}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditItem(null) }}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice list ── */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
          <Receipt className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 text-sm">{t.empty}{filter !== 'all' ? t.emptyFilter : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(inv => {
            const late      = isOverdue(inv.dueDate, inv.status)
            const effStatus = late ? 'overdue' : inv.status
            const { color, bg } = STATUS_COLORS[effStatus] ?? STATUS_COLORS.unpaid
            const StatusIcon    = STATUS_ICONS[effStatus]   ?? Clock

            return (
              <div key={inv.id} className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 flex items-center gap-4 flex-wrap hover:border-slate-600 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{inv.supplierName}</span>
                    {inv.invoiceNumber && <span className="text-xs text-slate-500">#{inv.invoiceNumber}</span>}
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${color} ${bg}`}>
                      <StatusIcon size={11} /> {t.statusLabels[effStatus]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-sm font-bold text-white">{inv.amount.toLocaleString('fr-FR')} {inv.currency}</span>
                    {inv.amountPaid > 0 && inv.amountPaid < inv.amount && (
                      <span className="text-xs text-sky-400">({inv.amountPaid.toFixed(2)} payé)</span>
                    )}
                    <span className="text-xs text-slate-400">{t.issued}: {fmt(inv.issueDate)}</span>
                    {inv.dueDate && (
                      <span className={`text-xs ${late ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>
                        {t.due}: {fmt(inv.dueDate)}{late ? ' ⚠️' : ''}
                      </span>
                    )}
                    {inv.documentUrl && (
                      <a href={inv.documentUrl} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-violet-400 hover:underline flex items-center gap-1">
                        <ExternalLink size={11} /> {t.document}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button
                      onClick={() => { setPayingId(payingId === inv.id ? null : inv.id); setPayAmount(String((inv.amount - inv.amountPaid).toFixed(2))) }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors"
                    >
                      💵 {(inv.amount - inv.amountPaid).toFixed(2)} {inv.currency}
                    </button>
                  )}
                  <button
                    onClick={() => toggleHistory(inv.id)}
                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white text-xs transition-colors"
                  >
                    {historyId === inv.id ? '▲' : '▼'}
                  </button>
                  <button
                    onClick={() => {
                      setEditItem(inv)
                      setForm({
                        supplierName:  inv.supplierName,
                        invoiceNumber: inv.invoiceNumber  ?? '',
                        amount:        String(inv.amount),
                        currency:      inv.currency,
                        issueDate:     inv.issueDate.slice(0, 10),
                        dueDate:       inv.dueDate ? inv.dueDate.slice(0, 10) : '',
                        status:        inv.status,
                        documentUrl:   inv.documentUrl ?? '',
                        notes:         inv.notes       ?? '',
                      })
                      setShowForm(true)
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => del(inv.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {payingId === inv.id && (
                  <div className="w-full mt-3 pt-3 border-t border-slate-700 flex items-center gap-2 flex-wrap">
                    <input
                      type="number" min={0} step={0.01}
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="w-28 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm"
                    />
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                      className="bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm">
                      <option value="cash" className="bg-slate-800">Cash</option>
                      <option value="card" className="bg-slate-800">Card</option>
                      <option value="virement" className="bg-slate-800">Virement</option>
                    </select>
                    <button onClick={() => recordPayment(inv.id)} disabled={payBusy}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-semibold">
                      {payBusy ? <Loader2 size={14} className="animate-spin" /> : 'Enregistrer le paiement'}
                    </button>
                  </div>
                )}

                {historyId === inv.id && (
                  <div className="w-full mt-3 pt-3 border-t border-slate-700 space-y-1">
                    {history.length === 0 ? (
                      <p className="text-xs text-slate-500">Aucun paiement enregistré.</p>
                    ) : history.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs text-slate-400">
                        <span>{fmt(p.paidAt)} · {p.method}</span>
                        <span className="font-mono text-white">{p.amount.toFixed(2)} {inv.currency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
