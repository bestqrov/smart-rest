'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Gift, Search, X, ChevronLeft, ChevronRight, Phone,
  Star, TrendingUp, TrendingDown, RefreshCw, Loader2,
  Users, Award, ArrowUpRight, ArrowDownRight, Clock,
  CheckCircle2, AlertCircle, ChevronDown,
} from 'lucide-react'
import { useLang } from '../lang-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoyaltyCustomer {
  id:        string
  phone:     string
  points:    number
  createdAt: string
  updatedAt: string
}

interface LedgerEntry {
  type:      'EARN' | 'REDEEM'
  points:    number
  orderId:   string | null
  note:      string
  createdAt: string
}

interface CustomerDetail {
  phone:   string
  points:  number
  ledger:  LedgerEntry[]
}

interface CustomersResponse {
  accounts: LoyaltyCustomer[]
  total:    number
  page:     number
  pages:    number
}

// ─── Static reward tiers ──────────────────────────────────────────────────────

const REWARDS = [
  { id: 'r1', pts: 50,  icon: '☕', label: { ar: 'مشروب مجاني',    fr: 'Boisson offerte',     en: 'Free drink',       es: 'Bebida gratis'    } },
  { id: 'r2', pts: 100, icon: '🍰', label: { ar: 'حلوى مجانية',    fr: 'Dessert offert',      en: 'Free dessert',     es: 'Postre gratis'    } },
  { id: 'r3', pts: 200, icon: '🍽️', label: { ar: 'طبق رئيسي مجاني', fr: 'Plat offert',         en: 'Free main dish',   es: 'Plato gratis'     } },
  { id: 'r4', pts: 500, icon: '🎉', label: { ar: 'وجبة كاملة للاثنين', fr: 'Repas complet ×2',  en: 'Full meal for 2',  es: 'Comida completa ×2' } },
]

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title:         'برنامج الولاء',
    subtitle:      'إدارة نقاط وجوائز الزبائن',
    totalCustomers:'إجمالي الزبائن',
    tabCustomers:  'الزبائن',
    tabRewards:    'الجوائز',
    search:        'ابحث برقم الهاتف...',
    sortBy:        'ترتيب حسب',
    sortPoints:    'النقاط',
    sortDate:      'آخر نشاط',
    descending:    'تنازلي',
    ascending:     'تصاعدي',
    phone:         'الهاتف',
    points:        'النقاط',
    lastActivity:  'آخر نشاط',
    viewProfile:   'عرض الملف',
    noCustomers:   'لا يوجد زبائن بعد',
    noCustomersSub:'ستظهر هنا بعد أول طلب يحصل على نقاط',
    profileTitle:  'ملف الزبون',
    balance:       'الرصيد الحالي',
    historyTitle:  'سجل النقاط',
    earnLabel:     'ربح',
    redeemLabel:   'استخدام',
    noHistory:     'لا يوجد سجل بعد',
    redeemBtn:     'استبدال نقاط',
    redeemTitle:   'استبدال النقاط',
    redeemPoints:  'عدد النقاط للاستبدال',
    redeemMax:     'الحد الأقصى',
    redeemConfirm: 'تأكيد الاستبدال',
    redeemCancel:  'إلغاء',
    redeemSuccess: 'تم الاستبدال بنجاح',
    redeemError:   'نقاط غير كافية',
    close:         'إغلاق',
    rewardTitle:   'كتالوج الجوائز',
    rewardSub:     'الجوائز المتاحة للزبائن عند استبدال نقاطهم',
    rewardPoints:  'نقطة',
    redeem:        'استبدل',
    tier:          'المستوى',
    bronze:        'برونز',
    silver:        'فضي',
    gold:          'ذهبي',
    platinum:      'بلاتيني',
    prev:          'السابق',
    next:          'التالي',
    page:          'صفحة',
    of:            'من',
  },
  fr: {
    title:         'Programme Fidélité',
    subtitle:      'Gérez les points et récompenses clients',
    totalCustomers:'Total clients',
    tabCustomers:  'Clients',
    tabRewards:    'Récompenses',
    search:        'Rechercher par téléphone...',
    sortBy:        'Trier par',
    sortPoints:    'Points',
    sortDate:      'Dernière activité',
    descending:    'Décroissant',
    ascending:     'Croissant',
    phone:         'Téléphone',
    points:        'Points',
    lastActivity:  'Dernière activité',
    viewProfile:   'Voir le profil',
    noCustomers:   'Aucun client pour l\'instant',
    noCustomersSub:'Ils apparaîtront après la première commande récompensée',
    profileTitle:  'Profil client',
    balance:       'Solde actuel',
    historyTitle:  'Historique des points',
    earnLabel:     'Gain',
    redeemLabel:   'Rachat',
    noHistory:     'Aucun historique',
    redeemBtn:     'Échanger des points',
    redeemTitle:   'Échange de points',
    redeemPoints:  'Points à échanger',
    redeemMax:     'Maximum',
    redeemConfirm: 'Confirmer l\'échange',
    redeemCancel:  'Annuler',
    redeemSuccess: 'Échange effectué avec succès',
    redeemError:   'Points insuffisants',
    close:         'Fermer',
    rewardTitle:   'Catalogue des récompenses',
    rewardSub:     'Récompenses disponibles pour vos clients',
    rewardPoints:  'pts',
    redeem:        'Échanger',
    tier:          'Niveau',
    bronze:        'Bronze',
    silver:        'Argent',
    gold:          'Or',
    platinum:      'Platine',
    prev:          'Précédent',
    next:          'Suivant',
    page:          'Page',
    of:            'sur',
  },
  en: {
    title:         'Loyalty Program',
    subtitle:      'Manage customer points and rewards',
    totalCustomers:'Total customers',
    tabCustomers:  'Customers',
    tabRewards:    'Rewards',
    search:        'Search by phone...',
    sortBy:        'Sort by',
    sortPoints:    'Points',
    sortDate:      'Last activity',
    descending:    'Descending',
    ascending:     'Ascending',
    phone:         'Phone',
    points:        'Points',
    lastActivity:  'Last activity',
    viewProfile:   'View profile',
    noCustomers:   'No customers yet',
    noCustomersSub:'They will appear after the first rewarded order',
    profileTitle:  'Customer profile',
    balance:       'Current balance',
    historyTitle:  'Points history',
    earnLabel:     'Earned',
    redeemLabel:   'Redeemed',
    noHistory:     'No history yet',
    redeemBtn:     'Redeem points',
    redeemTitle:   'Redeem points',
    redeemPoints:  'Points to redeem',
    redeemMax:     'Maximum',
    redeemConfirm: 'Confirm redemption',
    redeemCancel:  'Cancel',
    redeemSuccess: 'Redeemed successfully',
    redeemError:   'Insufficient points',
    close:         'Close',
    rewardTitle:   'Rewards catalog',
    rewardSub:     'Available rewards for your customers',
    rewardPoints:  'pts',
    redeem:        'Redeem',
    tier:          'Tier',
    bronze:        'Bronze',
    silver:        'Silver',
    gold:          'Gold',
    platinum:      'Platinum',
    prev:          'Previous',
    next:          'Next',
    page:          'Page',
    of:            'of',
  },
  es: {
    title:         'Programa de Fidelidad',
    subtitle:      'Gestiona puntos y recompensas de clientes',
    totalCustomers:'Total clientes',
    tabCustomers:  'Clientes',
    tabRewards:    'Recompensas',
    search:        'Buscar por teléfono...',
    sortBy:        'Ordenar por',
    sortPoints:    'Puntos',
    sortDate:      'Última actividad',
    descending:    'Descendente',
    ascending:     'Ascendente',
    phone:         'Teléfono',
    points:        'Puntos',
    lastActivity:  'Última actividad',
    viewProfile:   'Ver perfil',
    noCustomers:   'Sin clientes aún',
    noCustomersSub:'Aparecerán tras el primer pedido premiado',
    profileTitle:  'Perfil del cliente',
    balance:       'Saldo actual',
    historyTitle:  'Historial de puntos',
    earnLabel:     'Ganado',
    redeemLabel:   'Canjeado',
    noHistory:     'Sin historial aún',
    redeemBtn:     'Canjear puntos',
    redeemTitle:   'Canjear puntos',
    redeemPoints:  'Puntos a canjear',
    redeemMax:     'Máximo',
    redeemConfirm: 'Confirmar canje',
    redeemCancel:  'Cancelar',
    redeemSuccess: 'Canje exitoso',
    redeemError:   'Puntos insuficientes',
    close:         'Cerrar',
    rewardTitle:   'Catálogo de recompensas',
    rewardSub:     'Recompensas disponibles para tus clientes',
    rewardPoints:  'pts',
    redeem:        'Canjear',
    tier:          'Nivel',
    bronze:        'Bronce',
    silver:        'Plata',
    gold:          'Oro',
    platinum:      'Platino',
    prev:          'Anterior',
    next:          'Siguiente',
    page:          'Página',
    of:            'de',
  },
} as const

