'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ClipboardList, Plus, ArrowLeft, X, CheckCircle2,
  Clock, Package, Truck, Loader2, ChevronDown,
  MessageCircle, RefreshCw, ExternalLink, AlertCircle
} from 'lucide-react'
import { useLang } from '../../lang-context'

// ── Types ─────────────────────────────────────────────────────────────────────

interface POItem {
  stockItemName:   string
  unit:            string
  quantityOrdered: number
  unitCost:        number
  totalCost:       number
}

interface PurchaseOrder {
  id:             string
  status:         string
  notes:          string
  totalCost:      number
  sentViaWhatsApp: boolean
  sentAt:         string | null
  createdAt:      string
  supplier: {
    id:    string
    name:  string
    phone: string
    email: string
  }
  items: POItem[]
}

interface Supplier {
  id:    string
  name:  string
  phone: string
}

interface StockItem {
  id:            string
  ingredientName: string
  unit:          string
  currentQty:    number
  minimumThreshold: number
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function POStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: <Clock className="w-3 h-3" /> },
    ordered:   { label: 'Ordered',   color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: <Truck className="w-3 h-3" /> },
    received:  { label: 'Received',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500 border-gray-200',     icon: <X className="w-3 h-3" /> },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${s.color}`}>
      {s.icon} {s.label}
    </span>
  )
}

// ── Create PO Modal ───────────────────────────────────────────────────────────

