'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Package, RefreshCw, CheckCircle2, Archive } from 'lucide-react'
import { useSAAuth } from '../../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string; sku: string; name: string; slug: string; description: string
  type: string; categoryId: string; brand?: string; status: string; visibility: string
  images: string[]; tags: string[]; metadata: Record<string,unknown>
  supportedModules: string[]; supplierId?: string; createdAt: string; updatedAt: string
}
interface Pricing { id: string; basePrice: number; currency: string; discount?: number; promotionalPrice?: number; taxRate: number; costPrice?: number; effectivePrice: number }
interface Inventory { productId: string; stock: number; reserved: number; available: number; lowStockThreshold: number; isLowStock: boolean }

const T = {
  ar: {
    back: 'العودة', saveGeneral: 'حفظ المعلومات', savePricing: 'حفظ الأسعار',
    saveInventory: 'حفظ المخزون', loading: 'جاري التحميل...', notFound: 'المنتج غير موجود',
    publish: 'نشر', archive: 'أرشفة', refresh: 'تحديث', saved: 'تم الحفظ',
    tabs: { general: 'عام', pricing: 'الأسعار', inventory: 'المخزون', modules: 'الوحدات' },
    sku: 'الرمز', name: 'الاسم', slug: 'المعرف', description: 'الوصف',
    type: 'النوع', category: 'الفئة', brand: 'العلامة', visibility: 'الظهور', supplier: 'المورد',
    tags: 'الوسوم (فاصلة)', images: 'روابط الصور (سطر لكل رابط)',
    basePrice: 'السعر الأساسي', currency: 'العملة', discount: 'الخصم %',
    promotionalPrice: 'سعر العرض', taxRate: 'نسبة الضريبة %', costPrice: 'تكلفة الوحدة',
    effectivePrice: 'السعر الفعلي',
    stock: 'المخزون', threshold: 'حد التنبيه', supportedModules: 'الوحدات المدعومة',
    STATUS: { DRAFT:'مسودة', ACTIVE:'نشط', ARCHIVED:'مؤرشف', OUT_OF_STOCK:'نفد' } as Record<string,string>,
    TYPE: { HARDWARE:'أجهزة', SOFTWARE:'برمجيات', DIGITAL:'رقمي', SERVICE:'خدمة', SUBSCRIPTION:'اشتراك', LICENSE:'ترخيص' } as Record<string,string>,
    VIS: { PUBLIC:'عام', PRIVATE:'خاص', MODULE_ONLY:'للوحدة فقط' } as Record<string,string>,
  },
  en: {
    back: 'Back', saveGeneral: 'Save Changes', savePricing: 'Save Pricing',
    saveInventory: 'Save Inventory', loading: 'Loading...', notFound: 'Product not found',
    publish: 'Publish', archive: 'Archive', refresh: 'Refresh', saved: 'Saved',
    tabs: { general: 'General', pricing: 'Pricing', inventory: 'Inventory', modules: 'Modules' },
    sku: 'SKU', name: 'Name', slug: 'Slug', description: 'Description',
    type: 'Type', category: 'Category', brand: 'Brand', visibility: 'Visibility', supplier: 'Supplier',
    tags: 'Tags (comma-separated)', images: 'Image URLs (one per line)',
    basePrice: 'Base Price', currency: 'Currency', discount: 'Discount %',
    promotionalPrice: 'Promo Price', taxRate: 'Tax Rate %', costPrice: 'Cost Price',
    effectivePrice: 'Effective Price',
    stock: 'Stock', threshold: 'Low Stock Threshold', supportedModules: 'Supported Modules',
    STATUS: { DRAFT:'Draft', ACTIVE:'Active', ARCHIVED:'Archived', OUT_OF_STOCK:'Out of Stock' } as Record<string,string>,
    TYPE: { HARDWARE:'Hardware', SOFTWARE:'Software', DIGITAL:'Digital', SERVICE:'Service', SUBSCRIPTION:'Subscription', LICENSE:'License' } as Record<string,string>,
    VIS: { PUBLIC:'Public', PRIVATE:'Private', MODULE_ONLY:'Module Only' } as Record<string,string>,
  },
}

