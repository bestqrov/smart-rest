'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Contact, Search, Phone, X, ChevronLeft, ChevronRight, Loader2,
  Tag as TagIcon, StickyNote, Heart, Calendar, Star, Plus,
} from 'lucide-react'
import { useLang } from '../lang-context'

// ─── Types (mirrors CafeCustomer + CustomerService.getCustomerProfile) ─────

interface CustomerRow {
  id: string
  phone: string
  name: string | null
  tags: string[]
  favoriteProductIds: string[]
  lastVisit: string | null
  visits: number
}

interface OrderRow {
  id: string
  createdAt: string
  totalPrice: number
  status: string
  isPaid: boolean
}

interface CustomerProfile {
  customer: CustomerRow & { notes: string | null }
  orderHistory: OrderRow[]
  visitHistory: string[]
  loyaltyPoints: number
}

interface ListResponse {
  items: CustomerRow[]
  total: number
  page: number
  pages: number
}

// ─── i18n ───────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الزبناء', subtitle: 'بحث، تاغات، ملاحظات، والمفضلة ديال كل زبون',
    totalCustomers: 'إجمالي الزبناء',
    search: 'قلب برقم الهاتف ولا الاسم…',
    phone: 'الهاتف', name: 'الاسم', visits: 'الزيارات', lastVisit: 'آخر زيارة', tags: 'التاغات',
    noData: 'ماكاينش زبناء بحال هادشي', loading: 'كيتحمل…',
    close: 'إغلاق', notes: 'ملاحظات', notesPlaceholder: 'اكتب ملاحظة على هاد الزبون…', save: 'حفظ',
    orderHistory: 'تاريخ الطلبات', loyaltyPoints: 'نقاط الولاء', favorites: 'المفضلة',
    addTag: 'زيد تاغ', tagPlaceholder: 'اسم التاغ…', add: 'زيد', remove: 'حيد',
    noOrders: 'ماكاينش طلبات بعد', noFavorites: 'ماكاينش منتجات مفضلة بعد',
    saved: 'تم الحفظ', page: 'صفحة',
  },
  en: {
    title: 'Customers', subtitle: 'Search, tags, notes, and favorites for every customer',
    totalCustomers: 'Total customers',
    search: 'Search by phone or name…',
    phone: 'Phone', name: 'Name', visits: 'Visits', lastVisit: 'Last visit', tags: 'Tags',
    noData: 'No customers found', loading: 'Loading…',
    close: 'Close', notes: 'Notes', notesPlaceholder: 'Write a note about this customer…', save: 'Save',
    orderHistory: 'Order history', loyaltyPoints: 'Loyalty points', favorites: 'Favorites',
    addTag: 'Add tag', tagPlaceholder: 'Tag name…', add: 'Add', remove: 'Remove',
    noOrders: 'No orders yet', noFavorites: 'No favorite products yet',
    saved: 'Saved', page: 'Page',
  },
  fr: {
    title: 'Clients', subtitle: 'Recherche, tags, notes et favoris pour chaque client',
    totalCustomers: 'Total clients',
    search: 'Rechercher par téléphone ou nom…',
    phone: 'Téléphone', name: 'Nom', visits: 'Visites', lastVisit: 'Dernière visite', tags: 'Tags',
    noData: 'Aucun client trouvé', loading: 'Chargement…',
    close: 'Fermer', notes: 'Notes', notesPlaceholder: 'Écrire une note sur ce client…', save: 'Enregistrer',
    orderHistory: 'Historique des commandes', loyaltyPoints: 'Points fidélité', favorites: 'Favoris',
    addTag: 'Ajouter un tag', tagPlaceholder: 'Nom du tag…', add: 'Ajouter', remove: 'Retirer',
    noOrders: 'Aucune commande', noFavorites: 'Aucun produit favori',
    saved: 'Enregistré', page: 'Page',
  },
  es: {
    title: 'Clientes', subtitle: 'Búsqueda, etiquetas, notas y favoritos de cada cliente',
    totalCustomers: 'Total de clientes',
    search: 'Buscar por teléfono o nombre…',
    phone: 'Teléfono', name: 'Nombre', visits: 'Visitas', lastVisit: 'Última visita', tags: 'Etiquetas',
    noData: 'No se encontraron clientes', loading: 'Cargando…',
    close: 'Cerrar', notes: 'Notas', notesPlaceholder: 'Escribe una nota sobre este cliente…', save: 'Guardar',
    orderHistory: 'Historial de pedidos', loyaltyPoints: 'Puntos de fidelidad', favorites: 'Favoritos',
    addTag: 'Agregar etiqueta', tagPlaceholder: 'Nombre de la etiqueta…', add: 'Agregar', remove: 'Quitar',
    noOrders: 'Aún no hay pedidos', noFavorites: 'Aún no hay productos favoritos',
    saved: 'Guardado', page: 'Página',
  },
} as const

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export default function CustomersPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as keyof typeof T] ?? T.en

  const [rows,    setRows]    = useState<CustomerRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(1)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(false)

  const [selected, setSelected] = useState<string | null>(null)
  const [profile,  setProfile]  = useState<CustomerProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [newTag, setNewTag] = useState('')

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/customers?${params}`, { headers: authHeaders() })
      if (res.ok) {
        const d: ListResponse = await res.json()
        setRows(d.items ?? [])
        setTotal(d.total ?? 0)
        setPages(d.pages ?? 1)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { setPage(1); load(1, search) }, [search]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(page, search) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openCustomer(phone: string) {
    setSelected(phone)
    setProfileLoading(true)
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(phone)}`, { headers: authHeaders() })
      if (res.ok) {
        const d: CustomerProfile = await res.json()
        setProfile(d)
        setNotesDraft(d.customer.notes ?? '')
      }
    } finally { setProfileLoading(false) }
  }

  function closeCustomer() {
    setSelected(null)
    setProfile(null)
    setNewTag('')
  }

  async function saveNotes() {
    if (!selected) return
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(selected)}/notes`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ notes: notesDraft }),
      })
      if (res.ok) {
        const d = await res.json()
        setProfile(p => p ? { ...p, customer: { ...p.customer, notes: d.customer.notes } } : p)
      }
    } finally { setSavingNotes(false) }
  }

  async function addTag() {
    if (!selected || !newTag.trim()) return
    const tag = newTag.trim()
    const res = await fetch(`/api/admin/customers/${encodeURIComponent(selected)}/tags`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ action: 'add', tag }),
    })
    if (res.ok) {
      setNewTag('')
      const d = await res.json()
      setProfile(p => p ? { ...p, customer: { ...p.customer, tags: d.customer.tags } } : p)
      setRows(rs => rs.map(r => r.phone === selected ? { ...r, tags: d.customer.tags } : r))
    }
  }

  async function removeTag(tag: string) {
    if (!selected) return
    const res = await fetch(`/api/admin/customers/${encodeURIComponent(selected)}/tags`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ action: 'remove', tag }),
    })
    if (res.ok) {
      const d = await res.json()
      setProfile(p => p ? { ...p, customer: { ...p.customer, tags: d.customer.tags } } : p)
      setRows(rs => rs.map(r => r.phone === selected ? { ...r, tags: d.customer.tags } : r))
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
          <Contact className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-black text-xl">{t.title}</h1>
          <p className="text-gray-500 text-xs">{t.subtitle} · {total} {t.totalCustomers.toLowerCase()}</p>
        </div>
      </div>

      <div className="relative">
        <Search className={`w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t.search}
          className={`w-full bg-white border border-gray-200 rounded-xl py-3 text-sm focus:outline-none focus:border-emerald-500 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">{t.noData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className={`px-4 py-2.5 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t.name}</th>
                  <th className={`px-4 py-2.5 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t.phone}</th>
                  <th className={`px-4 py-2.5 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t.visits}</th>
                  <th className={`px-4 py-2.5 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t.lastVisit}</th>
                  <th className={`px-4 py-2.5 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t.tags}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id} onClick={() => openCustomer(c.phone)}
                    className="border-b border-gray-50 hover:bg-emerald-50/50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5 font-medium">{c.name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />{c.phone}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{c.visits}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 text-[10px] font-bold">{tag}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500">{t.page} {page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Customer detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={closeCustomer} />
          <div className={`fixed top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl overflow-y-auto ${isRTL ? 'left-0' : 'right-0'}`}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h2 className="font-black text-lg">{profile?.customer.name || selected}</h2>
              <button onClick={closeCustomer} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            {profileLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : profile ? (
              <div className="p-5 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1"><Star className="w-3 h-3" />{t.loyaltyPoints}</p>
                    <p className="text-xl font-black text-emerald-800">{profile.loyaltyPoints}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-[10px] text-blue-700 font-bold flex items-center gap-1"><Calendar className="w-3 h-3" />{t.visits}</p>
                    <p className="text-xl font-black text-blue-800">{profile.customer.visits}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2"><TagIcon className="w-3.5 h-3.5" />{t.tags}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {profile.customer.tags.map(tag => (
                      <span key={tag} className="bg-emerald-100 text-emerald-700 rounded-full pl-2 pr-1 py-1 text-xs font-bold flex items-center gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center text-[10px]">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder={t.tagPlaceholder}
                      onKeyDown={e => e.key === 'Enter' && addTag()}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500" />
                    <button onClick={addTag} className="bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                      <Plus className="w-3 h-3" />{t.add}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2"><StickyNote className="w-3.5 h-3.5" />{t.notes}</p>
                  <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder={t.notesPlaceholder}
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                  <button onClick={saveNotes} disabled={savingNotes}
                    className="mt-2 bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                    {savingNotes ? t.loading : t.save}
                  </button>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2"><Heart className="w-3.5 h-3.5" />{t.favorites}</p>
                  {profile.customer.favoriteProductIds.length === 0 ? (
                    <p className="text-xs text-gray-400">{t.noFavorites}</p>
                  ) : (
                    <p className="text-xs text-gray-500">{profile.customer.favoriteProductIds.length} {t.favorites.toLowerCase()}</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">{t.orderHistory}</p>
                  {profile.orderHistory.length === 0 ? (
                    <p className="text-xs text-gray-400">{t.noOrders}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {profile.orderHistory.slice(0, 10).map(o => (
                        <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                          <span className="text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</span>
                          <span className="font-bold">{o.totalPrice.toFixed(2)}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${o.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{o.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
