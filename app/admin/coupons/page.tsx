'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ticket, Plus, Loader2, Trash2, Copy, Check } from 'lucide-react'
import { useLang } from '../lang-context'

interface Coupon {
  id: string; code: string; type: 'PERCENT' | 'FIXED'; value: number
  minOrder: number; maxDiscount: number | null; maxUses: number | null; usedCount: number
  startsAt: string | null; endsAt: string | null; isActive: boolean; note: string
  totalDiscount: number; totalRevenue: number
}

const T = {
  ar: {
    title: 'كوبونات الخصم', subtitle: 'أنشئ أكواداً يكتبها الزبون في سلة الطلب عبر QR',
    newCoupon: 'كوبون جديد', code: 'الكود', type: 'النوع', percent: 'نسبة %', fixed: 'مبلغ ثابت',
    value: 'القيمة', minOrder: 'الحد الأدنى للطلب', maxDiscount: 'أقصى خصم', maxUses: 'عدد الاستخدامات',
    unlimited: 'غير محدود', startsAt: 'يبدأ في', endsAt: 'ينتهي في', note: 'ملاحظة داخلية',
    create: 'إنشاء', cancel: 'إلغاء', active: 'مفعّل', inactive: 'متوقف', uses: 'استخدام',
    discountGiven: 'خصم ممنوح', revenue: 'مبيعات', empty: 'لا توجد كوبونات بعد',
    confirmDelete: 'حذف هذا الكوبون؟', optional: 'اختياري', expired: 'منتهي',
    errors: { DUPLICATE: 'هذا الكود موجود مسبقاً', BAD_CODE: 'الكود: 3 إلى 20 حرفاً أو رقماً', BAD_VALUE: 'قيمة غير صحيحة (النسبة بين 1 و 100)', default: 'حدث خطأ' },
  },
  en: {
    title: 'Discount Coupons', subtitle: 'Create codes guests type in the QR order cart',
    newCoupon: 'New coupon', code: 'Code', type: 'Type', percent: 'Percent %', fixed: 'Fixed amount',
    value: 'Value', minOrder: 'Minimum order', maxDiscount: 'Max discount', maxUses: 'Usage limit',
    unlimited: 'Unlimited', startsAt: 'Starts', endsAt: 'Ends', note: 'Internal note',
    create: 'Create', cancel: 'Cancel', active: 'Active', inactive: 'Paused', uses: 'uses',
    discountGiven: 'Discount given', revenue: 'Sales', empty: 'No coupons yet',
    confirmDelete: 'Delete this coupon?', optional: 'optional', expired: 'Expired',
    errors: { DUPLICATE: 'This code already exists', BAD_CODE: 'Code: 3-20 letters or digits', BAD_VALUE: 'Invalid value (percent must be 1-100)', default: 'Something went wrong' },
  },
  fr: {
    title: 'Codes promo', subtitle: 'Créez des codes que le client saisit dans le panier QR',
    newCoupon: 'Nouveau code', code: 'Code', type: 'Type', percent: 'Pourcentage %', fixed: 'Montant fixe',
    value: 'Valeur', minOrder: 'Commande minimum', maxDiscount: 'Remise max', maxUses: 'Utilisations max',
    unlimited: 'Illimité', startsAt: 'Début', endsAt: 'Fin', note: 'Note interne',
    create: 'Créer', cancel: 'Annuler', active: 'Actif', inactive: 'En pause', uses: 'utilisations',
    discountGiven: 'Remise accordée', revenue: 'Ventes', empty: 'Aucun code pour le moment',
    confirmDelete: 'Supprimer ce code ?', optional: 'optionnel', expired: 'Expiré',
    errors: { DUPLICATE: 'Ce code existe déjà', BAD_CODE: 'Code : 3 à 20 lettres ou chiffres', BAD_VALUE: 'Valeur invalide (pourcentage entre 1 et 100)', default: 'Une erreur est survenue' },
  },
  es: {
    title: 'Cupones de descuento', subtitle: 'Crea códigos que el cliente escribe en el carrito QR',
    newCoupon: 'Nuevo cupón', code: 'Código', type: 'Tipo', percent: 'Porcentaje %', fixed: 'Monto fijo',
    value: 'Valor', minOrder: 'Pedido mínimo', maxDiscount: 'Descuento máx.', maxUses: 'Usos máx.',
    unlimited: 'Ilimitado', startsAt: 'Inicio', endsAt: 'Fin', note: 'Nota interna',
    create: 'Crear', cancel: 'Cancelar', active: 'Activo', inactive: 'Pausado', uses: 'usos',
    discountGiven: 'Descuento dado', revenue: 'Ventas', empty: 'Aún no hay cupones',
    confirmDelete: '¿Eliminar este cupón?', optional: 'opcional', expired: 'Caducado',
    errors: { DUPLICATE: 'Este código ya existe', BAD_CODE: 'Código: 3-20 letras o números', BAD_VALUE: 'Valor inválido (porcentaje 1-100)', default: 'Algo salió mal' },
  },
} as const

const EMPTY = { code: '', type: 'PERCENT' as 'PERCENT' | 'FIXED', value: '', minOrder: '', maxDiscount: '', maxUses: '', startsAt: '', endsAt: '', note: '' }