const STATUS_COLOR: Record<string,string> = {
  DRAFT: 'bg-zinc-700 text-zinc-300', ACTIVE: 'bg-green-900 text-green-300',
  ARCHIVED: 'bg-red-900 text-red-400', OUT_OF_STOCK: 'bg-yellow-900 text-yellow-300',
}

const MODULES = ['RESTAURANT','HOTEL','CLINIC','RETAIL','ALL']

export default function ProductEditPage() {
  const params = useParams()
  const [lang, setLang]       = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [suppliers, setSuppliers]   = useState<{id:string;company:string}[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [tab, setTab] = useState<'general' | 'pricing' | 'inventory' | 'modules'>('general')

  const [general, setGeneral] = useState({ name:'', slug:'', description:'', type:'', categoryId:'', brand:'', visibility:'', supplierId:'', tags:'', images:'' })
  const [pricingForm, setPricingForm] = useState({ basePrice:'', currency:'MAD', discount:'', promotionalPrice:'', taxRate:'0', costPrice:'' })
  const [invForm, setInvForm] = useState({ stock:'0', threshold:'5' })
  const [modules, setModules] = useState<string[]>(['ALL'])

  const t = T[lang]
  const isRTL = lang === 'ar'
  const id = String(params.id)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, catRes, supRes] = await Promise.all([
        fetch(`/api/superadmin/marketplace/products/${id}`, { headers: header() }),
        fetch('/api/superadmin/marketplace/categories?onlyActive=0', { headers: header() }),
        fetch('/api/superadmin/marketplace/suppliers', { headers: header() }),
      ])
      const { product: p, pricing: pr, inventory: inv } = await pRes.json()
      const { categories: cats } = await catRes.json()
      const { suppliers: sups }  = await supRes.json()

      setProduct(p); setPricing(pr); setInventory(inv)
      setCategories(cats ?? []); setSuppliers(sups ?? [])

      if (p) {
        setGeneral({ name: p.name, slug: p.slug, description: p.description, type: p.type, categoryId: p.categoryId, brand: p.brand ?? '', visibility: p.visibility, supplierId: p.supplierId ?? '', tags: p.tags.join(', '), images: p.images.join('\n') })
        setModules(p.supportedModules)
      }
      if (pr) {
        setPricingForm({ basePrice: String(pr.basePrice), currency: pr.currency, discount: pr.discount != null ? String(pr.discount) : '', promotionalPrice: pr.promotionalPrice != null ? String(pr.promotionalPrice) : '', taxRate: String(pr.taxRate), costPrice: pr.costPrice != null ? String(pr.costPrice) : '' })
      }
      if (inv) {
        setInvForm({ stock: String(inv.stock), threshold: String(inv.lowStockThreshold) })
      }
    } finally { setLoading(false) }
  }, [header, id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  function flash() { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000) }

  async function saveGeneral() {
    setSaving(true)
    try {
      await fetch(`/api/superadmin/marketplace/products/${id}`, {
        method: 'PATCH', headers: { ...header(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: general.name, slug: general.slug, description: general.description,
          type: general.type, categoryId: general.categoryId, brand: general.brand || undefined,
          visibility: general.visibility, supplierId: general.supplierId || undefined,
          tags:   general.tags.split(',').map(s => s.trim()).filter(Boolean),
          images: general.images.split('\n').map(s => s.trim()).filter(Boolean),
          supportedModules: modules,
        }),
      })
      flash(); load()
    } finally { setSaving(false) }
  }

  async function savePricing() {
    setSaving(true)
    try {
      await fetch(`/api/superadmin/marketplace/products/${id}/pricing`, {
        method: 'PATCH', headers: { ...header(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePrice:        Number(pricingForm.basePrice),
          currency:         pricingForm.currency,
          discount:         pricingForm.discount ? Number(pricingForm.discount) : undefined,
          promotionalPrice: pricingForm.promotionalPrice ? Number(pricingForm.promotionalPrice) : undefined,
          taxRate:          Number(pricingForm.taxRate),
          costPrice:        pricingForm.costPrice ? Number(pricingForm.costPrice) : undefined,
        }),
      })
      flash(); load()
    } finally { setSaving(false) }
  }

  async function saveInventory() {
    setSaving(true)
    try {
      await fetch(`/api/superadmin/marketplace/products/${id}/inventory`, {
        method: 'PATCH', headers: { ...header(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: Number(invForm.stock), threshold: Number(invForm.threshold) }),
      })
      flash(); load()
    } finally { setSaving(false) }
  }

  async function togglePublish() {
    if (!product) return
    const endpoint = product.status === 'ACTIVE' ? 'archive' : 'publish'
    await fetch(`/api/superadmin/marketplace/products/${id}/${endpoint}`, { method: 'POST', headers: header() })
    load()
  }

  const inputCls = 'w-full bg-zinc-800 rounded-lg px-3 py-2.5 text-sm border border-zinc-700 text-zinc-100 focus:outline-none focus:border-blue-500'
  const selectCls = 'w-full bg-zinc-800 rounded-lg px-3 py-2.5 text-sm border border-zinc-700 text-zinc-100'
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="text-xs text-zinc-400 mb-1.5 block">{label}</label>{children}</div>
  )

  if (!product && !loading) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">{t.notFound}</p>
          <Link href="/superadmin/marketplace/products" className="text-blue-400 hover:underline">{t.back}</Link>
        </div>
      </div>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/superadmin/marketplace/products" className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-3"><Package className="w-6 h-6 text-blue-400" />{product?.name ?? '...'}</h1>
              {product && <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[product.status] ?? ''}`}>{t.STATUS[product.status]}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg">{lang === 'ar' ? 'EN' : 'ع'}</button>
            {savedMsg && <span className="flex items-center gap-1 text-sm text-green-400"><CheckCircle2 className="w-4 h-4" />{t.saved}</span>}
            <button onClick={load} disabled={loading} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            {product && (
              <button onClick={togglePublish}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${product.status === 'ACTIVE' ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'}`}>
                {product.status === 'ACTIVE' ? <><Archive className="w-4 h-4" />{t.archive}</> : <><CheckCircle2 className="w-4 h-4" />{t.publish}</>}
              </button>
            )}
          </div>
        </div>

        {loading && !product ? (
          <div className="flex items-center justify-center gap-3 text-zinc-400 py-20">
            <RefreshCw className="w-5 h-5 animate-spin" />{t.loading}
          </div>
        ) : (
          <>
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
                    <Field label={t.sku}><input value={product?.sku ?? ''} disabled className={inputCls + ' opacity-50'} /></Field>
                    <Field label={t.name}><input value={general.name} onChange={e => setGeneral(f => ({...f,name:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.slug}><input value={general.slug} onChange={e => setGeneral(f => ({...f,slug:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.brand}><input value={general.brand} onChange={e => setGeneral(f => ({...f,brand:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.type}>
                      <select value={general.type} onChange={e => setGeneral(f => ({...f,type:e.target.value}))} className={selectCls}>
                        {Object.entries(t.TYPE).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </Field>
                    <Field label={t.category}>
                      <select value={general.categoryId} onChange={e => setGeneral(f => ({...f,categoryId:e.target.value}))} className={selectCls}>
                        <option value="">— Select —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </Field>
                    <Field label={t.visibility}>
                      <select value={general.visibility} onChange={e => setGeneral(f => ({...f,visibility:e.target.value}))} className={selectCls}>
                        {Object.entries(t.VIS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </Field>
                    <Field label={t.supplier}>
                      <select value={general.supplierId} onChange={e => setGeneral(f => ({...f,supplierId:e.target.value}))} className={selectCls}>
                        <option value="">— None —</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label={t.description}><textarea value={general.description} onChange={e => setGeneral(f => ({...f,description:e.target.value}))} rows={3} className={inputCls} /></Field>
                  <Field label={t.tags}><input value={general.tags} onChange={e => setGeneral(f => ({...f,tags:e.target.value}))} className={inputCls} /></Field>
                  <Field label={t.images}><textarea value={general.images} onChange={e => setGeneral(f => ({...f,images:e.target.value}))} rows={3} className={inputCls} /></Field>
                  <button onClick={saveGeneral} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium disabled:opacity-50">
                    <Save className="w-4 h-4" />{t.saveGeneral}
                  </button>
                </>
              )}

              {/* Pricing */}
              {tab === 'pricing' && (
                <>
                  {pricing && (
                    <div className="p-3 bg-zinc-800 rounded-lg flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-400">{t.effectivePrice}</span>
                      <span className="text-lg font-bold text-emerald-400">{pricing.effectivePrice} {pricing.currency}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t.basePrice}><input type="number" min={0} value={pricingForm.basePrice} onChange={e => setPricingForm(f => ({...f,basePrice:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.currency}><input value={pricingForm.currency} onChange={e => setPricingForm(f => ({...f,currency:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.discount}><input type="number" min={0} max={100} value={pricingForm.discount} onChange={e => setPricingForm(f => ({...f,discount:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.promotionalPrice}><input type="number" min={0} value={pricingForm.promotionalPrice} onChange={e => setPricingForm(f => ({...f,promotionalPrice:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.taxRate}><input type="number" min={0} max={100} value={pricingForm.taxRate} onChange={e => setPricingForm(f => ({...f,taxRate:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.costPrice}><input type="number" min={0} value={pricingForm.costPrice} onChange={e => setPricingForm(f => ({...f,costPrice:e.target.value}))} className={inputCls} /></Field>
                  </div>
                  <button onClick={savePricing} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium disabled:opacity-50">
                    <Save className="w-4 h-4" />{t.savePricing}
                  </button>
                </>
              )}

              {/* Inventory */}
              {tab === 'inventory' && (
                <>
                  {inventory && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: 'Stock', value: inventory.stock, color: 'text-zinc-200' },
                        { label: 'Reserved', value: inventory.reserved, color: 'text-yellow-400' },
                        { label: 'Available', value: inventory.available, color: 'text-emerald-400' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-zinc-800 rounded-lg p-3 text-center">
                          <div className={`text-2xl font-bold ${color}`}>{value}</div>
                          <div className="text-xs text-zinc-500 mt-1">{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t.stock}><input type="number" min={0} value={invForm.stock} onChange={e => setInvForm(f => ({...f,stock:e.target.value}))} className={inputCls} /></Field>
                    <Field label={t.threshold}><input type="number" min={0} value={invForm.threshold} onChange={e => setInvForm(f => ({...f,threshold:e.target.value}))} className={inputCls} /></Field>
                  </div>
                  <button onClick={saveInventory} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium disabled:opacity-50">
                    <Save className="w-4 h-4" />{t.saveInventory}
                  </button>
                </>
              )}

              {/* Modules */}
              {tab === 'modules' && (
                <>
                  <p className="text-sm text-zinc-400 mb-4">{t.supportedModules}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                    {MODULES.map(m => (
                      <button key={m} onClick={() => setModules(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev,m])}
                        className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                          modules.includes(m) ? 'border-blue-500 bg-blue-900/30 text-blue-300' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}>{m}</button>
                    ))}
                  </div>
                  <button onClick={saveGeneral} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium disabled:opacity-50">
                    <Save className="w-4 h-4" />{t.saveGeneral}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
