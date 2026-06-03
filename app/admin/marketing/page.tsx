'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Film, Sparkles, Play, Clock, CheckCircle2, XCircle,
  Loader2, RefreshCw, ExternalLink, AlertTriangle, Award,
  Share2, Smartphone
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

const STATUS_META: Record<Campaign['status'], { label: string; color: string; Icon: React.ElementType }> = {
  pending:   { label: 'En attente',  color: 'text-slate-400',  Icon: Clock         },
  rendering: { label: 'Génération…', color: 'text-amber-400',  Icon: Loader2       },
  published: { label: 'Publié',      color: 'text-emerald-400', Icon: CheckCircle2 },
  failed:    { label: 'Échoué',      color: 'text-rose-400',   Icon: XCircle       },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { isRTL } = useLang()

  const [sub,        setSub]        = useState<SubStatus | null>(null)
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([])
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
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
      setError('Impossible de contacter le serveur. Vérifiez votre connexion.')
    } finally {
      setGenerating(false)
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
    <div className={`max-w-4xl mx-auto px-4 py-8 space-y-8 ${isRTL ? 'text-right' : 'text-left'}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-emerald-500/10">
          <Film className="text-emerald-500" size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Vidéos Promo Automatiques</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Générez des vidéos marketing IA et publiez-les directement sur vos réseaux sociaux.
          </p>
        </div>
      </div>

      {/* ── Subscription Banner ────────────────────────────────────────────── */}
      {sub && (
        <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between
          ${sub.isTrial
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-emerald-500/10 border-emerald-500/30'
          }`}
        >
          <div className="flex items-start gap-3">
            {sub.isTrial
              ? <AlertTriangle className="text-amber-400 mt-0.5 shrink-0" size={22} />
              : <Award         className="text-emerald-400 mt-0.5 shrink-0" size={22} />
            }
            <div>
              {sub.isTrial ? (
                <>
                  <p className="font-semibold text-amber-300">
                    Mode Essai — {sub.daysLeft} jour{sub.daysLeft !== 1 ? 's' : ''} restant{sub.daysLeft !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-amber-200/70 mt-0.5">
                    Un filigrane <span className="font-medium">Smart Resto</span> sera appliqué sur vos vidéos.
                    Passez à Premium pour des vidéos sans filigrane.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-emerald-300">Compte Premium actif</p>
                  <p className="text-sm text-emerald-200/70 mt-0.5">
                    Vidéos générées sans filigrane — publication automatique activée.
                  </p>
                </>
              )}
              <p className="text-xs text-slate-400 mt-2">
                Pays : {countryLabel(sub.country)} &nbsp;·&nbsp;
                Plateformes : {sub.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
              </p>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !!pollingId}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
              bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed
              text-white transition-colors"
          >
            {generating
              ? <Loader2 size={16} className="animate-spin" />
              : <Sparkles size={16} />
            }
            {generating ? 'Génération…' : pollingId ? 'En cours…' : 'Générer une vidéo promo'}
          </button>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* ── Campaign History ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Historique des vidéos</h2>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={13} />
            Actualiser
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
            <Film className="mx-auto text-slate-600 mb-3" size={40} />
            <p className="text-slate-400 text-sm">Aucune vidéo générée pour l'instant.</p>
            <p className="text-slate-500 text-xs mt-1">Cliquez sur "Générer une vidéo promo" pour commencer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const meta = STATUS_META[c.status] ?? STATUS_META.pending
              const StatusIcon = meta.Icon
              const isLive = c.status === 'pending' || c.status === 'rendering'
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 flex gap-4 items-start"
                >
                  {/* Dish thumbnail */}
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-700">
                    {c.imageUrl
                      ? <img src={c.imageUrl} alt={c.productName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-slate-500"><Film size={24} /></div>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{c.productName}</span>
                      <span className="text-xs text-slate-400">{c.productPrice.toFixed(2)}</span>
                      {c.hasWatermark && (
                        <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                          Filigrane
                        </span>
                      )}
                    </div>

                    {/* Platforms */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {c.platforms.map(p => (
                        <span key={p} className="text-xs text-slate-400 flex items-center">
                          {platformIcon(p)}{p}
                        </span>
                      ))}
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* Caption preview */}
                    {c.caption && (
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {c.caption}
                      </p>
                    )}
                  </div>

                  {/* Status + actions */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className={`flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                      <StatusIcon size={13} className={isLive ? 'animate-spin' : ''} />
                      {meta.label}
                    </span>

                    {c.videoUrl && (
                      <a
                        href={c.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Play size={12} />
                        Voir la vidéo
                      </a>
                    )}

                    {c.socialLinks && Object.entries(c.socialLinks).map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        <ExternalLink size={11} />
                        {platform}
                      </a>
                    ))}
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
