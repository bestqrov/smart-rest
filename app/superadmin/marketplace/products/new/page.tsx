'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Package } from 'lucide-react'
import { useSAAuth } from '../../../context'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'إضافة منتج جديد', back: 'العودة', save: 'حفظ المنتج',
    tabs: { general: 'عام', pricing: 'الأسعار', inventory: 'المخزون', modules: 'الوحدات' },
    sku: 'الرمز *', name: 'الاسم *', slug: 'المعرف', description: 'الوصف *',
    type: 'النوع *', category: 'الفئة *', brand: 'العلامة التجارية', visibility: 'الظهور',
    supplier: 'المورد', tags: 'الوسوم (فاصلة)', images: 'روابط الصور (سطر لكل رابط)',
    basePrice: 'السعر الأساسي', currency: 'العملة', discount: 'الخصم %',
    promotionalPrice: 'سعر العرض', taxRate: 'نسبة الضريبة %', costPrice: 'تكلفة الوحدة',
    initialStock: 'المخزون الأولي', lowStockThreshold: 'حد التنبيه',
    supportedModules: 'الوحدات المدعومة', saving: 'جاري الحفظ...',
    error: 'خطأ في الحفظ', loadingCats: 'جاري تحميل الفئات...',
    TYPE: { HARDWARE:'أجهزة', SOFTWARE:'برمجيات', DIGITAL:'رقمي', SERVICE:'خدمة', SUBSCRIPTION:'اشتراك', LICENSE:'ترخيص' } as Record<string,string>,
    VIS: { PUBLIC:'عام', PRIVATE:'خاص', MODULE_ONLY:'للوحدة فقط' } as Record<string,string>,
  },
  en: {
    title: 'New Product', back: 'Back', save: 'Save Product',
    tabs: { general: 'General', pricing: 'Pricing', inventory: 'Inventory', modules: 'Modules' },
    sku: 'SKU *', name: 'Name *', slug: 'Slug', description: 'Description *',
    type: 'Type *', category: 'Category *', brand: 'Brand', visibility: 'Visibility',
    supplier: 'Supplier', tags: 'Tags (comma-separated)', images: 'Image URLs (one per line)',
    basePrice: 'Base Price', currency: 'Currency', discount: 'Discount %',
    promotionalPrice: 'Promo Price', taxRate: 'Tax Rate %', costPrice: 'Cost Price',
    initialStock: 'Initial Stock', lowStockThreshold: 'Low Stock Threshold',
    supportedModules: 'Supported Modules', saving: 'Saving...',
    error: 'Error saving product', loadingCats: 'Loading categories...',
    TYPE: { HARDWARE:'Hardware', SOFTWARE:'Software', DIGITAL:'Digital', SERVICE:'Service', SUBSCRIPTION:'Subscription', LICENSE:'License' } as Record<string,string>,
    VIS: { PUBLIC:'Public', PRIVATE:'Private', MODULE_ONLY:'Module Only' } as Record<string,string>,
  },
}

