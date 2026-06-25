'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ShoppingCart, Plus, Trash2, Edit3, Loader2, RefreshCw,
  CheckCircle2, Clock, Package, XCircle, ChevronRight
} from 'lucide-react'
import { useLang } from '../lang-context'

type ReqStatus  = 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled'
type ReqUrgency = 'low' | 'normal' | 'high' | 'urgent'

interface PurchaseRequisition {
  id:             string
  itemName:       string
  quantity:       number
  unit:           string
  estimatedPrice: number | null
  urgency:        ReqUrgency
  requestedBy:    string
  notes:          string | null
  status:         ReqStatus
  approvedAt:     string | null
  createdAt:      string
}

interface Summary {
  pending:           number
  urgentPending:     number
  ordered:           number
  receivedThisMonth: number
  total:             number
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

const STATUS_META: Record<ReqStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  pending:   { label: 'En attente', color: 'text-amber-400',   bg: 'bg-amber-500/15',   Icon: Clock        },
  approved:  { label: 'Approuvé',   color: 'text-blue-400',    bg: 'bg-blue-500/15',    Icon: CheckCircle2 },
  ordered:   { label: 'Commandé',   color: 'text-violet-400',  bg: 'bg-violet-500/15',  Icon: Package      },
  received:  { label: 'Reçu',       color: 'text-emerald-400', bg: 'bg-emerald-500/15', Icon: CheckCircle2 },
  cancelled: { label: 'Annulé',     color: 'text-slate-500',   bg: 'bg-slate-500/15',   Icon: XCircle      },
}

const URGENCY_META: Record<ReqUrgency, { label: string; color: string; bg: string }> = {
  low:    { label: 'Faible',  color: 'text-slate-400',   bg: 'bg-slate-500/15'  },
  normal: { label: 'Normal',  color: 'text-blue-400',    bg: 'bg-blue-500/15'   },
  high:   { label: 'Élevée',  color: 'text-amber-400',   bg: 'bg-amber-500/15'  },
  urgent: { label: 'Urgent',  color: 'text-rose-400',    bg: 'bg-rose-500/15'   },
}

const NEXT_STATUS: Partial<Record<ReqStatus, { next: ReqStatus; label: string }>> = {
  pending:  { next: 'approved', label: 'Approuver'  },
  approved: { next: 'ordered',  label: 'Commander'  },
  ordered:  { next: 'received', label: 'Reçu ✓'     },
}

const UNITS = ['units', 'kg', 'L', 'boxes', 'other']
type FilterTab = 'all' | ReqStatus

const EMPTY_FORM = {
  itemName: '', quantity: '', unit: 'units', estimatedPrice: '',
  urgency: 'normal' as ReqUrgency, requestedBy: '', notes: '',
}

