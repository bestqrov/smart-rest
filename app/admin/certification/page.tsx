'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ShieldCheck, Award, RefreshCw, Loader2, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Clock, TrendingUp, Zap,
  Star, Target, Info, Lock,
} from 'lucide-react'
import { useLang } from '../lang-context'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'

interface RuleResult {
  ruleId: string; profile: string; category: string; title: string
  required: boolean; weight: number; passed: boolean; earnedScore: number
  rawValue: unknown; evidenceId: string
}

interface Recommendation {
  ruleId?: string; category: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string; description: string; action?: string
}

interface CertResult {
  id: string; tenantId: string; profile: string; version: string
  score: number; maxScore: number; percentage: number; level: Level
  status: string; evaluatedAt: string; expiresAt: string
  ruleResults: RuleResult[]; evidenceIds: string[]; summary: string
  recommendations: Recommendation[]
}

interface Evidence {
  id: string; resultId: string; ruleId: string
  passed: boolean; score: number; rawValue: unknown
  expectedValue?: unknown; timestamp: string
}

interface PackBreakdown {
  packId: string; packName: string; description: string; tags: string[]
  ruleResults: RuleResult[]; packScore: number; packMaxScore: number; packPercentage: number
}

interface NextLevel { level: Level; minPercentage: number; pointsNeeded: number }