export default function CouponsPage() {
  const { lang, isRTL } = useLang()
  const t = T[(lang in T ? lang : 'en') as keyof typeof T]

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')
  const [copied, setCopied]   = useState<string | null>(null)

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` })

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/coupons', { headers: headers() })
      if (r.ok) setCoupons((await r.json()).coupons ?? [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    setSaving(true); setErr('')
    try {
      const r = await fetch('/api/admin/coupons', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          ...form,
          value: Number(form.value),
          endsAt: form.endsAt ? new Date(form.endsAt + 'T23:59:59').toISOString() : null,
          startsAt: form.startsAt ? new Date(form.startsAt + 'T00:00:00').toISOString() : null,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr((t.errors as Record<string, string>)[d.code] ?? t.errors.default); return }
      setForm(EMPTY); setShowForm(false); load()
    } finally { setSaving(false) }
  }

  async function toggle(c: Coupon) {
    setCoupons(cs => cs.map(x => x.id === c.id ? { ...x, isActive: !x.isActive } : x))
    await fetch(`/api/admin/coupons/${c.id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ isActive: !c.isActive }) })
  }

  async function remove(c: Coupon) {
    if (!confirm(t.confirmDelete)) return
    await fetch(`/api/admin/coupons/${c.id}`, { method: 'DELETE', headers: headers() })
    setCoupons(cs => cs.filter(x => x.id !== c.id))
  }

  const input = 'w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
  const label = 'text-xs text-slate-400 font-semibold block mb-1'

  return (
    <div className={`max-w-5xl mx-auto px-4 py-6 space-y-5 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Ticket size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">{t.title}</h1>
            <p className="text-xs text-slate-500 mt-1">{t.subtitle}</p>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold">
            <Plus size={15} /> {t.newCoupon}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>{t.code}</label>
              <input dir="ltr" className={input + ' font-mono uppercase'} value={form.code} maxLength={20} placeholder="RAMADAN20"
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))} />
            </div>
            <div>
              <label className={label}>{t.type}</label>
              <select className={input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'PERCENT' | 'FIXED' }))}>
                <option value="PERCENT">{t.percent}</option>
                <option value="FIXED">{t.fixed}</option>
              </select>
            </div>
            <div>
              <label className={label}>{t.value}</label>
              <input type="number" min="0" className={input} value={form.value} placeholder={form.type === 'PERCENT' ? '20' : '15'}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </div>
            <div>
              <label className={label}>{t.minOrder} <span className="text-slate-600">({t.optional})</span></label>
              <input type="number" min="0" className={input} value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))} />
            </div>
            {form.type === 'PERCENT' && (
              <div>
                <label className={label}>{t.maxDiscount} <span className="text-slate-600">({t.optional})</span></label>
                <input type="number" min="0" className={input} value={form.maxDiscount} onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))} />
              </div>
            )}
            <div>
              <label className={label}>{t.maxUses}</label>
              <input type="number" min="1" step="1" className={input} value={form.maxUses} placeholder={t.unlimited} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} />
            </div>
            <div>
              <label className={label}>{t.startsAt} <span className="text-slate-600">({t.optional})</span></label>
              <input type="date" className={input} value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
            </div>
            <div>
              <label className={label}>{t.endsAt} <span className="text-slate-600">({t.optional})</span></label>
              <input type="date" className={input} value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
            </div>
            <div>
              <label className={label}>{t.note}</label>
              <input className={input} value={form.note} maxLength={200} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button onClick={create} disabled={saving || form.code.length < 3 || !form.value}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}{t.create}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setErr('') }} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold">{t.cancel}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : coupons.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">{t.empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {coupons.map(c => {
            const expired = !!c.endsAt && new Date(c.endsAt) < new Date()
            return (
              <div key={c.id} className={`bg-slate-900 border rounded-2xl p-4 space-y-3 ${c.isActive && !expired ? 'border-slate-800' : 'border-slate-800 opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button onClick={() => { navigator.clipboard.writeText(c.code); setCopied(c.id); setTimeout(() => setCopied(null), 1500) }}
                      className="font-mono font-black text-lg text-white flex items-center gap-2" dir="ltr">
                      {c.code} {copied === c.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={13} className="text-slate-500" />}
                    </button>
                    <p className="text-sm text-violet-300 font-bold">
                      {c.type === 'PERCENT' ? `−${c.value}%` : `−${c.value}`}
                      {c.minOrder > 0 && <span className="text-slate-500 font-normal"> · {t.minOrder} {c.minOrder}</span>}
                    </p>
                  </div>
                  <button onClick={() => toggle(c)}
                    className={`text-xs px-2 py-1 rounded-full font-bold ${expired ? 'bg-slate-800 text-slate-400' : c.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {expired ? t.expired : c.isActive ? t.active : t.inactive}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-800/60 rounded-lg py-2">
                    <p className="text-white font-bold text-sm">{c.usedCount}{c.maxUses != null && <span className="text-slate-500">/{c.maxUses}</span>}</p>
                    <p className="text-[10px] text-slate-500">{t.uses}</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg py-2">
                    <p className="text-white font-bold text-sm">{c.totalDiscount.toFixed(0)}</p>
                    <p className="text-[10px] text-slate-500">{t.discountGiven}</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg py-2">
                    <p className="text-white font-bold text-sm">{c.totalRevenue.toFixed(0)}</p>
                    <p className="text-[10px] text-slate-500">{t.revenue}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{c.endsAt ? `${t.endsAt}: ${new Date(c.endsAt).toLocaleDateString()}` : ''}{c.note ? ` · ${c.note}` : ''}</span>
                  <button onClick={() => remove(c)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
