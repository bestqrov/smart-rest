'use client'

/**
 * CertificationTracker — Admin dashboard widget.
 *
 * Shows the restaurant's current Smart Resto Certified status and live
 * progress against the 4 eligibility thresholds. Fetches from
 * GET /api/admin/certification (defined below in the same PR).
 *
 * Statuses rendered:
 *   PENDING   → grey progress bars, "keep going" message
 *   ELIGIBLE  → gold banner, "claim your kit" CTA
 *   CERTIFIED → neon green badge + certified date
 *   REVOKED   → red warning, metrics that dropped
 */

import { useEffect, useState } from 'react'
import { Award, Clock, Star, QrCode, Users, ChevronRight, Loader2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CertMetrics {
  qrUsageRate:        number   // 0-100
  avgPreparationTime: number   // minutes
  averageRating:      number   // 1-5
  reviewCount:        number
  evaluatedAt:        string | null
}

interface CertData {
  certificationStatus:  'PENDING' | 'ELIGIBLE' | 'CERTIFIED' | 'REVOKED'
  certificationMetrics: CertMetrics | null
  certifiedAt:          string | null
}

// ─── Thresholds (mirrors certificationEval.ts) ────────────────────────────────

const THRESHOLDS = {
  qrUsageRate:        70,
  avgPreparationTime: 25,   // must be BELOW this
  averageRating:      4.5,
  reviewCount:        50,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number, max: number) {
  return Math.min(100, Math.round((value / max) * 100))
}

function MetricRow({
  icon, label, value, target, unit = '', lowerIsBetter = false, passes
}: {
  icon: React.ReactNode
  label: string
  value: number
  target: number
  unit?: string
  lowerIsBetter?: boolean
  passes: boolean
}) {
  const progress = lowerIsBetter
    ? value === 0 ? 100 : Math.min(100, Math.round(((target - value) / target) * 100 + 100) / 2)
    : pct(value, target)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-gray-500">
          {icon}
          {label}
        </span>
        <span className={`font-semibold ${passes ? 'text-emerald-600' : 'text-amber-600'}`}>
          {value}{unit}
          <span className="ml-1 text-gray-400 font-normal">
            / {lowerIsBetter ? `< ${target}` : `≥ ${target}`}{unit}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${passes ? 'bg-emerald-400' : 'bg-amber-300'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CertificationTracker() {
  const [data, setData]       = useState<CertData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/admin/certification', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
      </div>
    )
  }

  if (!data) return null

  const m = data.certificationMetrics
  const status = data.certificationStatus

  // ── CERTIFIED ──────────────────────────────────────────────────────────────
  if (status === 'CERTIFIED') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-100 opacity-40" />
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Smart Resto</p>
            <h3 className="text-xl font-bold text-gray-800">Certified ✓</h3>
            {data.certifiedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                Since {new Date(data.certifiedAt).toLocaleDateString('fr-MA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
        {m && (
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            {[
              { label: 'QR Usage',  value: `${m.qrUsageRate}%`,         icon: '📱' },
              { label: 'Rating',    value: `${m.averageRating} ★`,       icon: '⭐' },
              { label: 'Prep time', value: `${m.avgPreparationTime} min`, icon: '⏱️' },
              { label: 'Reviews',   value: String(m.reviewCount),         icon: '💬' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl bg-emerald-50 px-3 py-2">
                <p className="text-base">{stat.icon}</p>
                <p className="text-sm font-bold text-emerald-700">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── ELIGIBLE ──────────────────────────────────────────────────────────────
  if (status === 'ELIGIBLE') {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div>
            <h3 className="font-bold text-gray-800">You're eligible for certification!</h3>
            <p className="text-xs text-gray-500 mt-0.5">Claim your Premium Neon Kit — check your WhatsApp & email.</p>
          </div>
        </div>
        <a
          href="mailto:certify@smartresto.com"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-500 transition-colors"
        >
          Claim Certification Kit <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    )
  }

  // ── REVOKED ───────────────────────────────────────────────────────────────
  if (status === 'REVOKED') {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-bold text-gray-800">Certification suspended</h3>
            <p className="text-xs text-gray-500">One or more metrics dropped below the threshold.</p>
          </div>
        </div>
        {m && <MetricsGrid m={m} />}
      </div>
    )
  }

  // ── PENDING (default) ─────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
          <Award className="h-5 w-5 text-gray-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Smart Resto Certified</h3>
          <p className="text-xs text-gray-400">
            {m?.evaluatedAt
              ? `Last evaluated ${new Date(m.evaluatedAt).toLocaleDateString('fr-MA')}`
              : 'Evaluated monthly — meet all 4 criteria to qualify'}
          </p>
        </div>
      </div>

      {m ? (
        <MetricsGrid m={m} />
      ) : (
        <p className="text-xs text-gray-400 text-center py-4">
          Not enough data yet — keep taking orders via QR!
        </p>
      )}
    </div>
  )
}

// ─── Shared metrics grid ──────────────────────────────────────────────────────

function MetricsGrid({ m }: { m: CertMetrics }) {
  return (
    <div className="flex flex-col gap-3">
      <MetricRow
        icon={<QrCode className="h-3.5 w-3.5" />}
        label="QR Usage Rate"
        value={m.qrUsageRate}
        target={THRESHOLDS.qrUsageRate}
        unit="%"
        passes={m.qrUsageRate >= THRESHOLDS.qrUsageRate}
      />
      <MetricRow
        icon={<Star className="h-3.5 w-3.5" />}
        label="Average Rating"
        value={m.averageRating}
        target={THRESHOLDS.averageRating}
        unit=" ★"
        passes={m.averageRating >= THRESHOLDS.averageRating}
      />
      <MetricRow
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Avg Prep Time"
        value={m.avgPreparationTime}
        target={THRESHOLDS.avgPreparationTime}
        unit=" min"
        lowerIsBetter
        passes={m.avgPreparationTime < THRESHOLDS.avgPreparationTime}
      />
      <MetricRow
        icon={<Users className="h-3.5 w-3.5" />}
        label="Total Reviews"
        value={m.reviewCount}
        target={THRESHOLDS.reviewCount}
        passes={m.reviewCount >= THRESHOLDS.reviewCount}
      />
    </div>
  )
}