function CreatePOModal({
  suppliers, stockItems, onClose, onSave, lang, prefillLine
}: {
  suppliers:  Supplier[]
  stockItems: StockItem[]
  onClose:    () => void
  onSave:     (data: { supplierId: string; notes: string; items: Omit<POItem, 'totalCost'>[] }) => Promise<void>
  lang:       string
  prefillLine?: { stockItemName: string; unit: string; quantityOrdered: number; unitCost: number }
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '')
  const [notes,      setNotes]      = useState('')
  const [lines, setLines] = useState<{ stockItemName: string; unit: string; quantityOrdered: number; unitCost: number }[]>([
    prefillLine ?? { stockItemName: '', unit: 'kg', quantityOrdered: 1, unitCost: 0 }
  ])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const L = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en

  function addLine() {
    setLines(l => [...l, { stockItemName: '', unit: 'kg', quantityOrdered: 1, unitCost: 0 }])
  }

  function removeLine(i: number) {
    setLines(l => l.filter((_, idx) => idx !== i))
  }

  function updateLine(i: number, key: string, val: any) {
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [key]: val } : line))
  }

  function autoFillFromStock(i: number, ingredientName: string) {
    const match = stockItems.find(s => s.ingredientName === ingredientName)
    if (match) updateLine(i, 'unit', match.unit)
  }

  const total = lines.reduce((sum, l) => sum + l.quantityOrdered * l.unitCost, 0)

  async function handleSave() {
    if (!supplierId) { setError(L('اختر مورداً', 'Choisissez un fournisseur', 'Choose a supplier')); return }
    const valid = lines.filter(l => l.stockItemName.trim())
    if (!valid.length) { setError(L('أضف صنفاً واحداً على الأقل', 'Ajoutez au moins un article', 'Add at least one item')); return }
    setLoading(true); setError('')
    try {
      await onSave({ supplierId, notes, items: valid })
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">
            {L('إنشاء طلب شراء', 'Créer un bon de commande', 'Create Purchase Order')}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Supplier */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {L('المورد', 'Fournisseur', 'Supplier')} *
            </label>
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Line items */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              {L('الأصناف المطلوبة', 'Articles commandés', 'Order Items')}
            </label>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  {/* Ingredient name */}
                  <div className="col-span-4">
                    <input
                      list={`items-${i}`}
                      value={line.stockItemName}
                      onChange={e => {
                        updateLine(i, 'stockItemName', e.target.value)
                        autoFillFromStock(i, e.target.value)
                      }}
                      placeholder={L('اسم المادة', 'Ingrédient', 'Ingredient')}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <datalist id={`items-${i}`}>
                      {stockItems.map(s => <option key={s.id} value={s.ingredientName} />)}
                    </datalist>
                  </div>
                  {/* Unit */}
                  <div className="col-span-2">
                    <select
                      value={line.unit}
                      onChange={e => updateLine(i, 'unit', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      {['g','kg','ml','L','pcs'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  {/* Qty */}
                  <div className="col-span-2">
                    <input
                      type="number" min={0} step={0.1}
                      value={line.quantityOrdered}
                      onChange={e => updateLine(i, 'quantityOrdered', parseFloat(e.target.value) || 0)}
                      placeholder="Qty"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {/* Unit cost */}
                  <div className="col-span-3">
                    <input
                      type="number" min={0} step={0.01}
                      value={line.unitCost}
                      onChange={e => updateLine(i, 'unitCost', parseFloat(e.target.value) || 0)}
                      placeholder="Cost/u"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {/* Remove */}
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)}
                        className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addLine}
              className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold hover:underline">
              <Plus className="w-3.5 h-3.5" />
              {L('إضافة صنف', 'Ajouter un article', 'Add Item')}
            </button>
          </div>

          {/* Total */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600 font-medium">
              {L('الإجمالي المقدر', 'Total estimé', 'Estimated Total')}
            </span>
            <span className="text-lg font-extrabold text-gray-900">{total.toFixed(2)}</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {L('ملاحظات للمورد', 'Notes pour le fournisseur', 'Notes to Supplier')}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={L('مثال: التسليم صباحاً قبل الساعة 8', 'Ex: Livraison avant 8h', 'e.g. Deliver before 8am')}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">
            {L('إلغاء', 'Annuler', 'Cancel')}
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {L('إنشاء الطلب', 'Créer le bon', 'Create Order')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PO Card ───────────────────────────────────────────────────────────────────

function POCard({
  po, onUpdateStatus, onSendWhatsApp, lang
}: {
  po:             PurchaseOrder
  onUpdateStatus: (id: string, status: string) => Promise<void>
  onSendWhatsApp: (po: PurchaseOrder) => void
  lang:           string
}) {
  const [expanded,  setExpanded]  = useState(false)
  const [updating,  setUpdating]  = useState(false)

  const L = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en

  const nextStatus: Record<string, string> = {
    pending:  'ordered',
    ordered:  'received',
  }

  async function advance() {
    const next = nextStatus[po.status]
    if (!next) return
    setUpdating(true)
    await onUpdateStatus(po.id, next)
    setUpdating(false)
  }

  const statusLabels: Record<string, string> = {
    pending:  L('تأكيد الإرسال', 'Confirmer envoi', 'Confirm Sent'),
    ordered:  L('تأكيد الاستلام', 'Confirmer réception', 'Confirm Received'),
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-gray-900">{po.supplier.name}</span>
            <POStatusBadge status={po.status} />
            {po.sentViaWhatsApp && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                <MessageCircle className="w-3 h-3" /> {L('أُرسل عبر واتساب', 'Envoyé WhatsApp', 'Sent via WhatsApp')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {new Date(po.createdAt).toLocaleDateString()} • {po.items.length} {L('أصناف', 'articles', 'items')}
          </p>
          {po.notes && <p className="text-xs text-gray-500 mt-1 italic">"{po.notes}"</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-extrabold text-gray-900">{po.totalCost.toFixed(2)}</p>
          <p className="text-xs text-gray-400">{L('إجمالي', 'Total', 'Total')}</p>
        </div>
      </div>

      {/* Expandable items */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 flex items-center justify-between hover:bg-gray-100 transition-colors border-t border-gray-100"
      >
        {L('عرض الأصناف', 'Voir les articles', 'View Items')}
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 font-semibold uppercase tracking-wider">
                <th className="text-left pb-2">{L('الصنف', 'Article', 'Item')}</th>
                <th className="text-center pb-2">{L('الكمية', 'Qté', 'Qty')}</th>
                <th className="text-center pb-2">{L('سعر/وحدة', 'Prix/u', 'Unit Price')}</th>
                <th className="text-right pb-2">{L('الإجمالي', 'Total', 'Total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {po.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-medium text-gray-800">{item.stockItemName}</td>
                  <td className="py-1.5 text-center font-mono text-gray-600">{item.quantityOrdered} {item.unit}</td>
                  <td className="py-1.5 text-center font-mono text-gray-600">{item.unitCost.toFixed(2)}</td>
                  <td className="py-1.5 text-right font-mono font-bold text-gray-900">{item.totalCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      {po.status !== 'received' && po.status !== 'cancelled' && (
        <div className="px-5 pb-4 flex gap-2 flex-wrap">
          {/* Advance status */}
          {nextStatus[po.status] && (
            <button onClick={advance} disabled={updating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60">
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {statusLabels[po.status]}
            </button>
          )}

          {/* Send via WhatsApp */}
          {po.supplier.phone && (
            <button onClick={() => onSendWhatsApp(po)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600">
              <MessageCircle className="w-3.5 h-3.5" />
              {L('إرسال واتساب', 'Envoyer WhatsApp', 'Send WhatsApp')}
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {/* Cancel */}
          <button onClick={() => onUpdateStatus(po.id, 'cancelled')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50">
            <X className="w-3.5 h-3.5" />
            {L('إلغاء', 'Annuler', 'Cancel')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const { lang } = useLang()
  const isAr     = lang === 'ar'
  const isFr     = lang === 'fr'
  const L = (ar: string, fr: string, en: string) =>
    isAr ? ar : isFr ? fr : en

  const searchParams = useSearchParams()
  const router = useRouter()

  const [orders,     setOrders]     = useState<PurchaseOrder[]>([])
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const fromRequisitionId = searchParams.get('fromRequisition')
  const prefillLine = fromRequisitionId ? {
    stockItemName:   searchParams.get('itemName') ?? '',
    unit:            searchParams.get('unit') ?? 'kg',
    quantityOrdered: Number(searchParams.get('quantity') ?? '1'),
    unitCost:        searchParams.get('estimatedPrice') && searchParams.get('quantity')
      ? Number(searchParams.get('estimatedPrice')) / Number(searchParams.get('quantity'))
      : 0,
  } : undefined

  useEffect(() => {
    if (fromRequisitionId) setShowCreate(true)
  }, [fromRequisitionId])

  function auth() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/v1/inventory/purchase-orders${statusFilter ? `?status=${statusFilter}` : ''}`
      const [ordersRes, suppRes, stockRes] = await Promise.all([
        fetch(url, { headers: auth() }).then(r => r.ok ? r.json() : []),
        fetch('/api/v1/inventory/suppliers', { headers: auth() }).then(r => r.ok ? r.json() : []),
        fetch('/api/v1/inventory/stock', { headers: auth() }).then(r => r.ok ? r.json() : []),
      ])
      setOrders(ordersRes)
      setSuppliers(suppRes.filter((s: any) => s.isActive))
      setStockItems(stockRes)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleCreate(data: any) {
    const res = await fetch('/api/v1/inventory/purchase-orders', {
      method:  'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...data, ...(fromRequisitionId && { requisitionId: fromRequisitionId }) })
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    if (fromRequisitionId) router.replace('/admin/inventory/purchase-orders')
    await fetchAll()
  }

  async function handleUpdateStatus(id: string, status: string) {
    await fetch(`/api/v1/inventory/purchase-orders/${id}`, {
      method:  'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status })
    })
    await fetchAll()
  }

  function handleSendWhatsApp(po: PurchaseOrder) {
    // Build a clean WhatsApp message
    const cafe = 'Our Restaurant'
    const itemsList = po.items
      .map(i => `• ${i.stockItemName}: ${i.quantityOrdered} ${i.unit}`)
      .join('\n')
    const msg = encodeURIComponent(
      `Hello ${po.supplier.name},\n\n${cafe} requires a new supply order:\n\n${itemsList}\n\nTotal estimate: ${po.totalCost.toFixed(2)}\n${po.notes ? `Notes: ${po.notes}\n` : ''}\nPlease confirm availability and delivery date. Thank you!`
    )
    const phone = po.supplier.phone.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')

    // Mark as sent
    fetch(`/api/v1/inventory/purchase-orders/${po.id}`, {
      method:  'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sentViaWhatsApp: true })
    }).then(() => fetchAll())
  }

  const statuses = ['', 'pending', 'ordered', 'received', 'cancelled']
  const statusLabels: Record<string, string> = {
    '':         L('الكل', 'Tous', 'All'),
    pending:    L('معلق', 'En attente', 'Pending'),
    ordered:    L('تم الطلب', 'Commandé', 'Ordered'),
    received:   L('مستلم', 'Reçu', 'Received'),
    cancelled:  L('ملغى', 'Annulé', 'Cancelled'),
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin/inventory"
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="font-extrabold text-gray-900 text-xl">
              {L('طلبات الشراء', 'Bons de commande', 'Purchase Orders')}
            </h1>
            <p className="text-gray-400 text-sm">
              {L('إدارة وتتبع طلبات الشراء من الموردين', 'Gérer et suivre les bons de commande', 'Manage and track supplier purchase orders')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (suppliers.length === 0) {
                alert(L('أضف مورداً أولاً', 'Ajoutez un fournisseur d\'abord', 'Add a supplier first'))
                return
              }
              setShowCreate(true)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
            <Plus className="w-4 h-4" />
            {L('إنشاء طلب', 'Créer un bon', 'Create Order')}
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === s
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-28 bg-gray-50 rounded-2xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {L('لا توجد طلبات شراء — أنشئ أول طلب', 'Aucun bon de commande — créez le premier', 'No purchase orders — create your first one')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(po => (
            <POCard
              key={po.id}
              po={po}
              lang={lang}
              onUpdateStatus={handleUpdateStatus}
              onSendWhatsApp={handleSendWhatsApp}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreatePOModal
          suppliers={suppliers}
          stockItems={stockItems}
          lang={lang}
          prefillLine={prefillLine}
          onClose={() => { setShowCreate(false); if (fromRequisitionId) router.replace('/admin/inventory/purchase-orders') }}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}
