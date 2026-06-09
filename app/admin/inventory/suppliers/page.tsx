'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Truck, Plus, X, ArrowLeft, Edit3, UserCheck,
  UserX, Phone, Mail, User, Loader2, Search, CheckCircle2
} from 'lucide-react'
import { useLang } from '../../lang-context'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Supplier {
  id:            string
  name:          string
  contactPerson: string
  phone:         string
  email:         string
  isActive:      boolean
  createdAt:     string
}

// ── Supplier Form Modal ───────────────────────────────────────────────────────

function SupplierModal({
  existing, onClose, onSave, lang
}: {
  existing?: Supplier
  onClose:  () => void
  onSave:   (data: Partial<Supplier>) => Promise<void>
  lang:     string
}) {
  const [form,    setForm]    = useState({
    name:          existing?.name          ?? '',
    contactPerson: existing?.contactPerson ?? '',
    phone:         existing?.phone         ?? '',
    email:         existing?.email         ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const L = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en

  async function handleSave() {
    if (!form.name.trim()) { setError(L('اسم المورد مطلوب', 'Nom requis', 'Supplier name is required')); return }
    setLoading(true)
    setError('')
    try {
      await onSave(form)
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
            {existing
              ? L('تعديل المورد', 'Modifier le fournisseur', 'Edit Supplier')
              : L('إضافة مورد جديد', 'Ajouter un fournisseur', 'Add Supplier')
            }
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>
        )}

        <div className="space-y-4">
          {[
            { key: 'name',          icon: Truck,  label: L('اسم المورد *', 'Nom *', 'Supplier Name *'),  placeholder: L('مثال: شركة الأغذية المتحدة', 'Ex: Distrib. Maroc', 'e.g. United Foods Co.') },
            { key: 'contactPerson', icon: User,   label: L('مسؤول التواصل', 'Personne contact', 'Contact Person'), placeholder: L('الاسم الكامل', 'Nom complet', 'Full name') },
            { key: 'phone',         icon: Phone,  label: L('رقم الهاتف / واتساب', 'Téléphone / WhatsApp', 'Phone / WhatsApp'), placeholder: '+212 6XX XXX XXX' },
            { key: 'email',         icon: Mail,   label: L('البريد الإلكتروني', 'E-mail', 'Email'), placeholder: 'supplier@example.com' },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1.5">
                <field.icon className="w-3.5 h-3.5" /> {field.label}
              </label>
              <input
                value={(form as any)[field.key]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">
            {L('إلغاء', 'Annuler', 'Cancel')}
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {L('حفظ', 'Enregistrer', 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Supplier Card ─────────────────────────────────────────────────────────────

function SupplierCard({
  supplier, onEdit, onToggle, lang
}: {
  supplier: Supplier
  onEdit:   () => void
  onToggle: () => void
  lang:     string
}) {
  const L = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en

  return (
    <div className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
      supplier.isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            supplier.isActive ? 'bg-emerald-100' : 'bg-gray-100'
          }`}>
            <Truck className={`w-5 h-5 ${supplier.isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{supplier.name}</h3>
            {supplier.contactPerson && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <User className="w-3 h-3" /> {supplier.contactPerson}
              </p>
            )}
          </div>
        </div>

        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          supplier.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {supplier.isActive ? L('نشط', 'Actif', 'Active') : L('غير نشط', 'Inactif', 'Inactive')}
        </span>
      </div>

      <div className="space-y-1.5 mb-4">
        {supplier.phone && (
          <a href={`https://wa.me/${supplier.phone.replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono">{supplier.phone}</span>
            <span className="text-xs text-emerald-500 font-semibold">WhatsApp →</span>
          </a>
        )}
        {supplier.email && (
          <a href={`mailto:${supplier.email}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </a>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-50">
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
          <Edit3 className="w-3.5 h-3.5" />
          {L('تعديل', 'Modifier', 'Edit')}
        </button>
        <button onClick={onToggle}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
            supplier.isActive
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
          }`}>
          {supplier.isActive
            ? <><UserX className="w-3.5 h-3.5" /> {L('إلغاء تفعيل', 'Désactiver', 'Deactivate')}</>
            : <><UserCheck className="w-3.5 h-3.5" /> {L('تفعيل', 'Activer', 'Activate')}</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const { lang } = useLang()
  const isAr     = lang === 'ar'
  const isFr     = lang === 'fr'

  const L = (ar: string, fr: string, en: string) =>
    isAr ? ar : isFr ? fr : en

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [showAdd,   setShowAdd]   = useState(false)
  const [editing,   setEditing]   = useState<Supplier | null>(null)

  function auth() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/inventory/suppliers', { headers: auth() })
      if (res.ok) setSuppliers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  async function handleAdd(data: Partial<Supplier>) {
    const res = await fetch('/api/v1/inventory/suppliers', {
      method:  'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    await fetchSuppliers()
  }

  async function handleEdit(data: Partial<Supplier>) {
    if (!editing) return
    const res = await fetch(`/api/v1/inventory/suppliers/${editing.id}`, {
      method:  'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    await fetchSuppliers()
  }

  async function handleToggle(supplier: Supplier) {
    await fetch(`/api/v1/inventory/suppliers/${supplier.id}`, {
      method:  'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isActive: !supplier.isActive })
    })
    await fetchSuppliers()
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin/inventory"
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="font-extrabold text-gray-900 text-xl">{L('الموردون', 'Fournisseurs', 'Suppliers')}</h1>
            <p className="text-gray-400 text-sm">{L('إدارة قائمة الموردين', 'Gérer la liste des fournisseurs', 'Manage your supplier list')}</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
          <Plus className="w-4 h-4" />
          {L('إضافة مورد', 'Ajouter', 'Add Supplier')}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={L('بحث عن مورد...', 'Rechercher un fournisseur...', 'Search suppliers...')}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-gray-50 rounded-2xl h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {search
              ? L('لا توجد نتائج', 'Aucun résultat', 'No results found')
              : L('لا يوجد موردون بعد — أضف أول مورد', 'Aucun fournisseur — ajoutez le premier', 'No suppliers yet — add your first one')
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <SupplierCard
              key={s.id}
              supplier={s}
              lang={lang}
              onEdit={() => setEditing(s)}
              onToggle={() => handleToggle(s)}
            />
          ))}
        </div>
      )}

      {/* Stats */}
      {suppliers.length > 0 && (
        <div className="flex gap-4 text-sm text-gray-500">
          <span>{suppliers.length} {L('مورد إجمالاً', 'fournisseur(s) au total', 'total suppliers')}</span>
          <span>•</span>
          <span className="text-emerald-600 font-medium">
            {suppliers.filter(s => s.isActive).length} {L('نشط', 'actif(s)', 'active')}
          </span>
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <SupplierModal lang={lang} onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}
      {editing && (
        <SupplierModal lang={lang} existing={editing} onClose={() => setEditing(null)} onSave={handleEdit} />
      )}
    </div>
  )
}
