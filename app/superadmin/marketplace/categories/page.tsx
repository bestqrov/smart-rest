'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Tag, Plus, Edit2, Trash2, ChevronRight, ChevronDown,
  Check, X, Search, RefreshCw, Eye, EyeOff,
} from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string; name: string; slug: string; parentId?: string
  icon?: string; description?: string; active: boolean; sortOrder: number
  children: Category[]
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الفئات', subtitle: 'إدارة تصنيفات المنتجات',
    add: 'إضافة فئة', search: 'بحث في الفئات...', refresh: 'تحديث',
    name: 'الاسم', slug: 'المعرف', parent: 'الفئة الأم', icon: 'أيقونة',
    description: 'الوصف', save: 'حفظ', cancel: 'إلغاء', edit: 'تعديل',
    delete: 'حذف', activate: 'تفعيل', deactivate: 'تعطيل',
    active: 'نشط', inactive: 'معطل', loading: 'جاري التحميل...',
    confirmDelete: 'هل أنت متأكد من الحذف؟', noCategories: 'لا توجد فئات',
    optional: 'اختياري', sortOrder: 'الترتيب',
  },
  en: {
    title: 'Categories', subtitle: 'Manage product taxonomy',
    add: 'Add Category', search: 'Search categories...', refresh: 'Refresh',
    name: 'Name', slug: 'Slug', parent: 'Parent Category', icon: 'Icon',
    description: 'Description', save: 'Save', cancel: 'Cancel', edit: 'Edit',
    delete: 'Delete', activate: 'Activate', deactivate: 'Deactivate',
    active: 'Active', inactive: 'Inactive', loading: 'Loading...',
    confirmDelete: 'Are you sure you want to delete?', noCategories: 'No categories found',
    optional: 'optional', sortOrder: 'Sort Order',
  },
}

// ─── Category node (recursive) ────────────────────────────────────────────────

