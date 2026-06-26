'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Film, Sparkles, Play, Clock, CheckCircle2, XCircle,
  Loader2, RefreshCw, ExternalLink, AlertTriangle, Award,
  Share2, Smartphone, Trash2, TrendingUp, Video, Zap,
  Search, SlidersHorizontal, ChevronDown, X, BarChart3,
} from 'lucide-react'
import { useLang } from '../lang-context'

// ─── Types ────────────────────────────────────────────────────────────────────

type SubStatus = {
  isTrial:       boolean
  daysLeft:      number
  hasWatermark:  boolean
  billingStatus: string
  country:       string
  platforms:     string[]
}

type CampaignStatus = 'pending' | 'rendering' | 'published' | 'failed'

type Campaign = {
  id:           string
  productName:  string
  productPrice: number
  imageUrl:     string | null
  country:      string
  caption:      string | null
  videoUrl:     string | null
  hasWatermark: boolean
  status:       CampaignStatus
  platforms:    string[]
  socialLinks:  Record<string, string> | null
  createdAt:    string
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title:        'الفيديوهات الترويجية',
    subtitle:     'اصنع فيديوهات بالذكاء الاصطناعي وانشرها تلقائياً',
    published:    'منشور',
    running:      'جارٍ',
    total:        'إجمالي الحملات',
    successRate:  'نسبة النجاح',
    failed:       'فشل',
    history:      'السجل',
    noVideos:     'لا توجد فيديوهات بعد',
    noVideosSub:  'اضغط "توليد فيديو" للبدء',
    noResults:    'لا توجد نتائج',
    noResultsSub: 'جرب تغيير البحث أو الفلتر',
    generate:     'توليد فيديو',
    generating:   'جارٍ التوليد…',
    processing:   'جارٍ المعالجة…',
    watch:        'مشاهدة',
    searchPlh:    'ابحث عن منتج…',
    filterAll:    'كل الحالات',
    loadMore:     'تحميل المزيد',
    detail:       'تفاصيل الحملة',
    product:      'المنتج',
    platforms:    'المنصات',
    caption:      'النص الترويجي',
    links:        'روابط النشر',
    watermark:    'علامة مائية',
    createdAt:    'تاريخ الإنشاء',
    status:       'الحالة',
    close:        'إغلاق',
    delete:       'حذف',
    aiLine:       'الذكاء الاصطناعي يختار أفضل منتج ويصنع فيديو احترافي وينشره على منصاتك تلقائياً.',
    trialBadge:   (d: number) => `تجربة مجانية · ${d} يوم متبقي · مع علامة مائية`,
    stuckLabel:   (m: number) => `متأخر ${m} د`,
    pendingL:     'في الانتظار',
    renderingL:   'جارٍ التوليد',
    publishedL:   'تم النشر',
    failedL:      'فشل',
    genTitle:     'أنشئ فيديو ترويجي بنقرة واحدة',
  },
  fr: {
    title:        'Vidéos Promotionnelles',
    subtitle:     'IA + publication automatique sur vos réseaux',
    published:    'publiée',
    running:      'en cours',
    total:        'Campagnes totales',
    successRate:  'Taux de succès',
    failed:       'Échoué',
    history:      'Historique',
    noVideos:     'Aucune vidéo générée',
    noVideosSub:  'Cliquez sur "Générer" pour commencer',
    noResults:    'Aucun résultat',
    noResultsSub: 'Modifiez la recherche ou le filtre',
    generate:     'Générer',
    generating:   'Génération…',
    processing:   'En cours…',
    watch:        'Voir',
    searchPlh:    'Rechercher un produit…',
    filterAll:    'Tous les statuts',
    loadMore:     'Charger plus',
    detail:       'Détail de la campagne',
    product:      'Produit',
    platforms:    'Plateformes',
    caption:      'Texte promotionnel',
    links:        'Liens de publication',
    watermark:    'Filigrane',
    createdAt:    'Date de création',
    status:       'Statut',
    close:        'Fermer',
    delete:       'Supprimer',
    aiLine:       "L'IA choisit le meilleur produit, génère une vidéo pro et la publie automatiquement.",
    trialBadge:   (d: number) => `Essai · ${d} jour${d !== 1 ? 's' : ''} restant · avec filigrane`,
    stuckLabel:   (m: number) => `Bloqué ${m} min`,
    pendingL:     'En attente',
    renderingL:   'Génération…',
    publishedL:   'Publié',
    failedL:      'Échoué',
    genTitle:     'Créez une vidéo promo en 1 clic',
  },
  en: {
    title:        'Promo Videos',
    subtitle:     'AI-generated · auto-published to social media',
    published:    'published',
    running:      'running',
    total:        'Total campaigns',
    successRate:  'Success rate',
    failed:       'Failed',
    history:      'History',
    noVideos:     'No videos yet',
    noVideosSub:  'Click "Generate" to get started',
    noResults:    'No results',
    noResultsSub: 'Try a different search or filter',
    generate:     'Generate',
    generating:   'Generating…',
    processing:   'Processing…',
    watch:        'Watch',
    searchPlh:    'Search by product…',
    filterAll:    'All statuses',
    loadMore:     'Load more',
    detail:       'Campaign details',
    product:      'Product',
    platforms:    'Platforms',
    caption:      'Promo caption',
    links:        'Published links',
    watermark:    'Watermark',
    createdAt:    'Created',
    status:       'Status',
    close:        'Close',
    delete:       'Delete',
    aiLine:       'AI picks your best product, generates a pro video, and publishes it automatically.',
    trialBadge:   (d: number) => `Trial · ${d} day${d !== 1 ? 's' : ''} left · watermarked`,
    stuckLabel:   (m: number) => `Stuck ${m} min`,
    pendingL:     'Pending',
    renderingL:   'Rendering…',
    publishedL:   'Published',
    failedL:      'Failed',
    genTitle:     'Create a promo video in 1 click',
  },
  es: {
    title:        'Videos Promocionales',
    subtitle:     'IA generativa · publicación automática en redes sociales',
    published:    'publicado',
    running:      'en proceso',
    total:        'Campañas totales',
    successRate:  'Tasa de éxito',
    failed:       'Fallido',
    history:      'Historial',
    noVideos:     'Aún no hay videos',
    noVideosSub:  'Haz clic en "Generar" para empezar',
    noResults:    'Sin resultados',
    noResultsSub: 'Cambia la búsqueda o el filtro',
    generate:     'Generar',
    generating:   'Generando…',
    processing:   'En proceso…',
    watch:        'Ver',
    searchPlh:    'Buscar por producto…',
    filterAll:    'Todos los estados',
    loadMore:     'Cargar más',
    detail:       'Detalles de la campaña',
    product:      'Producto',
    platforms:    'Plataformas',
    caption:      'Texto promocional',
    links:        'Links publicados',
    watermark:    'Marca de agua',
    createdAt:    'Creado',
    status:       'Estado',
    close:        'Cerrar',
    delete:       'Eliminar',
    aiLine:       'La IA elige tu mejor producto, genera un video profesional y lo publica automáticamente.',
    trialBadge:   (d: number) => `Prueba · ${d} día${d !== 1 ? 's' : ''} restante · con marca de agua`,
    stuckLabel:   (m: number) => `Atascado ${m} min`,
    pendingL:     'Pendiente',
    renderingL:   'Renderizando…',
    publishedL:   'Publicado',
    failedL:      'Fallido',
    genTitle:     'Crea un video promo en 1 clic',
  },
} as const