type Lang = keyof typeof T

function getTier(pts: number, t: typeof T[Lang]) {
  if (pts >= 1000) return { label: t.platinum, color: 'text-cyan-400',   bg: 'bg-cyan-500/15',   ring: 'ring-cyan-500/30'   }
  if (pts >= 500)  return { label: t.gold,     color: 'text-amber-400',  bg: 'bg-amber-500/15',  ring: 'ring-amber-500/30'  }
  if (pts >= 200)  return { label: t.silver,   color: 'text-slate-300',  bg: 'bg-slate-500/15',  ring: 'ring-slate-500/30'  }
  return                  { label: t.bronze,   color: 'text-orange-400', bg: 'bg-orange-500/15', ring: 'ring-orange-500/30' }
}

function fmtDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(
    lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' }
  )
}

function fmtDateTime(iso: string, lang: string) {
  return new Date(iso).toLocaleString(
    lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const { lang } = useLang() as { lang: Lang }
  const t   = T[lang] ?? T.fr
  const isRTL = lang === 'ar'

  // ── List state ─────────────────────────────────────────────────────────────
  const [tab,        setTab]        = useState<'customers' | 'rewards'>('customers')
  const [customers,  setCustomers]  = useState<LoyaltyCustomer[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [pages,      setPages]      = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [sortBy,     setSortBy]     = useState<'points' | 'updatedAt'>('points')
  const [order,      setOrder]      = useState<'asc' | 'desc'>('desc')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile,        setProfile]        = useState<CustomerDetail | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showProfile,    setShowProfile]    = useState(false)

  // ── Redeem state ───────────────────────────────────────────────────────────
  const [showRedeem,     setShowRedeem]     = useState(false)
  const [redeemPts,      setRedeemPts]      = useState('')
  const [redeemLoading,  setRedeemLoading]  = useState(false)
  const [redeemMsg,      setRedeemMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // ── Fetch customers ────────────────────────────────────────────────────────
  const loadCustomers = useCallback(async (q = search, pg = page, srt = sortBy, ord = order) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: '20', sort: srt, order: ord })
      if (q) params.set('search', q)
      const res  = await fetch(`/api/loyalty/customers?${params}`, { headers: h })
      const data: CustomersResponse = await res.json()
      setCustomers(data.accounts ?? [])
      setTotal(data.total ?? 0)
      setPages(data.pages ?? 1)
    } catch {}
    finally { setLoading(false) }
  }, [search, page, sortBy, order])

  useEffect(() => { loadCustomers() }, [page, sortBy, order])

  // debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => { setPage(1); loadCustomers(search, 1, sortBy, order) }, 350)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [search])

  // ── Load profile ───────────────────────────────────────────────────────────
  async function openProfile(phone: string) {
    setShowProfile(true)
    setProfile(null)
    setProfileLoading(true)
    setRedeemMsg(null)
    try {
      const res  = await fetch(`/api/loyalty/${encodeURIComponent(phone)}`, { headers: h })
      const data = await res.json()
      setProfile(data)
    } catch {}
    finally { setProfileLoading(false) }
  }

  // ── Redeem ─────────────────────────────────────────────────────────────────
  async function handleRedeem() {
    if (!profile) return
    const pts = Number(redeemPts)
    if (!pts || pts <= 0) return
    setRedeemLoading(true); setRedeemMsg(null)
    try {
      const res  = await fetch('/api/loyalty/redeem', {
        method: 'POST', headers: h,
        body: JSON.stringify({ phone: profile.phone, points: pts }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRedeemMsg({ ok: false, text: data.error ?? t.redeemError })
      } else {
        setRedeemMsg({ ok: true, text: t.redeemSuccess })
        setProfile(prev => prev ? { ...prev, points: data.newBalance } : prev)
        setCustomers(prev => prev.map(c => c.phone === profile.phone ? { ...c, points: data.newBalance } : c))
        setRedeemPts('')
        setTimeout(() => setShowRedeem(false), 1200)
      }
    } catch { setRedeemMsg({ ok: false, text: t.redeemError }) }
    finally { setRedeemLoading(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`max-w-6xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 p-6 shadow-xl shadow-violet-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.10),transparent_65%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Gift className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t.title}</h1>
              <p className="text-sm text-violet-100/70 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl px-4 py-2 text-center">
              <p className="text-2xl font-black text-white">{total}</p>
              <p className="text-[11px] text-violet-200/70">{t.totalCustomers}</p>
            </div>
            <button onClick={() => loadCustomers()} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
        {(['customers', 'rewards'] as const).map(tab_ => (
          <button key={tab_} onClick={() => setTab(tab_)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === tab_ ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}>
            {tab_ === 'customers' ? t.tabCustomers : t.tabRewards}
          </button>
        ))}
      </div>

      {/* ════════════════ CUSTOMERS TAB ════════════════ */}
      {tab === 'customers' && (
        <div className="space-y-4">

          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t.search}
                className={`w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
              />
              {search && (
                <button onClick={() => setSearch('')} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 hover:text-white ${isRTL ? 'left-2' : 'right-2'}`}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t.sortBy}:</span>
              <button onClick={() => { setSortBy('points'); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortBy === 'points' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
                {t.sortPoints}
              </button>
              <button onClick={() => { setSortBy('updatedAt'); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortBy === 'updatedAt' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
                {t.sortDate}
              </button>
              <button onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
                {order === 'desc' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-violet-400" size={32} />
            </div>
          ) : customers.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-14 text-center">
              <Gift size={40} className="mx-auto text-slate-600 mb-3" />
              <p className="text-white font-semibold">{t.noCustomers}</p>
              <p className="text-sm text-slate-500 mt-1">{t.noCustomersSub}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="hidden md:grid grid-cols-[1fr_120px_160px_140px] bg-slate-800/80 px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">
                <span>{t.phone}</span>
                <span className="text-center">{t.points}</span>
                <span className="text-center">{t.tier}</span>
                <span className="text-center">{t.lastActivity}</span>
              </div>

              {customers.map((c, i) => {
                const tier = getTier(c.points, t)
                return (
                  <button key={c.id} onClick={() => openProfile(c.phone)}
                    className={`w-full grid grid-cols-1 md:grid-cols-[1fr_120px_160px_140px] items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/60 active:bg-slate-700/60 transition-colors ${i !== 0 ? 'border-t border-slate-700/60' : ''}`}>

                    {/* Phone */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                        <Phone size={14} className="text-violet-400" />
                      </div>
                      <span className="text-white font-mono text-sm font-medium">{c.phone}</span>
                    </div>

                    {/* Points */}
                    <div className="text-center">
                      <span className="text-lg font-black text-white">{c.points.toLocaleString()}</span>
                      <span className="text-xs text-slate-500 ml-1">{t.rewardPoints}</span>
                    </div>

                    {/* Tier */}
                    <div className="flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ring-1 ${tier.color} ${tier.bg} ${tier.ring}`}>
                        {tier.label}
                      </span>
                    </div>

                    {/* Last activity */}
                    <div className="text-center text-xs text-slate-500">
                      {fmtDate(c.updatedAt, lang)}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <span className="text-sm text-slate-400">
                {t.page} {page} {t.of} {pages}
              </span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ REWARDS CATALOG TAB ════════════════ */}
      {tab === 'rewards' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white">{t.rewardTitle}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{t.rewardSub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {REWARDS.map(r => (
              <div key={r.id} className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 space-y-3 hover:border-violet-500/40 transition-colors">
                <div className="text-4xl">{r.icon}</div>
                <div>
                  <p className="text-white font-semibold">{r.label[lang] ?? r.label.fr}</p>
                  <p className="text-violet-400 font-black text-xl mt-1">
                    {r.pts} <span className="text-sm font-medium text-slate-500">{t.rewardPoints}</span>
                  </p>
                </div>
                <div className={`h-1.5 rounded-full bg-slate-700`}>
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400"
                    style={{ width: `${Math.min(100, (r.pts / 500) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════ CUSTOMER PROFILE PANEL ════════════════ */}
      {showProfile && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfile(false)} />

          {/* Side panel */}
          <div className={`fixed top-0 ${isRTL ? 'left-0' : 'right-0'} z-50 h-full w-full max-w-md bg-slate-900 border-${isRTL ? 'r' : 'l'} border-slate-700 flex flex-col shadow-2xl`}>

            {/* Panel header */}
            <div className="shrink-0 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">{t.profileTitle}</h2>
              <button onClick={() => setShowProfile(false)} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {profileLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-violet-400" size={32} />
              </div>
            ) : profile ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* Balance card */}
                <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-purple-800/30 border border-violet-500/20 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <Phone size={16} className="text-violet-400" />
                    </div>
                    <span className="text-white font-mono font-semibold">{profile.phone}</span>
                  </div>
                  <div className={`flex items-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div>
                      <p className="text-xs text-violet-300/60 uppercase tracking-wide">{t.balance}</p>
                      <p className="text-4xl font-black text-white">{profile.points.toLocaleString()}</p>
                      <p className="text-sm text-violet-300">{t.rewardPoints}</p>
                    </div>
                    <div className={`mb-1 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
                      {(() => { const tier = getTier(profile.points, t); return (
                        <span className={`px-3 py-1.5 rounded-full text-sm font-bold ring-1 ${tier.color} ${tier.bg} ${tier.ring}`}>
                          {tier.label}
                        </span>
                      )})()}
                    </div>
                  </div>
                </div>

                {/* Redeem button */}
                {profile.points > 0 && (
                  <button onClick={() => { setShowRedeem(true); setRedeemMsg(null) }}
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold transition-all flex items-center justify-center gap-2">
                    <Award size={16} />
                    {t.redeemBtn}
                  </button>
                )}

                {/* Points history */}
                <div>
                  <h3 className="text-white font-semibold mb-3">{t.historyTitle}</h3>
                  {profile.ledger.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">{t.noHistory}</div>
                  ) : (
                    <div className="space-y-2">
                      {profile.ledger.map((entry, i) => (
                        <div key={i} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            entry.type === 'EARN' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          }`}>
                            {entry.type === 'EARN'
                              ? <ArrowUpRight size={14} className="text-emerald-400" />
                              : <ArrowDownRight size={14} className="text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 truncate">
                              {entry.type === 'EARN' ? t.earnLabel : t.redeemLabel}
                              {entry.note ? ` · ${entry.note}` : ''}
                            </p>
                            <p className="text-[11px] text-slate-600">{fmtDateTime(entry.createdAt, lang)}</p>
                          </div>
                          <span className={`font-black text-sm shrink-0 ${entry.points > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {entry.points > 0 ? '+' : ''}{entry.points}
                          </span>
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

      {/* ════════════════ REDEEM MODAL ════════════════ */}
      {showRedeem && profile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowRedeem(false)} />
          <div className="relative bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-sm shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">{t.redeemTitle}</h3>
              <button onClick={() => setShowRedeem(false)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-800/60 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-slate-400 text-sm">{t.balance}</span>
              <span className="text-white font-black text-xl">{profile.points} <span className="text-xs text-slate-500 font-normal">{t.rewardPoints}</span></span>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-slate-400">{t.redeemPoints}</label>
              <input
                type="number" min={1} max={profile.points}
                value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
                placeholder={`${t.redeemMax}: ${profile.points}`}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg font-bold placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors"
              />
              {/* Quick-select reward buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {REWARDS.filter(r => r.pts <= profile.points).map(r => (
                  <button key={r.id} onClick={() => setRedeemPts(String(r.pts))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      redeemPts === String(r.pts) ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}>
                    {r.icon} {r.pts}
                  </button>
                ))}
              </div>
            </div>

            {redeemMsg && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                redeemMsg.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              }`}>
                {redeemMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                {redeemMsg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowRedeem(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors text-sm font-semibold">
                {t.redeemCancel}
              </button>
              <button onClick={handleRedeem} disabled={redeemLoading || !redeemPts}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold transition-colors text-sm flex items-center justify-center gap-2">
                {redeemLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {t.redeemConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