function CategoryNode({
  cat, depth, t, header, onRefresh, allFlat,
}: {
  cat: Category; depth: number; t: typeof T['ar']
  header: () => Record<string, string>; onRefresh: () => void
  allFlat: Category[]
}) {
  const [expanded, setExpanded]   = useState(true)
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm] = useState({
    name: cat.name, slug: cat.slug, icon: cat.icon ?? '',
    description: cat.description ?? '', sortOrder: cat.sortOrder,
  })

  const hasChildren = cat.children.length > 0

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/superadmin/marketplace/categories/${cat.id}`, {
        method:  'PATCH',
        headers: { ...header(), 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      setEditing(false)
      onRefresh()
    } finally { setSaving(false) }
  }

  async function toggleActive() {
    await fetch(`/api/superadmin/marketplace/categories/${cat.id}`, {
      method:  'PATCH',
      headers: { ...header(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: !cat.active }),
    })
    onRefresh()
  }

  async function del() {
    if (!confirm(t.confirmDelete)) return
    await fetch(`/api/superadmin/marketplace/categories/${cat.id}`, {
      method: 'DELETE', headers: header(),
    })
    onRefresh()
  }

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg group hover:bg-zinc-800 transition-colors ${depth > 0 ? 'ms-6 border-s border-zinc-800' : ''}`}
      >
        {/* Expand toggle */}
        <button onClick={() => setExpanded(e => !e)} className="w-5 h-5 flex items-center justify-center text-zinc-500">
          {hasChildren ? (expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : <span className="w-4" />}
        </button>

        {/* Icon */}
        <span className="text-lg w-7 text-center">{cat.icon || '📦'}</span>

        {editing ? (
          <div className="flex-1 grid grid-cols-2 gap-2">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 border border-zinc-600" />
            <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              placeholder={t.icon} className="bg-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 border border-zinc-600" />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t.description} className="bg-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 border border-zinc-600 col-span-2" />
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-3">
            <span className={`font-medium ${cat.active ? 'text-zinc-100' : 'text-zinc-500 line-through'}`}>{cat.name}</span>
            <span className="text-xs text-zinc-500 hidden md:block">{cat.slug}</span>
            {cat.description && <span className="text-xs text-zinc-500 hidden lg:block truncate max-w-[200px]">{cat.description}</span>}
            <span className={`text-xs px-2 py-0.5 rounded ${cat.active ? 'bg-green-900 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
              {cat.active ? t.active : t.inactive}
            </span>
            <span className="text-xs text-zinc-600">{cat.children.length} children</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {editing ? (
            <>
              <button onClick={save} disabled={saving}
                className="p-1.5 rounded text-green-400 hover:bg-green-900/30"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditing(false)}
                className="p-1.5 rounded text-red-400 hover:bg-red-900/30"><X className="w-4 h-4" /></button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700">
                <Edit2 className="w-4 h-4" /></button>
              <button onClick={toggleActive}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700">
                {cat.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              <button onClick={del}
                className="p-1.5 rounded text-red-400 hover:bg-red-900/30"><Trash2 className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && cat.children.map(child => (
        <CategoryNode key={child.id} cat={child} depth={depth + 1} t={t} header={header} onRefresh={onRefresh} allFlat={allFlat} />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [lang, setLang]       = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [tree, setTree]       = useState<Category[]>([])
  const [flat, setFlat]       = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [newCat, setNewCat]   = useState({ name: '', slug: '', parentId: '', icon: '', description: '', sortOrder: 0 })
  const t = T[lang]
  const isRTL = lang === 'ar'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [treeRes, flatRes] = await Promise.all([
        fetch('/api/superadmin/marketplace/categories?tree=1&onlyActive=0', { headers: header() }),
        fetch('/api/superadmin/marketplace/categories?onlyActive=0', { headers: header() }),
      ])
      const { tree: treeData } = await treeRes.json()
      const { categories }     = await flatRes.json()
      setTree(treeData ?? [])
      setFlat(categories ?? [])
    } finally { setLoading(false) }
  }, [header])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  async function create() {
    if (!newCat.name) return
    setSaving(true)
    try {
      await fetch('/api/superadmin/marketplace/categories', {
        method:  'POST',
        headers: { ...header(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...newCat, parentId: newCat.parentId || undefined }),
      })
      setNewCat({ name: '', slug: '', parentId: '', icon: '', description: '', sortOrder: 0 })
      setShowForm(false)
      load()
    } finally { setSaving(false) }
  }

  const filtered = search
    ? tree.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase()))
    : tree

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Tag className="w-7 h-7 text-purple-400" />{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg">{lang === 'ar' ? 'EN' : 'ع'}</button>
          <button onClick={load} disabled={loading} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />{t.add}
          </button>
        </div>
      </div>

      {/* New category form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">{t.name} *</label>
              <input value={newCat.name} onChange={e => setNewCat(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">{t.slug} ({t.optional})</label>
              <input value={newCat.slug} onChange={e => setNewCat(f => ({ ...f, slug: e.target.value }))}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">{t.icon} ({t.optional})</label>
              <input value={newCat.icon} onChange={e => setNewCat(f => ({ ...f, icon: e.target.value }))}
                placeholder="📦" className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">{t.parent} ({t.optional})</label>
              <select value={newCat.parentId} onChange={e => setNewCat(f => ({ ...f, parentId: e.target.value }))}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100">
                <option value="">— {t.parent} —</option>
                {flat.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">{t.description} ({t.optional})</label>
              <input value={newCat.description} onChange={e => setNewCat(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">{t.sortOrder}</label>
              <input type="number" value={newCat.sortOrder} onChange={e => setNewCat(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={create} disabled={saving || !newCat.name}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg text-sm font-medium disabled:opacity-50">
              {t.save}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">{t.cancel}</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl ps-10 pe-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500" />
      </div>

      {/* Tree */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        {loading ? (
          <div className="flex items-center gap-3 text-zinc-400 py-10 justify-center">
            <RefreshCw className="w-5 h-5 animate-spin" />{t.loading}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-zinc-500 text-center py-10">{t.noCategories}</p>
        ) : (
          filtered.map(cat => (
            <CategoryNode key={cat.id} cat={cat} depth={0} t={t} header={header} onRefresh={load} allFlat={flat} />
          ))
        )}
      </div>
    </div>
  )
}