const MODULES = ['RESTAURANT','HOTEL','CLINIC','RETAIL','ALL']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewProductPage() {
  const router = useRouter()
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [tab, setTab]     = useState<'general' | 'pricing' | 'inventory' | 'modules'>('general')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [suppliers, setSuppliers]   = useState<{ id: string; company: string }[]>([])

  const [form, setForm] = useState({
    sku: '', name: '', slug: '', description: '', type: 'HARDWARE', categoryId: '',
    brand: '', visibility: 'PRIVATE', supplierId: '',
    tags: '', images: '',
    basePrice: '', currency: 'MAD', discount: '', promotionalPrice: '', taxRate: '0', costPrice: '',
    initialStock: '0', lowStockThreshold: '5',
    supportedModules: ['ALL'] as string[],
  })

  const t = T[lang]
  const isRTL = lang === 'ar'

  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
    Promise.all([
      fetch('/api/superadmin/marketplace/categories?onlyActive=0', { headers: header() }).then(r => r.json()),
      fetch('/api/superadmin/marketplace/suppliers', { headers: header() }).then(r => r.json()),
    ]).then(([cats, sups]) => {
      setCategories(cats.categories ?? [])
      setSuppliers(sups.suppliers ?? [])
    })
  }, [])

  function set(key: string, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleModule(m: string) {
    setForm(f => {
      const mods = f.supportedModules.includes(m)
        ? f.supportedModules.filter(x => x !== m)
        : [...f.supportedModules, m]
      return { ...f, supportedModules: mods }
    })
  }

  async function save() {
    if (!form.sku || !form.name || !form.description || !form.categoryId) {
      setError('SKU, name, description, and category are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        sku:              form.sku,
        name:             form.name,
        slug:             form.slug || undefined,
        description:      form.description,
        type:             form.type,
        categoryId:       form.categoryId,
        brand:            form.brand || undefined,
        visibility:       form.visibility,
        supplierId:       form.supplierId || undefined,
        tags:             form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        images:           form.images ? form.images.split('\n').map(s => s.trim()).filter(Boolean) : [],
        supportedModules: form.supportedModules,
      }

      if (form.basePrice) {
        body.pricing = {
          basePrice:        Number(form.basePrice),
          currency:         form.currency,
          discount:         form.discount ? Number(form.discount) : undefined,
          promotionalPrice: form.promotionalPrice ? Number(form.promotionalPrice) : undefined,
          taxRate:          Number(form.taxRate),
          costPrice:        form.costPrice ? Number(form.costPrice) : undefined,
        }
      }

      const res  = await fetch('/api/superadmin/marketplace/products', {
        method: 'POST', headers: { ...header(), 'Content-Type': 'application/json' },
        body:   JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')

      const productId = json.product.id
      if (form.initialStock !== '0') {
        await fetch(`/api/superadmin/marketplace/inventory/${productId}/stock`, {
          method: 'PATCH', headers: { ...header(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: Number(form.initialStock), threshold: Number(form.lowStockThreshold) }),
        })
      }

      router.push(`/superadmin/marketplace/products/${productId}`)
    } catch (err: any) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-xs text-zinc-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  )

  const inputCls = 'w-full bg-zinc-800 rounded-lg px-3 py-2.5 text-sm border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500'
  const selectCls = 'w-full bg-zinc-800 rounded-lg px-3 py-2.5 text-sm border border-zinc-700 text-zinc-100'

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/superadmin/marketplace/products" className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-3"><Package className="w-6 h-6 text-blue-400" />{t.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg">{lang === 'ar' ? 'EN' : 'ع'}</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium disabled:opacity-50">
              <Save className="w-4 h-4" />{saving ? t.saving : t.save}
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          {(Object.keys(t.tabs) as Array<keyof typeof t.tabs>).map(k => (
            <button key={k} onClick={() => setTab(k as any)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${tab === k ? 'bg-blue-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
              {t.tabs[k]}
            </button>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
          {/* General */}
          {tab === 'general' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t.sku}><input value={form.sku} onChange={e => set('sku', e.target.value)} className={inputCls} /></Field>
                <Field label={t.name}><input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} /></Field>
                <Field label={t.slug}><input value={form.slug} onChange={e => set('slug', e.target.value)} className={inputCls} placeholder="auto-generated" /></Field>
                <Field label={t.brand}><input value={form.brand} onChange={e => set('brand', e.target.value)} className={inputCls} /></Field>
                <Field label={t.type}>
                  <select value={form.type} onChange={e => set('type', e.target.value)} className={selectCls}>
                    {Object.entries(t.TYPE).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label={t.category}>
                  <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} className={selectCls}>
                    <option value="">— Select —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label={t.visibility}>
                  <select value={form.visibility} onChange={e => set('visibility', e.target.value)} className={selectCls}>
                    {Object.entries(t.VIS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label={t.supplier}>
                  <select value={form.supplierId} onChange={e => set('supplierId', e.target.value)} className={selectCls}>
                    <option value="">— None —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={t.description}>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={inputCls} />
              </Field>
              <Field label={t.tags}>
                <input value={form.tags} onChange={e => set('tags', e.target.value)} className={inputCls} placeholder="e.g. pos, tablet, hardware" />
              </Field>
              <Field label={t.images}>
                <textarea value={form.images} onChange={e => set('images', e.target.value)} rows={3} className={inputCls} placeholder="https://..." />
              </Field>
            </>
          )}

          {/* Pricing */}
          {tab === 'pricing' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.basePrice}><input type="number" min={0} value={form.basePrice} onChange={e => set('basePrice', e.target.value)} className={inputCls} /></Field>
              <Field label={t.currency}><input value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls} /></Field>
              <Field label={t.discount}><input type="number" min={0} max={100} value={form.discount} onChange={e => set('discount', e.target.value)} className={inputCls} /></Field>
              <Field label={t.promotionalPrice}><input type="number" min={0} value={form.promotionalPrice} onChange={e => set('promotionalPrice', e.target.value)} className={inputCls} /></Field>
              <Field label={t.taxRate}><input type="number" min={0} max={100} value={form.taxRate} onChange={e => set('taxRate', e.target.value)} className={inputCls} /></Field>
              <Field label={t.costPrice}><input type="number" min={0} value={form.costPrice} onChange={e => set('costPrice', e.target.value)} className={inputCls} /></Field>
            </div>
          )}

          {/* Inventory */}
          {tab === 'inventory' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.initialStock}><input type="number" min={0} value={form.initialStock} onChange={e => set('initialStock', e.target.value)} className={inputCls} /></Field>
              <Field label={t.lowStockThreshold}><input type="number" min={0} value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} className={inputCls} /></Field>
            </div>
          )}

          {/* Modules */}
          {tab === 'modules' && (
            <div>
              <p className="text-sm text-zinc-400 mb-4">{t.supportedModules}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {MODULES.map(m => (
                  <button key={m} onClick={() => toggleModule(m)}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                      form.supportedModules.includes(m)
                        ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
