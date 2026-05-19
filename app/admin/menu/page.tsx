'use client'

import { useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  ImageIcon, Save, X, Loader2, Tag, DollarSign
} from 'lucide-react'

type Category = { id: number; nameAr: string; nameEn: string; nameFr: string; nameEs: string; nameDe: string; order: number; _count?: { products: number } }
type Product  = { id: number; categoryId: number; nameAr: string; nameEn: string; nameFr: string; price: string | number; description?: string; imageUrl?: string; isAvailable: boolean; category?: { nameEn: string } }

const EMPTY_CAT: Omit<Category, 'id' | 'order' | '_count'> = { nameAr: '', nameEn: '', nameFr: '', nameEs: '', nameDe: '' }
const EMPTY_PRD = { categoryId: 0, nameAr: '', nameEn: '', nameFr: '', price: '', description: '', imageUrl: '' }

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products,   setProducts]   = useState<Product[]>([])
  const [activeTab,  setActiveTab]  = useState<'categories' | 'products'>('products')
  const [expandedCat, setExpandedCat] = useState<number | null>(null)
  const [loading,    setLoading]    = useState(true)

  // Modal state
  const [catModal, setCatModal] = useState<{ open: boolean; data: typeof EMPTY_CAT; id?: number }>({ open: false, data: { ...EMPTY_CAT } })
  const [prdModal, setPrdModal] = useState<{ open: boolean; data: typeof EMPTY_PRD; id?: number }>({ open: false, data: { ...EMPTY_PRD } })
  const [saving, setSaving] = useState(false)
  const [imgPreview, setImgPreview] = useState<string>('')

  function auth() { return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' } }

  async function load() {
    setLoading(true)
    const [catsRes, prdsRes] = await Promise.all([
      fetch('/api/admin/categories', { headers: auth() }),
      fetch('/api/admin/products',   { headers: auth() })
    ])
    const [cats, prds] = await Promise.all([catsRes.json(), prdsRes.json()])
    setCategories(Array.isArray(cats) ? cats : [])
    setProducts(Array.isArray(prds) ? prds : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Category CRUD ──────────────────────────────────────────────
  async function saveCategory() {
    setSaving(true)
    const url    = catModal.id ? `/api/admin/categories/${catModal.id}` : '/api/admin/categories'
    const method = catModal.id ? 'PUT' : 'POST'
    await fetch(url, { method, headers: auth(), body: JSON.stringify(catModal.data) })
    await load()
    setCatModal({ open: false, data: { ...EMPTY_CAT } })
    setSaving(false)
  }

  async function deleteCategory(id: number) {
    if (!confirm('حذف هذه الفئة وكل منتجاتها؟')) return
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', headers: auth() })
    await load()
  }

  // ── Product CRUD ───────────────────────────────────────────────
  function openNewProduct(categoryId: number) {
    setPrdModal({ open: true, data: { ...EMPTY_PRD, categoryId }, id: undefined })
    setImgPreview('')
  }

  function openEditProduct(p: Product) {
    setPrdModal({ open: true, data: { categoryId: p.categoryId, nameAr: p.nameAr, nameEn: p.nameEn, nameFr: p.nameFr || '', price: String(p.price), description: p.description || '', imageUrl: p.imageUrl || '' }, id: p.id })
    setImgPreview(p.imageUrl || '')
  }

  async function saveProduct() {
    setSaving(true)
    const url    = prdModal.id ? `/api/admin/products/${prdModal.id}` : '/api/admin/products'
    const method = prdModal.id ? 'PUT' : 'POST'
    const body   = { ...prdModal.data, price: Number(prdModal.data.price), imageUrl: imgPreview || prdModal.data.imageUrl || undefined }
    await fetch(url, { method, headers: auth(), body: JSON.stringify(body) })
    await load()
    setPrdModal({ open: false, data: { ...EMPTY_PRD } })
    setSaving(false)
  }

  async function toggleAvailable(p: Product) {
    await fetch(`/api/admin/products/${p.id}`, { method: 'PUT', headers: auth(), body: JSON.stringify({ isAvailable: !p.isAvailable }) })
    setProducts(prds => prds.map(x => x.id === p.id ? { ...x, isAvailable: !x.isAvailable } : x))
  }

  async function deleteProduct(id: number) {
    if (!confirm('حذف هذا المنتج؟')) return
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE', headers: auth() })
    await load()
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImgPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">إدارة المنيو</h1>
        <div className="flex gap-2">
          <TabBtn active={activeTab === 'products'} onClick={() => setActiveTab('products')}>المنتجات</TabBtn>
          <TabBtn active={activeTab === 'categories'} onClick={() => setActiveTab('categories')}>الفئات</TabBtn>
        </div>
      </div>

      {/* ── CATEGORIES TAB ─────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="space-y-3">
          <button
            onClick={() => setCatModal({ open: true, data: { ...EMPTY_CAT } })}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> إضافة فئة جديدة
          </button>

          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-bold text-gray-900">{cat.nameAr}</p>
                  <p className="text-xs text-gray-400">{cat.nameEn} · {cat._count?.products ?? 0} منتج</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCatModal({ open: true, data: { nameAr: cat.nameAr, nameEn: cat.nameEn, nameFr: cat.nameFr, nameEs: cat.nameEs, nameDe: cat.nameDe }, id: cat.id })}
                    className="p-2 text-gray-400 hover:text-emerald-600 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCategory(cat.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PRODUCTS TAB ──────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {categories.map((cat) => {
            const catProducts = products.filter(p => p.categoryId === cat.id)
            const expanded    = expandedCat === cat.id
            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Category header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedCat(expanded ? null : cat.id)}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-gray-900">{cat.nameAr}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{catProducts.length}</span>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {expanded && (
                  <div className="border-t border-gray-50 px-4 pb-4 pt-2 space-y-2">
                    {catProducts.map(p => (
                      <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${p.isAvailable ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                        {/* Image */}
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.nameEn} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-gray-300" />
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{p.nameAr}</p>
                          <p className="text-xs text-gray-400 truncate">{p.nameEn}</p>
                          <p className="text-sm font-bold text-emerald-600 mt-0.5">{Number(p.price).toFixed(2)}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleAvailable(p)}
                            className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${p.isAvailable ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {p.isAvailable ? 'متاح' : 'غير متاح'}
                          </button>
                          <button onClick={() => openEditProduct(p)} className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => openNewProduct(cat.id)}
                      className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2 w-full justify-center border-2 border-dashed border-emerald-200 rounded-xl hover:border-emerald-400 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> إضافة منتج
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── CATEGORY MODAL ───────────────────────────────────── */}
      {catModal.open && (
        <Modal title={catModal.id ? 'تعديل الفئة' : 'فئة جديدة'} onClose={() => setCatModal({ open: false, data: { ...EMPTY_CAT } })}>
          <div className="space-y-3">
            {[
              { key: 'nameAr', label: 'الاسم بالعربية *', dir: 'rtl'  as const },
              { key: 'nameEn', label: 'الاسم بالإنجليزية *', dir: 'ltr' as const },
              { key: 'nameFr', label: 'الاسم بالفرنسية', dir: 'ltr' as const },
              { key: 'nameEs', label: 'الاسم بالإسبانية', dir: 'ltr' as const },
              { key: 'nameDe', label: 'الاسم بالألمانية', dir: 'ltr' as const },
            ].map(({ key, label, dir }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                <input
                  dir={dir}
                  value={(catModal.data as any)[key]}
                  onChange={e => setCatModal(m => ({ ...m, data: { ...m.data, [key]: e.target.value } }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            ))}
            <button onClick={saveCategory} disabled={saving} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ
            </button>
          </div>
        </Modal>
      )}

      {/* ── PRODUCT MODAL ────────────────────────────────────── */}
      {prdModal.open && (
        <Modal title={prdModal.id ? 'تعديل المنتج' : 'منتج جديد'} onClose={() => setPrdModal({ open: false, data: { ...EMPTY_PRD } })}>
          <div className="space-y-3">
            {/* Image upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">صورة المنتج</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                  {imgPreview ? (
                    <img src={imgPreview} className="w-full h-full object-cover" alt="preview" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <label className="flex-1 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-center text-sm text-gray-500 cursor-pointer hover:border-emerald-400 transition-colors">
                  اختر صورة أو اسحبها هنا
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              </div>
              {imgPreview && (
                <input
                  placeholder="أو ضع رابط الصورة مباشرة"
                  value={imgPreview.startsWith('data:') ? '' : imgPreview}
                  onChange={e => setImgPreview(e.target.value)}
                  dir="ltr"
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none"
                />
              )}
              {!imgPreview && (
                <input
                  placeholder="أو ضع رابط الصورة مباشرة"
                  onChange={e => setImgPreview(e.target.value)}
                  dir="ltr"
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none"
                />
              )}
            </div>

            {[
              { key: 'nameAr', label: 'الاسم بالعربية *', dir: 'rtl'  as const },
              { key: 'nameEn', label: 'الاسم بالإنجليزية *', dir: 'ltr' as const },
              { key: 'nameFr', label: 'الاسم بالفرنسية', dir: 'ltr' as const },
            ].map(({ key, label, dir }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                <input dir={dir} value={(prdModal.data as any)[key]}
                  onChange={e => setPrdModal(m => ({ ...m, data: { ...m.data, [key]: e.target.value } }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">السعر *</label>
              <div className="relative">
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="number" step="0.01" min="0" value={prdModal.data.price}
                  onChange={e => setPrdModal(m => ({ ...m, data: { ...m.data, price: e.target.value } }))}
                  className="w-full pr-9 pl-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" dir="ltr" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف</label>
              <textarea rows={2} value={prdModal.data.description}
                onChange={e => setPrdModal(m => ({ ...m, data: { ...m.data, description: e.target.value } }))}
                dir="rtl"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            <button onClick={saveProduct} disabled={saving} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ المنتج
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'}`}>
      {children}
    </button>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
