'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Film, Sparkles, Play, Clock, CheckCircle2, XCircle,
  Loader2, RefreshCw, ExternalLink, AlertTriangle, Award,
  Share2, Smartphone, Trash2,
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
  if (p === 'instagram') return <Share2 size={14} className="inline-block mr-1" />
  if (p === 'snapchat')  return <Smartphone  size={14} className="inline-block mr-1" />
  if (p === 'tiktok')   return <Film        size={14} className="inline-block mr-1" />
  return null
}

const STATUS_META: Record<Campaign['status'], { ar: string; fr: string; en: string; color: string; Icon: React.ElementType }> = {
  pending:   { ar: 'في الانتظار', fr: 'En attente',  en: 'Pending',      color: 'text-slate-400',   Icon: Clock        },
  rendering: { ar: 'جارٍ التوليد', fr: 'Génération…', en: 'Rendering…',  color: 'text-amber-400',   Icon: Loader2      },
  published: { ar: 'تم النشر',    fr: 'Publié',      en: 'Published',    color: 'text-emerald-400', Icon: CheckCircle2 },
  failed:    { ar: 'فشل',         fr: 'Échoué',      en: 'Failed',       color: 'text-rose-400',    Icon: XCircle      },
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

  // ── Load subscription status + campaign history ────────────────────────────
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

  // ── Poll a single campaign until it leaves the transient states ────────────
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

  // ── Trigger video generation ───────────────────────────────────────────────
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
      // Prepend the new campaign optimistically and start polling
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    )
  }

  return (
    <div className={`max-w-4xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-fuchsia-600 via-purple-700 to-violet-800 p-6 shadow-xl shadow-purple-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.10),transparent_65%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Film className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {L('فيديوهات ترويجية بالذكاء الاصطناعي', 'Vidéos Promo Automatiques', 'AI Promo Videos')}
              </h1>
              <p className="text-sm text-purple-100/70 mt-0.5">
                {L('أنشئ فيديوهات تسويقية وانشرها مباشرةً على منصاتك', 'Générez et publiez automatiquement sur vos réseaux', 'Generate & auto-publish to your social platforms')}
              </p>
            </div>
          </div>
          <button onClick={loadData} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Subscription info + generate button inside banner */}
        {sub && (
          <div className="relative mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {sub.isTrial
                ? <AlertTriangle className="text-amber-300 shrink-0" size={18} />
                : <Award         className="text-emerald-300 shrink-0" size={18} />
              }
              <div>
                {sub.isTrial ? (
                  <p className="text-sm font-semibold text-amber-200">
                    {L(`تجربة مجانية — ${sub.daysLeft} أيام متبقية`, `Mode Essai — ${sub.daysLeft} jour${sub.daysLeft !== 1 ? 's' : ''} restant${sub.daysLeft !== 1 ? 's' : ''}`, `Free Trial — ${sub.daysLeft} day${sub.daysLeft !== 1 ? 's' : ''} left`)}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-emerald-200">{L('حساب بريميوم نشط', 'Compte Premium actif', 'Premium account active')}</p>
                )}
                <p className="text-xs text-white/50 mt-0.5">
                  {countryLabel(sub.country)} · {sub.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                  {sub.isTrial && ` · ${L('مع علامة مائية', 'avec filigrane', 'with watermark')}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !!pollingId}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-purple-700 text-sm font-bold hover:bg-purple-50 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {generating
                ? L('جارٍ التوليد…', 'Génération…', 'Generating…')
                : pollingId
                  ? L('جارٍ المعالجة…', 'En cours…', 'Processing…')
                  : L('توليد فيديو ترويجي', 'Générer une vidéo promo', 'Generate promo video')}
            </button>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
          <XCircle size={15} className="shrink-0" /> {error}
        </div>
      )}

      {/* ── Campaign History ── */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">
          {L('سجل الفيديوهات', 'Historique des vidéos', 'Video history')}
        </h2>

        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
            <Film className="mx-auto text-slate-600 mb-3" size={40} />
            <p className="text-slate-400 text-sm">{L('لا توجد فيديوهات بعد.', 'Aucune vidéo générée pour l\'instant.', 'No videos generated yet.')}</p>
            <p className="text-slate-500 text-xs mt-1">{L('اضغط "توليد فيديو ترويجي" للبدء.', 'Cliquez sur "Générer une vidéo promo" pour commencer.', 'Click "Generate promo video" to start.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const meta = STATUS_META[c.status] ?? STATUS_META.pending
              const StatusIcon = meta.Icon
              const isLive     = c.status === 'pending' || c.status === 'rendering'
              const ageMin     = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60_000)
              const isStuck    = isLive && ageMin > 10
              return (
                <div
                  key={c.id}
                  className={`rounded-2xl border p-4 flex gap-4 items-start transition-colors ${
                    isStuck ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-700">
                    {c.imageUrl
                      ? <img src={c.imageUrl} alt={c.productName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-slate-500"><Film size={24} /></div>
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{c.productName}</span>
                      <span className="text-xs text-slate-400">{c.productPrice.toFixed(2)}</span>
                      {c.hasWatermark && (
                        <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                          {L('علامة مائية', 'Filigrane', 'Watermark')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {c.platforms.map(p => (
                        <span key={p} className="text-xs text-slate-400 flex items-center gap-0.5">
                          {platformIcon(p)}{p}
                        </span>
                      ))}
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isStuck && (
                        <span className="text-xs text-rose-400">
                          · {L(`متأخر ${ageMin} د`, `Bloqué ${ageMin} min`, `Stuck ${ageMin} min`)}
                        </span>
                      )}
                    </div>
                    {c.caption && (
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{c.caption}</p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className={`flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                      <StatusIcon size={13} className={isLive ? 'animate-spin' : ''} />
                      {meta[lang] ?? meta.en}
                    </span>
                    {c.videoUrl && (
                      <a href={c.videoUrl} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                        <Play size={12} /> {L('مشاهدة', 'Voir', 'Watch')}
                      </a>
                    )}
                    {c.socialLinks && Object.entries(c.socialLinks).map(([platform, url]) => (
                      <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                        <ExternalLink size={11} /> {platform}
                      </a>
                    ))}
                    {(isLive || c.status === 'failed') && (
                      <button
                        onClick={() => handleCancel(c.id)}
                        disabled={cancelling === c.id}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                        title={L('حذف', 'Supprimer', 'Delete')}
                      >
                        {cancelling === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        {L('حذف', 'Supprimer', 'Delete')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