interface DashData {
  result: CertResult | null
  packBreakdown: PackBreakdown[]
  evidenceMap: Record<string, Evidence>
  nextLevel: NextLevel | null
  history: CertResult[]
}

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الشهادة الذكية', subtitle: 'تقييم شامل لأداء مطعمك',
    noneYet: 'لا توجد شهادة بعد', noneDesc: 'ابدأ التقييم لمعرفة مستواك',
    evaluate: 'تقييم الآن', evaluating: 'جارٍ التقييم…',
    lastEval: 'آخر تقييم', expires: 'تنتهي الصلاحية', version: 'الإصدار',
    score: 'النقاط', maxScore: 'الحد الأقصى', pct: 'النسبة',
    toNextLevel: 'نقطة للمستوى التالي',
    ruleBreakdown: 'تفاصيل المعايير', byPack: 'حسب الحزمة',
    recommendations: 'التوصيات', priority: 'الأولوية',
    passed: 'اجتاز', failed: 'لم يجتز', required: 'مطلوب',
    weight: 'الوزن', earned: 'المكتسب',
    evidence: 'الدليل', rawValue: 'القيمة الفعلية', expected: 'المتوقع',
    high: 'عالية', medium: 'متوسطة', low: 'منخفضة',
    history: 'السجل', noHistory: 'لا توجد تقييمات سابقة',
    comingSoon: 'قريباً', downloadPdf: 'تحميل الشهادة',
    shareBadge: 'مشاركة الشارة', publicVerify: 'التحقق العام',
    autoCert: 'التقييم التلقائي', loadError: 'فشل تحميل البيانات',
    evalError: 'فشل التقييم — حاول مجدداً',
    evalDone: 'تم التقييم بنجاح',
    pointsFor: 'نقطة',
    levels: { NONE: 'لا شيء', BRONZE: 'برونز', SILVER: 'فضة', GOLD: 'ذهب', PLATINUM: 'بلاتين', DIAMOND: 'ألماس' },
    expiredWarning: 'الشهادة منتهية الصلاحية',
  },
  en: {
    title: 'Smart Certification', subtitle: 'Comprehensive evaluation of your restaurant',
    noneYet: 'No certification yet', noneDesc: 'Run your first evaluation to see your level',
    evaluate: 'Evaluate Now', evaluating: 'Evaluating…',
    lastEval: 'Last evaluation', expires: 'Expires', version: 'Version',
    score: 'Score', maxScore: 'Max', pct: 'Score',
    toNextLevel: 'points to next level',
    ruleBreakdown: 'Rule Breakdown', byPack: 'By Pack',
    recommendations: 'Recommendations', priority: 'Priority',
    passed: 'Passed', failed: 'Failed', required: 'Required',
    weight: 'Weight', earned: 'Earned',
    evidence: 'Evidence', rawValue: 'Actual value', expected: 'Expected',
    high: 'High', medium: 'Medium', low: 'Low',
    history: 'History', noHistory: 'No previous evaluations',
    comingSoon: 'Coming Soon', downloadPdf: 'Download Certificate',
    sharebadge: 'Share Badge', publicVerify: 'Public Verification',
    autoCert: 'Auto Evaluation', loadError: 'Failed to load data',
    evalError: 'Evaluation failed — please try again',
    evalDone: 'Evaluation complete',
    pointsFor: 'pts',
    levels: { NONE: 'None', BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum', DIAMOND: 'Diamond' },
    expiredWarning: 'Certificate expired',
  },
  fr: {
    title: 'Certification Smart', subtitle: 'Évaluation complète de votre restaurant',
    noneYet: 'Aucune certification', noneDesc: 'Lancez votre première évaluation',
    evaluate: 'Évaluer maintenant', evaluating: 'Évaluation en cours…',
    lastEval: 'Dernière évaluation', expires: 'Expire le', version: 'Version',
    score: 'Score', maxScore: 'Max', pct: 'Score',
    toNextLevel: 'points pour le prochain niveau',
    ruleBreakdown: 'Détail des règles', byPack: 'Par pack',
    recommendations: 'Recommandations', priority: 'Priorité',
    passed: 'Réussi', failed: 'Échoué', required: 'Requis',
    weight: 'Poids', earned: 'Obtenu',
    evidence: 'Preuve', rawValue: 'Valeur réelle', expected: 'Attendu',
    high: 'Élevée', medium: 'Moyenne', low: 'Faible',
    history: 'Historique', noHistory: 'Aucune évaluation précédente',
    comingSoon: 'Bientôt', downloadPdf: 'Télécharger le certificat',
    shareBadge: 'Partager le badge', publicVerify: 'Vérification publique',
    autoCert: 'Évaluation automatique', loadError: 'Échec du chargement',
    evalError: 'Évaluation échouée — réessayez',
    evalDone: 'Évaluation terminée',
    pointsFor: 'pts',
    levels: { NONE: 'Aucun', BRONZE: 'Bronze', SILVER: 'Argent', GOLD: 'Or', PLATINUM: 'Platine', DIAMOND: 'Diamant' },
    expiredWarning: 'Certificat expiré',
  },
  es: {
    title: 'Certificación Smart', subtitle: 'Evaluación completa de tu restaurante',
    noneYet: 'Sin certificación aún', noneDesc: 'Ejecuta tu primera evaluación',
    evaluate: 'Evaluar ahora', evaluating: 'Evaluando…',
    lastEval: 'Última evaluación', expires: 'Expira', version: 'Versión',
    score: 'Puntos', maxScore: 'Máx', pct: 'Puntuación',
    toNextLevel: 'puntos para el siguiente nivel',
    ruleBreakdown: 'Desglose de reglas', byPack: 'Por paquete',
    recommendations: 'Recomendaciones', priority: 'Prioridad',
    passed: 'Aprobado', failed: 'Fallido', required: 'Requerido',
    weight: 'Peso', earned: 'Obtenido',
    evidence: 'Evidencia', rawValue: 'Valor real', expected: 'Esperado',
    high: 'Alta', medium: 'Media', low: 'Baja',
    history: 'Historial', noHistory: 'Sin evaluaciones previas',
    comingSoon: 'Próximamente', downloadPdf: 'Descargar certificado',
    shareBadge: 'Compartir insignia', publicVerify: 'Verificación pública',
    autoCert: 'Evaluación automática', loadError: 'Error al cargar',
    evalError: 'Evaluación fallida — inténtalo de nuevo',
    evalDone: 'Evaluación completada',
    pointsFor: 'pts',
    levels: { NONE: 'Ninguno', BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro', PLATINUM: 'Platino', DIAMOND: 'Diamante' },
    expiredWarning: 'Certificado expirado',
  },
} as const
type Lang = keyof typeof T

// ─── Level config ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<Level, { color: string; bg: string; border: string; ring: string; label: string; emoji: string; min: number }> = {
  NONE:     { color: 'text-gray-500',   bg: 'bg-gray-100',    border: 'border-gray-200',   ring: 'ring-gray-200',   label: 'None',     emoji: '—',  min: 0  },
  BRONZE:   { color: 'text-amber-700',  bg: 'bg-amber-50',    border: 'border-amber-300',  ring: 'ring-amber-300',  label: 'Bronze',   emoji: '🥉', min: 30 },
  SILVER:   { color: 'text-slate-600',  bg: 'bg-slate-100',   border: 'border-slate-300',  ring: 'ring-slate-300',  label: 'Silver',   emoji: '🥈', min: 50 },
  GOLD:     { color: 'text-yellow-700', bg: 'bg-yellow-50',   border: 'border-yellow-400', ring: 'ring-yellow-400', label: 'Gold',     emoji: '🥇', min: 70 },
  PLATINUM: { color: 'text-violet-700', bg: 'bg-violet-50',   border: 'border-violet-300', ring: 'ring-violet-300', label: 'Platinum', emoji: '💜', min: 85 },
  DIAMOND:  { color: 'text-sky-700',    bg: 'bg-sky-50',      border: 'border-sky-300',    ring: 'ring-sky-300',    label: 'Diamond',  emoji: '💎', min: 95 },
}