export default function RequisitionsPage() {
  const { isRTL } = useLang()

  const [items,    setItems]    = useState<PurchaseRequisition[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<PurchaseRequisition | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/v1/requisitions?status=${filter}`, { headers: authHeader() }),
        fetch('/api/v1/requisitions/summary/stats',    { headers: authHeader() }),
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
        quantity:       form.quantity       ? Number(form.quantity)       : undefined,
        estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : null,
        notes:          form.notes          || null,
      }
      const url    = editItem ? `/api/v1/requisitions/${editItem.id}` : '/api/v1/requisitions'
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

  async function advanceStatus(id: string, next: ReqStatus) {
    await fetch(`/api/v1/requisitions/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    await load()
  }

  async function cancel(id: string) {
    if (!confirm('Annuler cette demande ?')) return
    await fetch(`/api/v1/requisitions/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    await load()
  }

  async function del(id: string) {
    if (!confirm('Supprimer cette demande ?')) return
    await fetch(`/api/v1/requisitions/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'Toutes'     },
    { key: 'pending',   label: 'En attente' },
    { key: 'approved',  label: 'Approuvés'  },
    { key: 'ordered',   label: 'Commandés'  },
    { key: 'received',  label: 'Reçus'      },
    { key: 'cancelled', label: 'Annulés'    },
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
          <div className="p-2 rounded-xl bg-teal-500/10">
            <ShoppingCart className="text-teal-400" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">I7tiyajat — Besoins</h1>
            <p className="text-sm text-slate-400 mt-0.5">Gérez vos demandes d&apos;achat.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setShowForm(true); setEditItem(null); setForm({ ...EMPTY_FORM }) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs text-slate-400">En attente</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{summary.pending}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-xs text-slate-400">Urgent en attente</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{summary.urgentPending}</p>
          </div>
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
            <p className="text-xs text-slate-400">En transit</p>
            <p className="text-2xl font-bold text-violet-400 mt-1">{summary.ordered}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs text-slate-400">Reçus ce mois</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.receivedThisMonth}</p>
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
                ? 'bg-teal-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editItem ? 'Modifier la demande' : 'Nouvelle demande'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { key: 'itemName',       label: 'Article *',          type: 'text'   },
              { key: 'requestedBy',    label: 'Demandé par *',      type: 'text'   },
              { key: 'quantity',       label: 'Quantité *',         type: 'number' },
              { key: 'estimatedPrice', label: 'Prix estimé (MAD)',  type: 'number' },
            ] as { key: keyof typeof EMPTY_FORM; label: string; type: string }[]).map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key] as string}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Unité</label>
              <select
                value={form.unit}
                onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {UNITS.map(u => <option key={u} value={u} className="bg-slate-800">{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Urgence</label>
              <select
                value={form.urgency}
                onChange={e => setForm(prev => ({ ...prev, urgency: e.target.value as ReqUrgency }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {(Object.keys(URGENCY_META) as ReqUrgency[]).map(u => (
                  <option key={u} value={u} className="bg-slate-800">{URGENCY_META[u].label}</option>
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
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving || !form.itemName || !form.quantity || !form.requestedBy}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
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

      {/* Requisition list */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
          <ShoppingCart className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 text-sm">Aucune demande{filter !== 'all' ? ' dans ce filtre' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(req => {
            const sMeta    = STATUS_META[req.status]   ?? STATUS_META.pending
            const uMeta    = URGENCY_META[req.urgency] ?? URGENCY_META.normal
            const StatusIcon = sMeta.Icon
            const nextStep = NEXT_STATUS[req.status]

            return (
              <div key={req.id} className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{req.itemName}</span>
                    <span className="text-xs text-slate-400">{req.quantity} {req.unit}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${uMeta.color} ${uMeta.bg}`}>
                      {uMeta.label}
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sMeta.color} ${sMeta.bg}`}>
                      <StatusIcon size={11} /> {sMeta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400">👤 {req.requestedBy}</span>
                    {req.estimatedPrice != null && (
                      <span className="text-xs text-slate-400">~{req.estimatedPrice.toLocaleString('fr-FR')} MAD</span>
                    )}
                    {req.notes && <span className="text-xs text-slate-500 truncate max-w-[200px]">{req.notes}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {nextStep && (
                    <button
                      onClick={() => advanceStatus(req.id, nextStep.next)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/30 text-teal-400 text-xs font-semibold transition-colors"
                    >
                      {nextStep.label} <ChevronRight size={12} />
                    </button>
                  )}
                  {req.status !== 'received' && req.status !== 'cancelled' && (
                    <button
                      onClick={() => cancel(req.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Annuler"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditItem(req)
                      setForm({
                        itemName:       req.itemName,
                        quantity:       String(req.quantity),
                        unit:           req.unit,
                        estimatedPrice: req.estimatedPrice != null ? String(req.estimatedPrice) : '',
                        urgency:        req.urgency,
                        requestedBy:    req.requestedBy,
                        notes:          req.notes ?? '',
                      })
                      setShowForm(true)
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => del(req.id)}
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
