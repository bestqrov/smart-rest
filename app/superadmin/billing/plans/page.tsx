'use client'

import { useEffect, useState, useCallback } from 'react'
import { CreditCard, Plus, Search, RefreshCw, Pencil, Copy, Power, Star, Trash2 } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingPlan {
  id: string
  name: string
  code: string
  description: string | null
  monthlyPrice: number
  yearlyPrice: number
  currency: string
  isActive: boolean
  isDefault: boolean
  displayOrder: number
  maxUsers: number
  maxStorageGB: number
  aiCredits: number
  marketplaceEnabled: boolean
  automationEnabled: boolean
  certificationEnabled: boolean
  apiAccess: boolean
  supportLevel: string
  createdAt: string
  updatedAt: string
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'خطط الاشتراك', subtitle: 'إدارة خطط الاشتراك',
    add: 'إضافة خطة', search: 'بحث...', refresh: 'تحديث',
    name: 'الاسم', code: 'الرمز', price: 'السعر الشهري',
    features: 'الميزات', status: 'الحالة', default: 'افتراضي',
    actions: 'إجراءات', edit: 'تعديل', duplicate: 'نسخ',
    activate: 'تفعيل', deactivate: 'إيقاف',
    setDefault: 'تعيين افتراضي', delete: 'حذف',
    active: 'نشطة', inactive: 'غير نشطة',
    loading: 'جاري التحميل...', noPlans: 'لا توجد خطط',
    save: 'حفظ', cancel: 'إلغاء',
    description: 'الوصف', monthlyPrice: 'السعر الشهري',
    yearlyPrice: 'السعر السنوي', currency: 'العملة',
    displayOrder: 'ترتيب العرض', maxUsers: 'أقصى مستخدمين',
    maxStorageGB: 'التخزين (GB)', aiCredits: 'رصيد AI',
    marketplace: 'المارکت‌بليس', automation: 'الأتمتة',
    certification: 'الشهادات', apiAccess: 'وصول API',
    supportLevel: 'مستوى الدعم', deleteConfirm: 'هل أنت متأكد من الحذف؟',
    createTitle: 'إنشاء خطة جديدة', editTitle: 'تعديل الخطة',
  },
  en: {
    title: 'Billing Plans', subtitle: 'Manage subscription plans',
    add: 'Add Plan', search: 'Search...', refresh: 'Refresh',
    name: 'Name', code: 'Code', price: 'Monthly Price',
    features: 'Features', status: 'Status', default: 'Default',
    actions: 'Actions', edit: 'Edit', duplicate: 'Duplicate',
    activate: 'Activate', deactivate: 'Deactivate',
    setDefault: 'Set Default', delete: 'Delete',
    active: 'Active', inactive: 'Inactive',
    loading: 'Loading...', noPlans: 'No plans found',
    save: 'Save', cancel: 'Cancel',
    description: 'Description', monthlyPrice: 'Monthly Price',
    yearlyPrice: 'Yearly Price', currency: 'Currency',
    displayOrder: 'Display Order', maxUsers: 'Max Users',
    maxStorageGB: 'Storage (GB)', aiCredits: 'AI Credits',
    marketplace: 'Marketplace', automation: 'Automation',
    certification: 'Certification', apiAccess: 'API Access',
    supportLevel: 'Support Level', deleteConfirm: 'Are you sure you want to delete this plan?',
    createTitle: 'Create New Plan', editTitle: 'Edit Plan',
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [filtered, setFiltered] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editPlan, setEditPlan] = useState<BillingPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<BillingPlan>>({})
  const [error, setError] = useState<string | null>(null)

  const t = T[lang]
  const isRTL = lang === 'ar'

  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/superadmin/billing/plans', { headers: header() })
      const json = await res.json()
      setPlans(json.plans ?? [])
    } finally { setLoading(false) }
  }, [header])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(plans.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    ))
  }, [plans, search])

  useEffect(() => { load() }, [load])

  function openModal(plan?: BillingPlan) {
    setEditPlan(plan ?? null)
    setForm(plan ? { ...plan } : {
      monthlyPrice: 0, yearlyPrice: 0, currency: 'MAD',
      isActive: true, displayOrder: 0, maxUsers: 5,
      maxStorageGB: 10, aiCredits: 0, marketplaceEnabled: false,
      automationEnabled: false, certificationEnabled: false,
      apiAccess: false, supportLevel: 'COMMUNITY',
    })
    setError(null)
    setShowModal(true)
  }

  async function submitModal() {
    setSaving(true); setError(null)
    try {
      const url    = editPlan ? `/api/superadmin/billing/plans/${editPlan.id}` : '/api/superadmin/billing/plans'
      const method = editPlan ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method, headers: { ...header(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error'); return }
      setShowModal(false)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally { setSaving(false) }
  }

  async function action(id: string, path: string, method = 'POST') {
    await fetch(`/api/superadmin/billing/plans/${id}${path}`, { method, headers: header() })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm(t.deleteConfirm)) return
    await fetch(`/api/superadmin/billing/plans/${id}`, { method: 'DELETE', headers: header() })
    load()
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-blue-400" />
            {t.title}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 transition">
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>
          <button onClick={() => load()} disabled={loading}
            className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition" title={t.refresh}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" />{t.add}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl ps-10 pe-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                <th className="px-4 py-3 text-start">{t.name}</th>
                <th className="px-4 py-3 text-start hidden md:table-cell">{t.code}</th>
                <th className="px-4 py-3 text-start hidden lg:table-cell">{t.price}</th>
                <th className="px-4 py-3 text-start hidden xl:table-cell">{t.features}</th>
                <th className="px-4 py-3 text-start">{t.status}</th>
                <th className="px-4 py-3 text-start hidden md:table-cell">{t.default}</th>
                <th className="px-4 py-3 text-end">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />{t.loading}
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">{t.noPlans}</td></tr>
              ) : filtered.map(plan => (
                <tr key={plan.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-200">{plan.name}</div>
                    {plan.description && (
                      <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-[180px]">{plan.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell font-mono text-xs">{plan.code}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-zinc-300">
                    {plan.monthlyPrice} <span className="text-zinc-500 text-xs">{plan.currency}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {plan.marketplaceEnabled && (
                        <span className="text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">MP</span>
                      )}
                      {plan.automationEnabled && (
                        <span className="text-xs bg-violet-900 text-violet-300 px-1.5 py-0.5 rounded">AUTO</span>
                      )}
                      {plan.certificationEnabled && (
                        <span className="text-xs bg-emerald-900 text-emerald-300 px-1.5 py-0.5 rounded">CERT</span>
                      )}
                      {plan.apiAccess && (
                        <span className="text-xs bg-cyan-900 text-cyan-300 px-1.5 py-0.5 rounded">API</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {plan.isActive ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-green-900 text-green-300">{t.active}</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-400">{t.inactive}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {plan.isDefault && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-900 text-amber-300">
                        {t.default}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openModal(plan)}
                        title={t.edit}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => action(plan.id, '/duplicate')}
                        title={t.duplicate}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => action(plan.id, plan.isActive ? '/deactivate' : '/activate')}
                        title={plan.isActive ? t.deactivate : t.activate}
                        className={`p-1.5 rounded ${plan.isActive ? 'text-yellow-400 hover:bg-yellow-900/30' : 'text-green-400 hover:bg-green-900/30'}`}>
                        <Power className="w-4 h-4" />
                      </button>
                      {!plan.isDefault && (
                        <button onClick={() => action(plan.id, '/set-default')}
                          title={t.setDefault}
                          className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-900/20 rounded">
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(plan.id)}
                        title={t.delete}
                        className="p-1.5 text-red-400 hover:bg-red-900/30 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-5 text-zinc-100">
              {editPlan ? t.editTitle : t.createTitle}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Row 1: Name | Code */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.name} *</label>
                <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.code} *</label>
                <input value={form.code ?? ''} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  disabled={!!editPlan}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>

              {/* Row 2: Monthly Price | Yearly Price */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.monthlyPrice}</label>
                <input type="number" value={form.monthlyPrice ?? 0} onChange={e => setForm(f => ({ ...f, monthlyPrice: Number(e.target.value) }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.yearlyPrice}</label>
                <input type="number" value={form.yearlyPrice ?? 0} onChange={e => setForm(f => ({ ...f, yearlyPrice: Number(e.target.value) }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100" />
              </div>

              {/* Row 3: Currency | Display Order */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.currency}</label>
                <input value={form.currency ?? 'MAD'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.displayOrder}</label>
                <input type="number" value={form.displayOrder ?? 0} onChange={e => setForm(f => ({ ...f, displayOrder: Number(e.target.value) }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100" />
              </div>

              {/* Row 4: Max Users | Max Storage */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.maxUsers}</label>
                <input type="number" value={form.maxUsers ?? 5} onChange={e => setForm(f => ({ ...f, maxUsers: Number(e.target.value) }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.maxStorageGB}</label>
                <input type="number" value={form.maxStorageGB ?? 10} onChange={e => setForm(f => ({ ...f, maxStorageGB: Number(e.target.value) }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100" />
              </div>

              {/* Row 5: AI Credits | Support Level */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.aiCredits}</label>
                <input type="number" value={form.aiCredits ?? 0} onChange={e => setForm(f => ({ ...f, aiCredits: Number(e.target.value) }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.supportLevel}</label>
                <select value={form.supportLevel ?? 'COMMUNITY'} onChange={e => setForm(f => ({ ...f, supportLevel: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100">
                  {['COMMUNITY', 'EMAIL', 'PRIORITY', 'DEDICATED'].map(sl => (
                    <option key={sl} value={sl}>{sl}</option>
                  ))}
                </select>
              </div>

              {/* Row 6: Feature checkboxes */}
              <div className="col-span-2 flex flex-wrap gap-5 py-2">
                {([
                  ['marketplaceEnabled', t.marketplace],
                  ['automationEnabled', t.automation],
                  ['certificationEnabled', t.certification],
                  ['apiAccess', t.apiAccess],
                ] as [keyof BillingPlan, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input type="checkbox"
                      checked={!!form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-blue-500" />
                    {label}
                  </label>
                ))}
              </div>

              {/* Row 7: Description */}
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-xs text-zinc-400">{t.description}</label>
                <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 resize-none" />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition">
                {t.cancel}
              </button>
              <button onClick={submitModal} disabled={saving}
                className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-600 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
