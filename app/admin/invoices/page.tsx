'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  FileText, Plus, Trash2, Edit3, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, Clock, XCircle, ExternalLink
} from 'lucide-react'
import { useLang } from '../lang-context'

type InvoiceStatus = 'unpaid' | 'paid' | 'overdue' | 'cancelled'

interface SupplierInvoice {
  id:            string
  supplierName:  string
  invoiceNumber: string | null
  amount:        number
  currency:      string
  issueDate:     string
  dueDate:       string | null
  status:        InvoiceStatus
  documentUrl:   string | null
  notes:         string | null
}

interface Summary {
  unpaidTotal:    number
  overdueCount:   number
  paidThisMonth:  number
  total:          number
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

const STATUS_META: Record<InvoiceStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  unpaid:    { label: 'Non payée',  color: 'text-amber-400',   bg: 'bg-amber-500/15',   Icon: Clock        },
  overdue:   { label: 'En retard',  color: 'text-rose-400',    bg: 'bg-rose-500/15',    Icon: AlertCircle  },
  paid:      { label: 'Payée',      color: 'text-emerald-400', bg: 'bg-emerald-500/15', Icon: CheckCircle2 },
  cancelled: { label: 'Annulée',    color: 'text-slate-500',   bg: 'bg-slate-500/15',   Icon: XCircle      },
}

const STATUSES: InvoiceStatus[] = ['unpaid', 'overdue', 'paid', 'cancelled']

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
  const { isRTL } = useLang()

  const [items,    setItems]    = useState<SupplierInvoice[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<SupplierInvoice | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

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
    if (!confirm('Supprimer cette facture ?')) return
    await fetch(`/api/v1/invoices/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'Toutes'      },
    { key: 'unpaid',    label: 'Non payées'  },
    { key: 'overdue',   label: 'En retard'   },
    { key: 'paid',      label: 'Payées'      },
    { key: 'cancelled', label: 'Annulées'    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    )
  }

  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10">
            <FileText className="text-violet-400" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Fawatir — Factures</h1>
            <p className="text-sm text-slate-400 mt-0.5">Suivez vos factures fournisseurs.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setShowForm(true); setEditItem(null); setForm({ ...EMPTY_FORM }) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Total factures</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs text-slate-400">Non payé</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{summary.unpaidTotal.toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-xs text-slate-400">En retard</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{summary.overdueCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs text-slate-400">Payé ce mois</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.paidThisMonth.toLocaleString('fr-FR')}</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === t.key
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editItem ? 'Modifier la facture' : 'Nouvelle facture'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { key: 'supplierName',  label: 'Fournisseur *', type: 'text'   },
              { key: 'invoiceNumber', label: 'N° Facture',    type: 'text'   },
              { key: 'amount',        label: 'Montant *',     type: 'number' },
              { key: 'currency',      label: 'Devise',        type: 'text'   },
              { key: 'issueDate',     label: 'Date facture *',type: 'date'   },
              { key: 'dueDate',       label: 'Échéance',      type: 'date'   },
              { key: 'documentUrl',   label: 'URL document',  type: 'url'    },
            ] as { key: keyof typeof EMPTY_FORM; label: string; type: string }[]).map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key] as string}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Statut</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value as InvoiceStatus }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s} className="bg-slate-800">{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving || !form.supplierName || !form.amount || !form.issueDate}
              className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditItem(null) }}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
          <FileText className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 text-sm">Aucune facture{filter !== 'all' ? ' dans ce filtre' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(inv => {
            const late = isOverdue(inv.dueDate, inv.status)
            const meta = STATUS_META[late ? 'overdue' : inv.status] ?? STATUS_META.unpaid
            const StatusIcon = meta.Icon

            return (
              <div key={inv.id} className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{inv.supplierName}</span>
                    {inv.invoiceNumber && <span className="text-xs text-slate-500">#{inv.invoiceNumber}</span>}
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color} ${meta.bg}`}>
                      <StatusIcon size={11} /> {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-sm font-bold text-white">{inv.amount.toLocaleString('fr-FR')} {inv.currency}</span>
                    <span className="text-xs text-slate-400">Émise: {fmt(inv.issueDate)}</span>
                    {inv.dueDate && (
                      <span className={`text-xs ${late ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>
                        Échéance: {fmt(inv.dueDate)}{late ? ' ⚠️' : ''}
                      </span>
                    )}
                    {inv.documentUrl && (
                      <a href={inv.documentUrl} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-violet-400 hover:underline flex items-center gap-1">
                        <ExternalLink size={11} /> Document
                      </a>
                    )}
                  </div>
                </div>

                {/* Quick status toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button
                      onClick={() => quickStatus(inv.id, 'paid')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors"
                    >
                      ✓ Payée
                    </button>
                  )}
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
