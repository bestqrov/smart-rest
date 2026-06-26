'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Film, Sparkles, Play, Clock, CheckCircle2, XCircle,
  Loader2, RefreshCw, ExternalLink, AlertTriangle, Award,
  Share2, Smartphone, Trash2, TrendingUp, Video, Zap,
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

type Campaign = {
  id:           string
  productName:  string
  productPrice: number
  imageUrl:     string | null
  country:      string
  caption:      string | null
  videoUrl:     string | null
  hasWatermark: boolean
  status:       'pending' | 'rendering' | 'published' | 'failed'
  platforms:    string[]
  socialLinks:  Record<string, string> | null
  createdAt:    string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function countryLabel(c: string) {
  return c === 'SA' ? '🇸🇦 KSA' : c === 'AE' ? '🇦🇪 UAE' : '🇲🇦 Maroc'
}

function platformIcon(p: string) {
  if (p === 'instagram') return <Share2   size={13} className="inline-block" />
  if (p === 'snapchat')  return <Smartphone size={13} className="inline-block" />
  if (p === 'tiktok')   return <Film      size={13} className="inline-block" />
  return null
}

const STATUS_META: Record<Campaign['status'], { ar: string; fr: string; en: string; bg: string; text: string; Icon: React.ElementType }> = {
  pending:   { ar: 'في الانتظار', fr: 'En attente',   en: 'Pending',    bg: 'bg-slate-700/60',   text: 'text-slate-300',   Icon: Clock        },
  rendering: { ar: 'جارٍ التوليد', fr: 'Génération…',  en: 'Rendering…', bg: 'bg-amber-500/15',   text: 'text-amber-300',   Icon: Loader2      },
  published: { ar: 'تم النشر',    fr: 'Publié',        en: 'Published',  bg: 'bg-emerald-500/15', text: 'text-emerald-300', Icon: CheckCircle2 },
  failed:    { ar: 'فشل',         fr: 'Échoué',        en: 'Failed',     bg: 'bg-rose-500/15',    text: 'text-rose-300',    Icon: XCircle      },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { lang, isRTL } = useLang()
  const L = (ar: string, fr: string, en: string) => lang === 'ar' ? ar : lang === 'fr' ? fr : en

  const [sub,        setSub]        = useState<SubStatus | null>(null)
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([])
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [pollingId,  setPollingId]  = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [subRes, campRes] = await Promise.all([
        fetch('/api/marketing/subscription-status', { headers: authHeader() }),
        fetch('/api/marketing/campaigns?limit=20',  { headers: authHeader() }),
      ])
      if (subRes.ok)  setSub(await subRes.json())
      if (campRes.ok) setCampaigns((await campRes.json()).items ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

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

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/marketing/generate-video', {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur inconnue'); return }
      setCampaigns(prev => [data.campaign, ...prev])
      setPollingId(data.campaign.id)
    } catch {
      setError(L('تعذر الاتصال بالخادم.', 'Impossible de contacter le serveur.', 'Could not reach the server.'))
    } finally {
      setGenerating(false)
    }
  }

  async function handleCancel(id: string) {
    setCancelling(id)
    try {
      await fetch(`/api/marketing/campaigns/${id}`, { method: 'DELETE', headers: authHeader() })
      setCampaigns(prev => prev.filter(c => c.id !== id))
      if (pollingId === id) setPollingId(null)
    } finally {
      setCancelling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-fuchsia-500" size={36} />
      </div>
    )
  }

  const published = campaigns.filter(c => c.status === 'published').length
  const pending   = campaigns.filter(c => c.status === 'pending' || c.status === 'rendering').length

  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Top bar: title + stats + refresh ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
            <Video className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">
              {L('الفيديوهات الترويجية', 'Vidéos Promotionnelles', 'Promo Videos')}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {L('اصنع فيديوهات بالذكاء الاصطناعي وانشرها تلقائياً', 'IA + publication automatique sur vos réseaux', 'AI-generated · auto-published to social media')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/60" />
            <span className="text-xs text-slate-300 font-medium">{published} {L('منشور', 'publiée', 'published')}</span>
          </div>
          {pending > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-300 font-medium">{pending} {L('جارٍ', 'en cours', 'running')}</span>
            </div>
          )}
          <button onClick={loadData} className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Generate Panel ── */}
      {sub && (
        <div className="relative rounded-3xl overflow-hidden border border-white/10">
          <div className="absolute inset-0 bg-[#0f0a1a]" />
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/20 via-violet-700/15 to-transparent" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

          <div className="relative p-6 flex flex-col sm:flex-row items-center gap-6">
            {/* Animated icon */}
            <div className="shrink-0 relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-fuchsia-500/40">
                <Sparkles className="text-white" size={36} />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0f0a1a] flex items-center justify-center">
                <Zap size={9} className="text-black" />
              </span>
            </div>

            {/* Text */}
            <div className="flex-1 text-center sm:text-start">
              <h2 className="text-lg font-bold text-white">
                {L('أنشئ فيديو ترويجي بنقرة واحدة', 'Créez une vidéo promo en 1 clic', 'Create a promo video in 1 click')}
              </h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                {L(
                  'الذكاء الاصطناعي يختار أفضل منتج ويصنع فيديو احترافي وينشره على منصاتك تلقائياً.',
                  "L'IA choisit le meilleur produit, génère une vidéo pro et la publie automatiquement.",
                  'AI picks your best product, generates a pro video, and publishes it automatically.',
                )}
              </p>
              {sub.isTrial ? (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-400/80">
                  <AlertTriangle size={12} />
                  {L(
                    `تجربة مجانية · ${sub.daysLeft} يوم متبقي · مع علامة مائية`,
                    `Essai · ${sub.daysLeft} jour${sub.daysLeft !== 1 ? 's' : ''} restant · avec filigrane`,
                    `Trial · ${sub.daysLeft} day${sub.daysLeft !== 1 ? 's' : ''} left · watermarked`,
                  )}
                </div>
              ) : (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-400/80">
                  <Award size={12} />
                  {`Premium · ${countryLabel(sub.country)} · ${sub.platforms.join(', ')}`}
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={handleGenerate}
              disabled={generating || !!pollingId}
              className="shrink-0 relative group flex flex-col items-center gap-1.5 px-8 py-4 rounded-2xl font-bold text-sm transition-all
                bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-500/30
                hover:shadow-fuchsia-500/50 hover:scale-[1.03]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {generating || pollingId
                ? <Loader2 size={22} className="animate-spin" />
                : <Sparkles size={22} />
              }
              <span>
                {generating
                  ? L('جارٍ التوليد…', 'Génération…', 'Generating…')
                  : pollingId
                    ? L('جارٍ المعالجة…', 'En cours…', 'Processing…')
                    : L('توليد فيديو', 'Générer', 'Generate')}
              </span>
              {!generating && !pollingId && (
                <div className="absolute inset-0 rounded-2xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/25 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
          <XCircle size={15} className="shrink-0 text-rose-400" /> {error}
        </div>
      )}

      {/* ── Campaign Grid ── */}
      {campaigns.length === 0 ? (
        <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <Film className="text-slate-600" size={28} />
          </div>
          <p className="text-slate-300 font-medium">{L('لا توجد فيديوهات بعد', 'Aucune vidéo générée', 'No videos yet')}</p>
          <p className="text-slate-500 text-sm mt-1">{L('اضغط "توليد فيديو" للبدء', 'Cliquez sur "Générer" pour commencer', 'Click "Generate" to get started')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              {L('السجل', 'Historique', 'History')} · {campaigns.length}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingUp size={13} />
              {published} / {campaigns.length} {L('منشور', 'publié', 'published')}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map(c => {
              const meta       = STATUS_META[c.status] ?? STATUS_META.pending
              const StatusIcon = meta.Icon
              const isLive     = c.status === 'pending' || c.status === 'rendering'
              const ageMin     = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60_000)
              const isStuck    = isLive && ageMin > 10
              const isActive   = pollingId === c.id

              return (
                <div
                  key={c.id}
                  className={`group relative rounded-2xl overflow-hidden border bg-slate-900 transition-all hover:shadow-xl hover:-translate-y-0.5 ${
                    isStuck
                      ? 'border-rose-500/40 shadow-rose-500/10'
                      : isActive
                        ? 'border-fuchsia-500/40 shadow-fuchsia-500/10'
                        : 'border-slate-700/60 hover:border-slate-600'
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

                    {/* Status badge overlay */}
                    <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm ${meta.bg} ${meta.text}`}>
                      <StatusIcon size={11} className={isLive ? 'animate-spin' : ''} />
                      {meta[lang as 'ar' | 'fr' | 'en'] ?? meta.en}
                    </div>

                    {/* Watermark badge */}
                    {c.hasWatermark && (
                      <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} px-2 py-0.5 rounded-lg text-xs bg-amber-500/80 text-amber-100 backdrop-blur-sm font-medium`}>
                        {L('علامة مائية', 'Filigrane', 'Watermark')}
                      </div>
                    )}

                    {/* Watch overlay on hover */}
                    {c.videoUrl && (
                      <a
                        href={c.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                          <Play className="text-white" size={20} fill="white" />
                        </div>
                      </a>
                    )}

                    {/* Stuck warning */}
                    {isStuck && (
                      <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-rose-500/80 text-rose-100 text-xs text-center backdrop-blur-sm">
                        {L(`متأخر ${ageMin} د`, `Bloqué ${ageMin} min`, `Stuck ${ageMin} min`)}
                      </div>
                    )}

                    {/* Active pulse ring */}
                    {isActive && (
                      <div className="absolute inset-0 border-2 border-fuchsia-500/50 animate-pulse pointer-events-none" />
                    )}
                  </div>

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

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        {c.socialLinks && Object.entries(c.socialLinks).slice(0, 2).map(([platform, url]) => (
                          <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                             className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors capitalize">
                            <ExternalLink size={10} /> {platform}
                          </a>
                        ))}
                        {c.videoUrl && (
                          <a href={c.videoUrl} target="_blank" rel="noopener noreferrer"
                             className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                            <Play size={10} fill="currentColor" /> {L('مشاهدة', 'Voir', 'Watch')}
                          </a>
                        )}
                      </div>
                      {(isLive || c.status === 'failed') && (
                        <button
                          onClick={() => handleCancel(c.id)}
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
        </>
      )}
    </div>
  )
}