const LEVEL_ORDER: Level[] = ['NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

function isExpired(iso: string) {
  return new Date(iso) < new Date()
}

// ─── ScoreCircle ──────────────────────────────────────────────────────────────

function ScoreCircle({ pct, level }: { pct: number; level: Level }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(pct, 100) / 100)
  const cfg = LEVEL_CONFIG[level]

  const strokeColor =
    level === 'DIAMOND'  ? '#0ea5e9' :
    level === 'PLATINUM' ? '#7c3aed' :
    level === 'GOLD'     ? '#ca8a04' :
    level === 'SILVER'   ? '#64748b' :
    level === 'BRONZE'   ? '#b45309' : '#d1d5db'

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <circle
          cx="72" cy="72" r={r} fill="none"
          stroke={strokeColor} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="relative text-center">
        <span className="text-2xl font-black text-gray-900">{Math.round(pct)}%</span>
        <span className={`block text-xs font-semibold mt-0.5 ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
      </div>
    </div>
  )
}

// ─── LevelProgress ────────────────────────────────────────────────────────────

function LevelProgress({ current, pct, nextLevel }: { current: Level; pct: number; nextLevel: NextLevel | null }) {
  const levels: Level[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']
  const curIdx = LEVEL_ORDER.indexOf(current)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        {levels.map((lvl, i) => {
          const cfg = LEVEL_CONFIG[lvl]
          const done = LEVEL_ORDER.indexOf(lvl) <= curIdx
          return (
            <div key={lvl} className="flex items-center gap-1.5 flex-1">
              <div className={`h-2 rounded-full flex-1 transition-all ${done ? cfg.bg.replace('bg-', 'bg-') : 'bg-gray-100'}`}
                style={{ background: done ? (lvl === 'DIAMOND' ? '#0ea5e9' : lvl === 'PLATINUM' ? '#7c3aed' : lvl === 'GOLD' ? '#ca8a04' : lvl === 'SILVER' ? '#94a3b8' : '#b45309') : '#f3f4f6' }}
              />
              <span className={`text-[10px] font-semibold whitespace-nowrap ${done ? cfg.color : 'text-gray-300'}`}>
                {cfg.emoji}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
        {levels.map(lvl => (
          <span key={lvl} className={LEVEL_CONFIG[lvl].color + ' ' + (LEVEL_ORDER.indexOf(lvl) <= curIdx ? 'font-semibold' : '')}>
            {LEVEL_CONFIG[lvl].min}%
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── CertificationBadge ───────────────────────────────────────────────────────

function CertificationBadge({ level, expired }: { level: Level; expired?: boolean }) {
  const cfg = LEVEL_CONFIG[level]
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 ${cfg.bg} ${cfg.border}`}>
      <span className="text-xl">{cfg.emoji}</span>
      <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
      {expired && <span className="text-xs text-red-500 font-medium">(expired)</span>}
    </div>
  )
}

