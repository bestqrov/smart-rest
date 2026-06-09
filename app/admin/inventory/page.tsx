'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Package, Lock, Sparkles, Search, Plus, RefreshCw,
  AlertTriangle, CheckCircle2, TrendingDown, Truck,
  ChevronRight, X, BarChart3, Bell, ArrowUpRight,
  Edit3, Trash2, Loader2, PackageX, ClipboardList
} from 'lucide-react'
import { useLang } from '../lang-context'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockItem {
  id:               string
  ingredientName:   string
  unit:             string
  currentQty:       number
  minimumThreshold: number
  costPerUnit:      number
  isLow:            boolean
  lastRestockedAt:  string | null
  updatedAt:        string
}

interface CafeGate {
  isSmartInventoryEnabled: boolean
}

interface Notification {
  id:        string
  type:      string
  title:     string
  body:      string
  isRead:    boolean
  createdAt: string
}

// ── Paywall ───────────────────────────────────────────────────────────────────

function InventoryPaywall({ lang }: { lang: string }) {
  const isAr = lang === 'ar'
  const isFr = lang === 'fr'
  const L = (ar: string, fr: string, en: string) =>
    isAr ? ar : isFr ? fr : en

  // 'idle' | 'loading' | 'pending' | 'done' | 'error'
  const [requestState, setRequestState] = useState<'idle' | 'loading' | 'pending' | 'error'>('idle')

  function auth() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

  // Check if a request was already sent on mount
  useEffect(() => {
    fetch('/api/v1/inventory/activation-status', { headers: auth() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.inventoryActivationRequested) setRequestState('pending')
      })
  }, [])

  async function handleRequest() {
    setRequestState('loading')
    try {
      const res  = await fetch('/api/v1/inventory/request-activation', {
        method:  'POST',
        headers: auth()
      })
      const data = await res.json()
      if (data.alreadyRequested || data.requested) {
        setRequestState('pending')
      } else {
        setRequestState('error')
      }
    } catch {
      setRequestState('error')
    }
  }

  const benefits = [
    { icon: '📦', title: L('تتبع المخزون آلياً', 'Suivi automatique', 'Auto Stock Tracking'),         desc: L('يُخفَّض المخزون تلقائياً مع كل طلب', 'Déduit à chaque commande', 'Auto-deducted on every order') },
    { icon: '🚨', title: L('تنبيهات نقص فوري', 'Alertes stock faible', 'Instant Low-Stock Alerts'),    desc: L('إشعار فوري عند الوصول للحد الأدنى', 'Notification sous le seuil', 'Alert when hitting minimum') },
    { icon: '🤝', title: L('إدارة الموردين', 'Gestion fournisseurs', 'Supplier Management'),            desc: L('أضف موردينك وأرسل طلبات عبر واتساب', 'Bons de commande WhatsApp', 'POs sent via WhatsApp') },
    { icon: '🤖', title: L('أتمتة n8n / واتساب', 'Automatisation n8n', 'n8n / WhatsApp Automation'),   desc: L('تدفق أتمتة كامل للمورد تلقائياً', 'Envoi automatique fournisseur', 'Auto-sends to your supplier') },
  ]

  const isPending = requestState === 'pending'

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
      <div className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-white/20">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f2027] via-[#1a3a4a] to-[#0d1f2d]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_60%)]" />

        <div className="relative p-8 md:p-12 text-center">
          {/* Badge */}
          <div className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-6 border ${
            isPending
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {isPending ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {isPending
              ? L('الطلب قيد المراجعة', 'Demande en cours', 'Request Under Review')
              : L('ميزة مدفوعة', 'Fonctionnalité Premium', 'Premium Feature')
            }
          </div>

          {/* Icon */}
          <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
            isPending
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
              : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
          }`}>
            <Package className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-3">
            {L('إدارة المخزون الذكي', 'Gestion Intelligente des Stocks', 'Smart Inventory')}
          </h1>
          <p className="text-gray-400 text-base mb-8 max-w-md mx-auto">
            {isPending
              ? L(
                  'تم إرسال طلبك بنجاح. سيقوم فريق Smart Resto بمراجعته وتفعيل الميزة خلال 24 ساعة.',
                  "Votre demande a été envoyée. L'équipe Smart Resto l'examinera et activera la fonctionnalité sous 24h.",
                  'Your request was sent. The Smart Resto team will review and activate it within 24h.'
                )
              : L(
                  'أوقف هدر الطعام إلى الأبد. تتبع مخزونك، أدر موردينك، وأرسل طلبات الشراء تلقائياً.',
                  "Éliminez le gaspillage. Suivez votre stock, gérez vos fournisseurs, envoyez des bons de commande.",
                  'Eliminate food waste. Track stock, manage suppliers, auto-send purchase orders.'
                )
            }
          </p>

          {/* Benefits */}
          {!isPending && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 text-left">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
                  <span className="text-2xl shrink-0">{b.icon}</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{b.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending state visual */}
          {isPending && (
            <div className="mb-10 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-6 py-4">
                <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-300 text-sm font-medium">
                  {L('بانتظار موافقة المسؤول', "En attente d'approbation", 'Awaiting admin approval')}
                </span>
              </div>
              <p className="text-gray-600 text-xs">
                {L('سيتم إشعارك فور التفعيل', 'Vous serez notifié dès l\'activation', "You'll be notified once activated")}
              </p>
            </div>
          )}

          {/* CTA Button */}
          {!isPending ? (
            <button
              onClick={handleRequest}
              disabled={requestState === 'loading'}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 text-white font-bold px-8 py-4 rounded-2xl text-lg shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              {requestState === 'loading'
                ? <><Loader2 className="w-5 h-5 animate-spin" /> {L('جارٍ الإرسال...', 'Envoi...', 'Sending...')}</>
                : <><Sparkles className="w-5 h-5" /> {L('طلب تفعيل الميزة', "Demander l'activation", 'Request Activation')} <ArrowUpRight className="w-4 h-4" /></>
              }
            </button>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold px-8 py-4 rounded-2xl text-lg cursor-not-allowed"
            >
              <CheckCircle2 className="w-5 h-5" />
              {L('الطلب مُرسل — بانتظار الموافقة', 'Demande envoyée — en attente', 'Request Sent — Awaiting Approval')}
            </button>
          )}

          {requestState === 'error' && (
            <p className="text-red-400 text-xs mt-3">
              {L('حدث خطأ، حاول مجدداً', 'Erreur, réessayez', 'An error occurred, please try again')}
            </p>
          )}

          {!isPending && (
            <p className="text-gray-600 text-xs mt-4">
              {L('سيتم مراجعة طلبك وتفعيل الميزة خلال 24 ساعة', "Délai d'activation: 24h", 'Activation within 24h after approval')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stock Status Badge ────────────────────────────────────────────────────────

function StockBadge({ item }: { item: StockItem }) {
  if (item.isLow) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
        <AlertTriangle className="w-3 h-3" /> Low Stock
      </span>
    )
  }
  if (item.currentQty === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
        <PackageX className="w-3 h-3" /> Out of Stock
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" /> OK
    </span>
  )
}

// ── Adjust Stock Modal ────────────────────────────────────────────────────────

function AdjustStockModal({
  item, onClose, onSave, lang
}: {
  item: StockItem
  onClose: () => void
  onSave: (id: string, newQty: number) => Promise<void>
  lang: string
}) {
  const [qty,     setQty]     = useState(item.currentQty)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    await onSave(item.id, qty)
    setLoading(false)
    onClose()
  }

  const L = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-lg">
            {L('تعديل الكمية', 'Ajuster le stock', 'Adjust Stock')}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-1">{item.ingredientName}</p>
        <p className="text-xs text-gray-400 mb-4">
          {L('الحد الأدنى', 'Seuil min.', 'Min threshold')}: {item.minimumThreshold} {item.unit}
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          {L('الكمية الحالية', 'Quantité actuelle', 'Current quantity')} ({item.unit})
        </label>
        <input
          type="number"
          min={0}
          step={0.1}
          value={qty}
          onChange={e => setQty(parseFloat(e.target.value) || 0)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg font-mono mb-5"
        />

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">
            {L('إلغاء', 'Annuler', 'Cancel')}
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {L('حفظ', 'Enregistrer', 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Item Modal ────────────────────────────────────────────────────────────

function AddItemModal({
  onClose, onAdd, lang
}: {
  onClose: () => void
  onAdd: (data: Omit<StockItem, 'id' | 'isLow' | 'lastRestockedAt' | 'updatedAt'>) => Promise<void>
  lang: string
}) {
  const [form, setForm] = useState({
    ingredientName: '', unit: 'g', currentQty: 0, minimumThreshold: 0, costPerUnit: 0
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const L = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en

  async function handleAdd() {
    if (!form.ingredientName.trim()) { setError(L('اسم المادة مطلوب', 'Nom requis', 'Name is required')); return }
    setLoading(true)
    setError('')
    try {
      await onAdd(form)
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-lg">
            {L('إضافة مادة جديدة', 'Ajouter un ingrédient', 'Add Ingredient')}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {L('اسم المادة', 'Nom de l\'ingrédient', 'Ingredient Name')}
            </label>
            <input
              value={form.ingredientName}
              onChange={e => setForm(f => ({ ...f, ingredientName: e.target.value }))}
              placeholder={L('مثال: طماطم', 'Ex: Tomates', 'e.g. Tomatoes')}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {L('الوحدة', 'Unité', 'Unit')}
            </label>
            <select
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
            >
              {['g', 'kg', 'ml', 'L', 'pcs'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'currentQty',       label: L('الكمية الحالية', 'Qté actuelle', 'Current Qty') },
              { key: 'minimumThreshold', label: L('الحد الأدنى', 'Seuil min.', 'Min Threshold') },
              { key: 'costPerUnit',      label: L('تكلفة/وحدة', 'Coût/unité', 'Cost/unit') },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{field.label}</label>
                <input
                  type="number" min={0} step={0.01}
                  value={(form as any)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">
            {L('إلغاء', 'Annuler', 'Cancel')}
          </button>
          <button onClick={handleAdd} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {L('إضافة', 'Ajouter', 'Add')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { lang } = useLang()
  const isAr     = lang === 'ar'
  const isFr     = lang === 'fr'

  const L = (ar: string, fr: string, en: string) =>
    isAr ? ar : isFr ? fr : en

  const [gateEnabled, setGateEnabled] = useState<boolean | null>(null)
  const [items,       setItems]       = useState<StockItem[]>([])
  const [notifs,      setNotifs]      = useState<Notification[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [adjustItem,  setAdjustItem]  = useState<StockItem | null>(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [deleting,    setDeleting]    = useState<string | null>(null)

  function auth() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // Check gate first via profile
      const profile = await fetch('/api/admin/cafe/profile', { headers: auth() }).then(r => r.ok ? r.json() : null)
      const enabled  = profile?.isSmartInventoryEnabled ?? false
      setGateEnabled(enabled)

      if (enabled) {
        const [itemsRes, notifsRes] = await Promise.all([
          fetch('/api/v1/inventory/stock', { headers: auth() }).then(r => r.ok ? r.json() : []),
          fetch('/api/v1/inventory/notifications', { headers: auth() }).then(r => r.ok ? r.json() : [])
        ])
        setItems(itemsRes)
        setNotifs(notifsRes)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleAdjust(id: string, newQty: number) {
    await fetch(`/api/v1/inventory/stock/${id}`, {
      method:  'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ currentQty: newQty })
    })
    await fetchAll()
  }

  async function handleAdd(data: any) {
    const res = await fetch('/api/v1/inventory/stock', {
      method:  'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to create')
    }
    await fetchAll()
  }

  async function handleDelete(id: string) {
    if (!confirm(L('هل أنت متأكد؟', 'Êtes-vous sûr ?', 'Are you sure?'))) return
    setDeleting(id)
    await fetch(`/api/v1/inventory/stock/${id}`, { method: 'DELETE', headers: auth() })
    setDeleting(null)
    await fetchAll()
  }

  async function handleMarkAllRead() {
    await fetch('/api/v1/inventory/notifications/read-all', { method: 'POST', headers: auth() })
    setNotifs([])
  }

  // Loading skeleton
  if (gateEnabled === null || loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded-xl w-48" />
          <div className="h-4 bg-gray-100 rounded-xl w-80" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  // Paywall
  if (!gateEnabled) return <InventoryPaywall lang={lang} />

  const filtered  = items.filter(i => i.ingredientName.toLowerCase().includes(search.toLowerCase()))
  const lowCount  = items.filter(i => i.isLow).length
  const totalValue = items.reduce((sum, i) => sum + i.currentQty * i.costPerUnit, 0)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="font-extrabold text-gray-900 text-xl">
              {L('المخزون الذكي', 'Inventaire Intelligent', 'Smart Inventory')}
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {L('تتبع وإدارة مخزون مطبخك', 'Suivez et gérez votre stock cuisine', 'Track and manage your kitchen stock')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchAll}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/admin/inventory/suppliers"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            <Truck className="w-4 h-4" />
            {L('الموردون', 'Fournisseurs', 'Suppliers')}
          </Link>
          <Link href="/admin/inventory/purchase-orders"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            <ClipboardList className="w-4 h-4" />
            {L('طلبات الشراء', 'Bons de commande', 'Purchase Orders')}
          </Link>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
            <Plus className="w-4 h-4" />
            {L('إضافة مادة', 'Ajouter', 'Add Item')}
          </button>
        </div>
      </div>

      {/* ── Unread notifications ─────────────────────────────────────── */}
      {notifs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
              <Bell className="w-4 h-4" />
              {notifs.length} {L('تنبيهات نقص مخزون', 'alertes stock faible', 'low-stock alerts')}
            </div>
            <button onClick={handleMarkAllRead} className="text-xs text-red-500 hover:underline">
              {L('تحديد الكل كمقروء', 'Tout marquer lu', 'Mark all read')}
            </button>
          </div>
          <div className="space-y-2">
            {notifs.slice(0, 3).map(n => (
              <div key={n.id} className="flex items-start gap-2 bg-white rounded-xl p-3 border border-red-100">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: L('إجمالي المواد', 'Total ingrédients', 'Total Items'),
            value: items.length,
            color: 'bg-blue-50 text-blue-700',
            icon:  <Package className="w-5 h-5" />
          },
          {
            label: L('نقص المخزون', 'Stock faible', 'Low Stock'),
            value: lowCount,
            color: lowCount > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700',
            icon:  <AlertTriangle className="w-5 h-5" />
          },
          {
            label: L('مواد كافية', 'Stock OK', 'Items OK'),
            value: items.length - lowCount,
            color: 'bg-emerald-50 text-emerald-700',
            icon:  <CheckCircle2 className="w-5 h-5" />
          },
          {
            label: L('قيمة المخزون', 'Valeur du stock', 'Stock Value'),
            value: totalValue.toFixed(2),
            color: 'bg-purple-50 text-purple-700',
            icon:  <BarChart3 className="w-5 h-5" />
          },
        ].map((stat, i) => (
          <div key={i} className={`${stat.color} rounded-2xl p-4 flex items-center gap-3`}>
            <div className="opacity-80">{stat.icon}</div>
            <div>
              <p className="text-2xl font-extrabold">{stat.value}</p>
              <p className="text-xs font-medium opacity-80">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + table ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b border-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={L('بحث في المواد...', 'Rechercher...', 'Search ingredients...')}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {search
                ? L('لا توجد نتائج', 'Aucun résultat', 'No results found')
                : L('لا توجد مواد بعد — أضف أولى مكوناتك', 'Aucun ingrédient — ajoutez le premier', 'No ingredients yet — add your first one')
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="text-left px-4 py-3">{L('المادة', 'Ingrédient', 'Ingredient')}</th>
                  <th className="text-center px-4 py-3">{L('الكمية', 'Quantité', 'Qty')}</th>
                  <th className="text-center px-4 py-3">{L('الحد الأدنى', 'Seuil min.', 'Min')}</th>
                  <th className="text-center px-4 py-3">{L('التكلفة', 'Coût/u', 'Cost/u')}</th>
                  <th className="text-center px-4 py-3">{L('الحالة', 'Statut', 'Status')}</th>
                  <th className="text-center px-4 py-3">{L('إجراءات', 'Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50/50 transition-colors ${item.isLow ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="px-4 py-3.5 font-semibold text-gray-900">
                      {item.ingredientName}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono">
                      <span className={`font-bold ${item.isLow ? 'text-red-600' : 'text-gray-800'}`}>
                        {item.currentQty.toFixed(1)}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono text-gray-500">
                      {item.minimumThreshold} <span className="text-xs">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono text-gray-600">
                      {item.costPerUnit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StockBadge item={item} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setAdjustItem(item)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title={L('تعديل الكمية', 'Ajuster', 'Adjust')}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                          title={L('حذف', 'Supprimer', 'Delete')}
                        >
                          {deleting === item.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recipe builder hint ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">
            {L('ربط الوصفات بالمخزون', 'Lier les recettes au stock', 'Link Recipes to Stock')}
          </p>
          <p className="text-gray-500 text-xs mt-0.5">
            {L(
              'استخدم "وضع الوصفة الذكية" في صفحة الهوامش لربط كل منتج بمكوناته — سيُخصم المخزون تلقائياً مع كل طلب.',
              'Utilisez le "mode recette intelligente" dans la page marges pour lier chaque produit à ses ingrédients.',
              'Use "Smart Costing" mode in the Margins page to link each product to its ingredients — stock deducts automatically per order.'
            )}
          </p>
        </div>
        <Link href="/admin/margins"
          className="flex items-center gap-1 text-emerald-700 text-sm font-semibold hover:underline shrink-0">
          {L('الهوامش', 'Marges', 'Margins')} <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {adjustItem && (
        <AdjustStockModal
          item={adjustItem}
          lang={lang}
          onClose={() => setAdjustItem(null)}
          onSave={handleAdjust}
        />
      )}

      {showAdd && (
        <AddItemModal
          lang={lang}
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