type Lang = keyof typeof T
type Strings = typeof T[Lang]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function countryLabel(c: string) {
  return c === 'SA' ? '🇸🇦 KSA' : c === 'AE' ? '🇦🇪 UAE' : '🇲🇦 Maroc'
}

function platformIcon(p: string) {
  if (p === 'instagram') return <Share2     size={13} className="inline-block" />
  if (p === 'snapchat')  return <Smartphone size={13} className="inline-block" />
  if (p === 'tiktok')   return <Film        size={13} className="inline-block" />
  return null
}

function fmtDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(
    lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB',
    { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  )
}

const STATUS_META = {
  pending:   { bg: 'bg-slate-700/60',   text: 'text-slate-300',   Icon: Clock        },
  rendering: { bg: 'bg-amber-500/15',   text: 'text-amber-300',   Icon: Loader2      },
  published: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', Icon: CheckCircle2 },
  failed:    { bg: 'bg-rose-500/15',    text: 'text-rose-300',    Icon: XCircle      },
} as const

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl px-4 py-3 flex-1 min-w-[110px]">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-slate-500 text-xs mt-0.5 font-medium truncate">{label}</p>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  c, t, lang, isRTL, onClose, onDelete, deleting,
}: {
  c:        Campaign
  t:        Strings
  lang:     string
  isRTL:    boolean
  onClose:  () => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const meta        = STATUS_META[c.status]
  const StatusIcon  = meta.Icon
  const isLive      = c.status === 'pending' || c.status === 'rendering'
  const canDelete   = isLive || c.status === 'failed'

  const statusLabel =
    c.status === 'pending'   ? t.pendingL   :
    c.status === 'rendering' ? t.renderingL :
    c.status === 'published' ? t.publishedL :
    t.failedL

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="text-white font-bold text-sm">{t.detail}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-slate-800">
          {c.imageUrl ? (
            <img src={c.imageUrl} alt={c.productName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="text-slate-700" size={40} />
            </div>
          )}
          {c.videoUrl && (
            <a
              href={c.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/40 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Play className="text-white" size={24} fill="white" />
              </div>
            </a>
          )}
          {/* Delivery progress */}
          {isLive && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80">
              <div
                className="h-full bg-fuchsia-500 animate-pulse transition-all duration-1000"
                style={{ width: c.status === 'rendering' ? '65%' : '20%' }}
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[45vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs font-medium mb-1">{t.product}</p>
              <p className="text-white font-semibold">{c.productName}</p>
              <p className="text-slate-400 text-xs font-mono mt-0.5">{c.productPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-medium mb-1">{t.status}</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.bg} ${meta.text}`}>
                <StatusIcon size={11} className={c.status === 'rendering' ? 'animate-spin' : ''} />
                {statusLabel}
              </span>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-medium mb-1">{t.platforms}</p>
              <div className="flex flex-wrap gap-1.5">
                {c.platforms.map(p => (
                  <span key={p} className="flex items-center gap-1 text-xs text-slate-400 capitalize bg-slate-800 px-2 py-0.5 rounded-lg">
                    {platformIcon(p)} {p}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-medium mb-1">{t.createdAt}</p>
              <p className="text-slate-300 text-xs">{fmtDate(c.createdAt, lang)}</p>
            </div>
          </div>

          {c.hasWatermark && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              <AlertTriangle size={13} className="text-amber-400 shrink-0" />
              <p className="text-amber-300 text-xs font-medium">{t.watermark}</p>
            </div>
          )}

          {c.caption && (
            <div>
              <p className="text-slate-500 text-xs font-medium mb-1.5">{t.caption}</p>
              <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/60 rounded-xl px-3 py-2.5">{c.caption}</p>
            </div>
          )}

          {c.socialLinks && Object.keys(c.socialLinks).length > 0 && (
            <div>
              <p className="text-slate-500 text-xs font-medium mb-1.5">{t.links}</p>
              <div className="space-y-1.5">
                {Object.entries(c.socialLinks).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2 hover:bg-slate-800 transition-colors group"
                  >
                    <span className="text-slate-300 text-xs capitalize font-medium flex items-center gap-2">
                      {platformIcon(platform)} {platform}
                    </span>
                    <ExternalLink size={12} className="text-slate-600 group-hover:text-sky-400 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between gap-3">
          {canDelete ? (
            <button
              onClick={() => onDelete(c.id)}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors disabled:opacity-40"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {t.delete}
            </button>
          ) : <span />}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { lang, isRTL } = useLang() as { lang: Lang; isRTL: boolean }
  const t = T[lang] ?? T.fr

  const [sub,          setSub]          = useState<SubStatus | null>(null)
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([])
  const [nextCursor,   setNextCursor]   = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [cancelling,   setCancelling]   = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [pollingId,    setPollingId]    = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('')
  const [detail,       setDetail]       = useState<Campaign | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [subRes, campRes] = await Promise.all([
        fetch('/api/marketing/subscription-status', { headers: authHeader() }),
        fetch('/api/marketing/campaigns?limit=20',  { headers: authHeader() }),
      ])
      if (subRes.ok) setSub(await subRes.json())
      if (campRes.ok) {
        const data = await campRes.json()
        setCampaigns(data.items ?? [])
        setNextCursor(data.nextCursor ?? null)
      }
      if (!subRes.ok && !campRes.ok) setError('Failed to load data')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Load more ──────────────────────────────────────────────────────────────
  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/marketing/campaigns?limit=20&cursor=${nextCursor}`, { headers: authHeader() })
      if (!res.ok) return
      const data = await res.json()
      setCampaigns(prev => [...prev, ...(data.items ?? [])])
      setNextCursor(data.nextCursor ?? null)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pollingId) return
    const interval = setInterval(async () => {
      const res = await fetch('/api/marketing/campaigns?limit=20', { headers: authHeader() })
      if (!res.ok) return
      const { items } = await res.json()
      setCampaigns(items ?? [])
      const target = (items as Campaign[]).find(c => c.id === pollingId)
      if (!target || (target.status !== 'pending' && target.status !== 'rendering')) {
        setPollingId(null)
        clearInterval(interval)
      }
    }, 8_000)
    return () => clearInterval(interval)
  }, [pollingId])

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/marketing/generate-video', {
        method:  'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Unknown error'); return }
      setCampaigns(prev => [data.campaign, ...prev])
      setPollingId(data.campaign.id)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setCancelling(id)
    try {
      await fetch(`/api/marketing/campaigns/${id}`, { method: 'DELETE', headers: authHeader() })
      setCampaigns(prev => prev.filter(c => c.id !== id))
      if (pollingId === id) setPollingId(null)
      if (detail?.id === id) setDetail(null)
    } finally {
      setCancelling(null)
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => campaigns.filter(c => {
    const matchSearch = !search || c.productName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || c.status === statusFilter
    return matchSearch && matchStatus
  }), [campaigns, search, statusFilter])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = campaigns.length
    const published = campaigns.filter(c => c.status === 'published').length
    const failed    = campaigns.filter(c => c.status === 'failed').length
    const pending   = campaigns.filter(c => c.status === 'pending' || c.status === 'rendering').length
    const rate      = total > 0 ? Math.round((published / total) * 100) : 0
    return { total, published, failed, pending, rate }
  }, [campaigns])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-fuchsia-500" size={36} />
      </div>
    )
  }

  if (error && campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="text-rose-400" size={40} />
        <p className="text-slate-300 font-medium">{error}</p>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div
      className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
            <Video className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">{t.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats.pending > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-300 font-medium">{stats.pending} {t.running}</span>
            </div>
          )}
          <button
            onClick={loadData}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {campaigns.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <StatCard label={t.total}       value={stats.total}      color="text-white"       />
          <StatCard label={t.published}   value={stats.published}  color="text-emerald-400" />
          <StatCard label={t.failed}      value={stats.failed}     color="text-rose-400"    />
          <StatCard label={t.successRate} value={`${stats.rate}%`} color="text-fuchsia-400" />
        </div>
      )}

      {/* ── Generate Panel ── */}
      {sub && (
        <div className="relative rounded-3xl overflow-hidden border border-white/10">
          <div className="absolute inset-0 bg-[#0f0a1a]" />
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/20 via-violet-700/15 to-transparent" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0 relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-fuchsia-500/40">
                <Sparkles className="text-white" size={36} />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0f0a1a] flex items-center justify-center">
                <Zap size={9} className="text-black" />
              </span>
            </div>

            <div className="flex-1 text-center sm:text-start">
              <h2 className="text-lg font-bold text-white">{t.genTitle}</h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">{t.aiLine}</p>
              {sub.isTrial ? (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-400/80">
                  <AlertTriangle size={12} />
                  {t.trialBadge(sub.daysLeft)}
                </div>
              ) : (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-400/80">
                  <Award size={12} />
                  {`Premium · ${countryLabel(sub.country)} · ${sub.platforms.join(', ')}`}
                </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !!pollingId}
              className="shrink-0 flex flex-col items-center gap-1.5 px-8 py-4 rounded-2xl font-bold text-sm transition-all
                bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-500/30
                hover:shadow-fuchsia-500/50 hover:scale-[1.03]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {generating || pollingId ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} />}
              <span>{generating ? t.generating : pollingId ? t.processing : t.generate}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Inline error ── */}
      {error && campaigns.length > 0 && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/25 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
          <XCircle size={15} className="shrink-0 text-rose-400" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-300">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Search + Filter ── */}
      {campaigns.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search
              size={14}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlh}
              className={`w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 text-sm text-white placeholder-slate-500
                focus:outline-none focus:border-fuchsia-500/60 transition-colors
                ${isRTL ? 'pr-9 pl-9' : 'pl-9 pr-9'}`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-500 hover:text-white ${isRTL ? 'left-2' : 'right-2'}`}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="relative">
            <SlidersHorizontal
              size={14}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as CampaignStatus | '')}
              className={`bg-slate-800 border border-slate-700 rounded-xl py-2.5 text-sm text-white
                focus:outline-none focus:border-fuchsia-500/60 transition-colors appearance-none
                ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'}`}
            >
              <option value="">{t.filterAll}</option>
              <option value="pending">{t.pendingL}</option>
              <option value="rendering">{t.renderingL}</option>
              <option value="published">{t.publishedL}</option>
              <option value="failed">{t.failedL}</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
            <BarChart3 size={13} />
            <span>{filtered.length} / {campaigns.length}</span>
          </div>
        </div>
      )}

      {/* ── Campaign Grid ── */}
      {campaigns.length === 0 ? (
        <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <Film className="text-slate-600" size={28} />
          </div>
          <p className="text-slate-300 font-medium">{t.noVideos}</p>
          <p className="text-slate-500 text-sm mt-1">{t.noVideosSub}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-12 text-center">
          <Search className="text-slate-600 mx-auto mb-3" size={28} />
          <p className="text-slate-300 font-medium">{t.noResults}</p>
          <p className="text-slate-500 text-sm mt-1">{t.noResultsSub}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              {t.history} · {filtered.length}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingUp size={13} />
              {stats.published} / {stats.total} {t.published}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => {
              const meta       = STATUS_META[c.status] ?? STATUS_META.pending
              const StatusIcon = meta.Icon
              const isLive     = c.status === 'pending' || c.status === 'rendering'
              const ageMin     = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60_000)
              const isStuck    = isLive && ageMin > 10
              const isActive   = pollingId === c.id

              const statusLabel =
                c.status === 'pending'   ? t.pendingL   :
                c.status === 'rendering' ? t.renderingL :
                c.status === 'published' ? t.publishedL :
                t.failedL

              return (
                <div
                  key={c.id}
                  onClick={() => setDetail(c)}
                  className={`group relative rounded-2xl overflow-hidden border bg-slate-900 transition-all cursor-pointer
                    hover:shadow-xl hover:-translate-y-0.5 ${
                      isStuck  ? 'border-rose-500/40 shadow-rose-500/10'
                    : isActive ? 'border-fuchsia-500/40 shadow-fuchsia-500/10'
                    :            'border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-video bg-slate-800">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.productName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="text-slate-700" size={32} />
                      </div>
                    )}

                    {/* Status badge */}
                    <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm ${meta.bg} ${meta.text}`}>
                      <StatusIcon size={11} className={c.status === 'rendering' ? 'animate-spin' : ''} />
                      {statusLabel}
                    </div>

                    {/* Watermark badge */}
                    {c.hasWatermark && (
                      <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} px-2 py-0.5 rounded-lg text-xs bg-amber-500/80 text-amber-100 backdrop-blur-sm font-medium`}>
                        {t.watermark}
                      </div>
                    )}

                    {/* Play overlay */}
                    {c.videoUrl && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                          <Play className="text-white" size={20} fill="white" />
                        </div>
                      </div>
                    )}

                    {/* Stuck warning */}
                    {isStuck && (
                      <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-rose-500/80 text-rose-100 text-xs text-center backdrop-blur-sm">
                        {t.stuckLabel(ageMin)}
                      </div>
                    )}

                    {/* Active pulse ring */}
                    {isActive && (
                      <div className="absolute inset-0 border-2 border-fuchsia-500/50 animate-pulse pointer-events-none" />
                    )}
                  </div>

                  {/* Delivery progress bar */}
                  {isLive && (
                    <div className="h-1 bg-slate-800">
                      <div
                        className={`h-full rounded-full animate-pulse ${isActive ? 'bg-fuchsia-500' : 'bg-slate-600'}`}
                        style={{ width: c.status === 'rendering' ? '65%' : '20%' }}
                      />
                    </div>
                  )}

                  {/* Card body */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-white text-sm leading-tight line-clamp-1">{c.productName}</span>
                      <span className="shrink-0 text-xs text-slate-400 font-mono">{c.productPrice.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {c.platforms.map(p => (
                        <span key={p} className="flex items-center gap-1 text-xs text-slate-500 capitalize">
                          {platformIcon(p)} {p}
                        </span>
                      ))}
                      <span className="text-slate-600 text-xs">·</span>
                      <span className="text-xs text-slate-600">
                        {new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>

                    {c.caption && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{c.caption}</p>
                    )}

                    {/* Card actions */}
                    <div
                      className="flex items-center justify-between pt-1 border-t border-slate-800"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        {c.socialLinks && Object.entries(c.socialLinks).slice(0, 2).map(([platform, url]) => (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors capitalize"
                          >
                            <ExternalLink size={10} /> {platform}
                          </a>
                        ))}
                        {c.videoUrl && (
                          <a
                            href={c.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            <Play size={10} fill="currentColor" /> {t.watch}
                          </a>
                        )}
                      </div>
                      {(isLive || c.status === 'failed') && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={cancelling === c.id}
                          className="flex items-center gap-1 text-xs text-slate-600 hover:text-rose-400 transition-colors disabled:opacity-40"
                        >
                          {cancelling === c.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Trash2 size={12} />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Load more */}
          {nextCursor && !statusFilter && !search && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-800 border border-slate-700
                  text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loadingMore ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={15} />}
                {t.loadMore}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Detail modal ── */}
      {detail && (
        <DetailModal
          c={detail}
          t={t}
          lang={lang}
          isRTL={isRTL}
          onClose={() => setDetail(null)}
          onDelete={handleDelete}
          deleting={cancelling === detail.id}
        />
      )}
    </div>
  )
}