// ─── EvidenceCard ─────────────────────────────────────────────────────────────

function EvidenceCard({ evidence, t }: { evidence: Evidence; t: typeof T['en'] }) {
  const pct = Math.round(evidence.score * 100)
  return (
    <div className="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 grid grid-cols-3 gap-2">
      <div>
        <p className="text-gray-400 mb-0.5">{t.rawValue}</p>
        <p className="font-semibold text-gray-800">{String(evidence.rawValue ?? '—')}</p>
      </div>
      {evidence.expectedValue !== undefined && (
        <div>
          <p className="text-gray-400 mb-0.5">{t.expected}</p>
          <p className="font-semibold text-gray-800">{String(evidence.expectedValue)}</p>
        </div>
      )}
      <div>
        <p className="text-gray-400 mb-0.5">Score</p>
        <p className={`font-semibold ${pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{pct}%</p>
      </div>
      <div className="col-span-3 text-gray-300 text-[10px]">{new Date(evidence.timestamp).toLocaleString()}</div>
    </div>
  )
}

// ─── RuleCard ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, evidence, t, isRTL }: {
  rule: RuleResult; evidence?: Evidence; t: typeof T['en']; isRTL: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-xl border ${rule.passed ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-50 bg-red-50/30'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 text-start"
      >
        {rule.passed
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
        }
        <span className="flex-1 text-sm font-medium text-gray-800">{rule.title}</span>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {rule.required && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">{t.required}</span>
          )}
          <span className="text-xs text-gray-400 tabular-nums">
            {Math.round(rule.earnedScore * 10) / 10}/{rule.weight}
          </span>
          {evidence && (
            open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                 : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
          )}
        </div>
      </button>
      {open && evidence && <div className="px-3 pb-3"><EvidenceCard evidence={evidence} t={t} /></div>}
    </div>
  )
}

// ─── PackCard ─────────────────────────────────────────────────────────────────

const PACK_ICON: Record<string, string> = {
  'operations-pack':  '⚙️',
  'billing-pack':     '💳',
  'marketing-pack':   '📣',
  'automation-pack':  '🤖',
  'customer-pack':    '🤝',
  'reservation-pack': '📅',
  'inventory-pack':   '📦',
  'ai-pack':          '✨',
  'security-pack':    '🔒',
  'compliance-pack':  '📋',
}

function PackCard({ pack, evidenceMap, t, isRTL }: {
  pack: PackBreakdown; evidenceMap: Record<string, Evidence>; t: typeof T['en']; isRTL: boolean
}) {
  const [open, setOpen] = useState(false)
  const passed   = pack.ruleResults.filter(r => r.passed).length
  const total    = pack.ruleResults.length
  const allOk    = passed === total
  const pct      = pack.packMaxScore > 0 ? Math.round(pack.packPercentage) : 0

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-start hover:bg-gray-50 transition-colors"
      >
        <span className="text-2xl w-8 text-center shrink-0">{PACK_ICON[pack.packId] ?? '📦'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">{pack.packName}</p>
          <p className="text-xs text-gray-400 mt-0.5">{passed}/{total} rules passed</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allOk ? 'bg-emerald-400' : pct > 50 ? 'bg-amber-400' : 'bg-red-300'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-600 tabular-nums w-8 text-end">{pct}%</span>
          {open ? <ChevronDown className="h-4 w-4 text-gray-300" /> : <ChevronRight className="h-4 w-4 text-gray-300" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-50 p-3 flex flex-col gap-2">
          {pack.ruleResults.map(rule => (
            <RuleCard
              key={rule.ruleId}
              rule={rule}
              evidence={evidenceMap[rule.ruleId]}
              t={t}
              isRTL={isRTL}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── RecommendationCard ───────────────────────────────────────────────────────

const PRIORITY_STYLE = {
  HIGH:   { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-600',   dot: 'bg-red-500' },
  MEDIUM: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
  LOW:    { bg: 'bg-gray-50',   border: 'border-gray-200',  text: 'text-gray-600',  dot: 'bg-gray-400' },
}

function RecommendationCard({ rec, idx, t }: { rec: Recommendation; idx: number; t: typeof T['en'] }) {
  const s = PRIORITY_STYLE[rec.priority]
  return (
    <div className={`flex gap-3 p-3 rounded-xl border ${s.bg} ${s.border}`}>
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <span className="text-xs font-black text-gray-300 tabular-nums">{idx + 1}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-gray-800">{rec.title}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${s.bg} ${s.text} border ${s.border}`}>
            {t[rec.priority.toLowerCase() as 'high' | 'medium' | 'low']}
          </span>
        </div>
        <p className="text-xs text-gray-500">{rec.description}</p>
        {rec.action && (
          <p className="text-xs text-gray-700 font-medium mt-1.5 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
            {rec.action}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ t, onEval, loading }: { t: typeof T['en']; onEval: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center">
        <Award className="h-10 w-10 text-gray-300" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-800">{t.noneYet}</h2>
        <p className="text-sm text-gray-400 mt-1">{t.noneDesc}</p>
      </div>
      <button
        onClick={onEval}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {loading ? t.evaluating : t.evaluate}
      </button>
    </div>
  )
}

// ─── ComingSoonButton ─────────────────────────────────────────────────────────

function ComingSoonBtn({ label }: { label: string }) {
  return (
    <button
      disabled
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-gray-200 text-gray-300 text-sm cursor-not-allowed"
    >
      <Lock className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CertificationPage() {
  const { lang, isRTL } = useLang()
  const t = (T[lang as Lang] ?? T.en) as typeof T.en

  const [data, setData]         = useState<DashData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [evaluating, setEval]   = useState(false)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/certification/result', { headers: authHeader() })
      if (res.ok) setData(await res.json())
      else setToast({ msg: t.loadError, ok: false })
    } catch {
      setToast({ msg: t.loadError, ok: false })
    } finally {
      setLoading(false)
    }
  }, [t.loadError])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  const runEvaluation = async () => {
    setEval(true)
    try {
      const res = await fetch('/api/admin/certification/evaluate', {
        method: 'POST',
        headers: authHeader(),
      })
      if (res.ok) {
        setToast({ msg: t.evalDone, ok: true })
        await load()
      } else {
        const body = await res.json()
        setToast({ msg: body.error ?? t.evalError, ok: false })
      }
    } catch {
      setToast({ msg: t.evalError, ok: false })
    } finally {
      setEval(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  const result   = data?.result ?? null
  const expired  = result ? isExpired(result.expiresAt) : false

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 ${isRTL ? 'left-5' : 'right-5'} z-50 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
          </div>
          <p className="text-sm text-gray-400">{t.subtitle}</p>
        </div>
        <button
          onClick={runEvaluation}
          disabled={evaluating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0"
        >
          {evaluating
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t.evaluating}</>
            : <><RefreshCw className="h-3.5 w-3.5" />{t.evaluate}</>
          }
        </button>
      </div>

      {!result ? (
        <EmptyState t={t} onEval={runEvaluation} loading={evaluating} />
      ) : (
        <div className="flex flex-col gap-6">

          {/* Expired warning */}
          {expired && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t.expiredWarning} — {t.evaluate}
            </div>
          )}

          {/* Hero card */}
          <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row items-center gap-6">

              {/* Score circle */}
              <ScoreCircle pct={result.percentage} level={result.level} />

              {/* Info */}
              <div className="flex-1 flex flex-col gap-4">
                <CertificationBadge level={result.level} expired={expired} />

                <LevelProgress
                  current={result.level}
                  pct={result.percentage}
                  nextLevel={data?.nextLevel ?? null}
                />

                {data?.nextLevel && (
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-gray-500">
                      <span className="font-bold text-gray-900">{data.nextLevel.pointsNeeded}</span>
                      {' '}{t.toNextLevel}{' '}
                      <span className={`font-semibold ${LEVEL_CONFIG[data.nextLevel.level as Level].color}`}>
                        {LEVEL_CONFIG[data.nextLevel.level as Level].emoji} {data.nextLevel.level}
                      </span>
                    </span>
                  </div>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {t.lastEval}: {fmtDate(result.evaluatedAt, lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB')}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t.expires}: {fmtDate(result.expiresAt, 'en-GB')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" />
                    v{result.version}
                  </span>
                </div>
              </div>
            </div>

            {/* Score bar */}
            <div className="border-t border-gray-50 px-6 py-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${result.percentage}%`,
                      background: result.level === 'DIAMOND' ? '#0ea5e9' : result.level === 'PLATINUM' ? '#7c3aed' : result.level === 'GOLD' ? '#ca8a04' : result.level === 'SILVER' ? '#94a3b8' : result.level === 'BRONZE' ? '#b45309' : '#d1d5db',
                    }}
                  />
                </div>
              </div>
              <span className="text-sm font-black text-gray-900 tabular-nums shrink-0">
                {Math.round(result.score * 10) / 10} / {result.maxScore}
              </span>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-amber-400" />
                <h2 className="font-semibold text-gray-800">{t.recommendations}</h2>
                <span className="text-xs text-gray-400">({result.recommendations.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {result.recommendations.map((rec, i) => (
                  <RecommendationCard key={rec.ruleId ?? i} rec={rec} idx={i} t={t} />
                ))}
              </div>
            </section>
          )}

          {/* Rule breakdown by pack */}
          {data?.packBreakdown && data.packBreakdown.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-gray-400" />
                <h2 className="font-semibold text-gray-800">{t.ruleBreakdown}</h2>
              </div>
              <div className="flex flex-col gap-3">
                {data.packBreakdown.map(pack => (
                  <PackCard
                    key={pack.packId}
                    pack={pack}
                    evidenceMap={data.evidenceMap}
                    t={t}
                    isRTL={isRTL}
                  />
                ))}
              </div>
            </section>
          )}

          {/* History */}
          {data?.history && data.history.length > 1 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-gray-400" />
                <h2 className="font-semibold text-gray-800">{t.history}</h2>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                {data.history.slice(1).map((h, i) => (
                  <div key={h.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <span className="text-base">{LEVEL_CONFIG[h.level].emoji}</span>
                    <span className={`text-xs font-semibold ${LEVEL_CONFIG[h.level].color}`}>{h.level}</span>
                    <span className="text-xs text-gray-400 flex-1">{Math.round(h.percentage)}%</span>
                    <span className="text-xs text-gray-400">{fmtDate(h.evaluatedAt, 'en-GB')}</span>
                    {isExpired(h.expiresAt) && (
                      <span className="text-[10px] text-red-400 font-medium">expired</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Coming soon actions */}
          <section>
            <div className="flex flex-wrap gap-2">
              <ComingSoonBtn label={t.downloadPdf} />
              <ComingSoonBtn label={(t as any).shareBadge ?? (t as any).sharebage ?? 'Share Badge'} />
              <ComingSoonBtn label={t.publicVerify} />
              <ComingSoonBtn label={t.autoCert} />
            </div>
          </section>

        </div>
      )}
    </div>
  )
}
