'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Brain,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Star,
  Zap,
  DollarSign,
  Clock,
  BarChart3,
  Shield,
  Key,
  GripVertical,
  ExternalLink,
  Loader2,
  ArrowLeft,
} from 'lucide-react'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title:          'مركز الذكاء الاصطناعي',
    subtitle:       'إدارة مزودي الذكاء الاصطناعي',
    back:           '→ لوحة المشرف',
    login:          'تسجيل الدخول',
    email:          'البريد الإلكتروني',
    secret:         'كلمة السر',
    analytics:      'الإحصائيات',
    providers:      'المزودون',
    health:         'الصحة',
    reqToday:       'طلبات اليوم',
    tokensToday:    'الرموز اليوم',
    costToday:      'التكلفة اليوم',
    costMonth:      'التكلفة هذا الشهر',
    avgLatency:     'متوسط الكمون',
    failureRate:    'معدل الفشل',
    enabled:        'مفعّل',
    disabled:       'معطّل',
    apiKey:         'مفتاح API',
    configured:     'مضبوط',
    notConfigured:  'غير مضبوط',
    model:          'النموذج',
    priority:       'الأولوية',
    successRate:    'معدل النجاح',
    lastSuccess:    'آخر نجاح',
    testConnection: 'اختبار الاتصال',
    testing:        'جارٍ الاختبار…',
    enable:         'تفعيل',
    disable:        'تعطيل',
    setDefault:     'تعيين افتراضي',
    default:        'افتراضي',
    fallbackChain:  'سلسلة الاحتياط',
    saveChain:      'حفظ السلسلة',
    saving:         'جارٍ الحفظ…',
    noProviders:    'لا يوجد مزودون',
    loading:        'جارٍ التحميل…',
    refresh:        'تحديث',
    green:          'سليم',
    yellow:         'تحذير',
    red:            'غير متاح',
    latency:        'الكمون',
    reqMonth:       'طلبات الشهر',
    drag:           'اسحب لإعادة الترتيب',
    notes:          'ملاحظات',
    save:           'حفظ',
    jobs:           'المهام',
    jobsRunning:    'قيد التشغيل',
    jobsQueued:     'في الانتظار',
    jobsCompletedToday: 'مكتملة اليوم',
    jobsFailedToday:'فشلت اليوم',
    jobsAvgDuration:'متوسط المدة',
    jobsAvgCost:    'متوسط التكلفة',
    jobsAvgTokens:  'متوسط الرموز',
    jobsCancel:     'إلغاء',
    jobsRetry:      'إعادة',
    jobsAll:        'الكل',
    jobsModule:     'الوحدة',
    jobsProvider:   'المزوّد',
    jobsType:       'النوع',
    jobsSearch:     'بحث…',
    jobsEmpty:      'لا توجد مهام',
    jobsLogs:       'السجلات',
    jobsOutput:     'المخرجات',
    jobsError:      'الخطأ',
    jobsDuration:   'المدة',
    jobsTokens:     'الرموز',
    jobsCost:       'التكلفة',
    jobsRetries:    'المحاولات',
  },
  fr: {
    title:          'Centre IA',
    subtitle:       'Gestion des fournisseurs IA',
    back:           '→ Panel SuperAdmin',
    login:          'Connexion',
    email:          'Email',
    secret:         'Mot de passe',
    analytics:      'Analytique',
    providers:      'Fournisseurs',
    health:         'Santé',
    reqToday:       "Requêtes aujourd'hui",
    tokensToday:    "Tokens aujourd'hui",
    costToday:      "Coût aujourd'hui",
    costMonth:      'Coût ce mois',
    avgLatency:     'Latence moyenne',
    failureRate:    "Taux d'échec",
    enabled:        'Activé',
    disabled:       'Désactivé',
    apiKey:         'Clé API',
    configured:     'Configurée',
    notConfigured:  'Non configurée',
    model:          'Modèle',
    priority:       'Priorité',
    successRate:    'Taux de succès',
    lastSuccess:    'Dernier succès',
    testConnection: 'Tester connexion',
    testing:        'Test en cours…',
    enable:         'Activer',
    disable:        'Désactiver',
    setDefault:     'Définir défaut',
    default:        'Défaut',
    fallbackChain:  'Chaîne de secours',
    saveChain:      'Sauvegarder',
    saving:         'Sauvegarde…',
    noProviders:    'Aucun fournisseur',
    loading:        'Chargement…',
    refresh:        'Actualiser',
    green:          'Sain',
    yellow:         'Dégradé',
    red:            'Indisponible',
    latency:        'Latence',
    reqMonth:       'Requêtes ce mois',
    drag:           'Glisser pour réorganiser',
    notes:          'Notes',
    save:           'Enregistrer',
    jobs:           'Jobs IA',
    jobsRunning:    'En cours',
    jobsQueued:     'En attente',
    jobsCompletedToday: 'Terminés aujourd\'hui',
    jobsFailedToday:'Échoués aujourd\'hui',
    jobsAvgDuration:'Durée moyenne',
    jobsAvgCost:    'Coût moyen',
    jobsAvgTokens:  'Tokens moyens',
    jobsCancel:     'Annuler',
    jobsRetry:      'Relancer',
    jobsAll:        'Tous',
    jobsModule:     'Module',
    jobsProvider:   'Fournisseur',
    jobsType:       'Type',
    jobsSearch:     'Rechercher…',
    jobsEmpty:      'Aucun job',
    jobsLogs:       'Logs',
    jobsOutput:     'Résultat',
    jobsError:      'Erreur',
    jobsDuration:   'Durée',
    jobsTokens:     'Tokens',
    jobsCost:       'Coût',
    jobsRetries:    'Tentatives',
  },
  en: {
    title:          'AI Center',
    subtitle:       'AI Provider Management',
    back:           '→ SuperAdmin Panel',
    login:          'Login',
    email:          'Email',
    secret:         'Secret',
    analytics:      'Analytics',
    providers:      'Providers',
    health:         'Health',
    reqToday:       'Requests today',
    tokensToday:    'Tokens today',
    costToday:      'Cost today',
    costMonth:      'Cost this month',
    avgLatency:     'Avg latency',
    failureRate:    'Failure rate',
    enabled:        'Enabled',
    disabled:       'Disabled',
    apiKey:         'API Key',
    configured:     'Configured',
    notConfigured:  'Not configured',
    model:          'Model',
    priority:       'Priority',
    successRate:    'Success rate',
    lastSuccess:    'Last success',
    testConnection: 'Test connection',
    testing:        'Testing…',
    enable:         'Enable',
    disable:        'Disable',
    setDefault:     'Set as default',
    default:        'Default',
    fallbackChain:  'Fallback chain',
    saveChain:      'Save chain',
    saving:         'Saving…',
    noProviders:    'No providers',
    loading:        'Loading…',
    refresh:        'Refresh',
    green:          'Healthy',
    yellow:         'Degraded',
    red:            'Unavailable',
    latency:        'Latency',
    reqMonth:       'Requests this month',
    drag:           'Drag to reorder',
    notes:          'Notes',
    save:           'Save',
    jobs:           'AI Jobs',
    jobsRunning:    'Running',
    jobsQueued:     'Queued',
    jobsCompletedToday: 'Completed today',
    jobsFailedToday:'Failed today',
    jobsAvgDuration:'Avg duration',
    jobsAvgCost:    'Avg cost',
    jobsAvgTokens:  'Avg tokens',
    jobsCancel:     'Cancel',
    jobsRetry:      'Retry',
    jobsAll:        'All',
    jobsModule:     'Module',
    jobsProvider:   'Provider',
    jobsType:       'Type',
    jobsSearch:     'Search…',
    jobsEmpty:      'No jobs found',
    jobsLogs:       'Logs',
    jobsOutput:     'Output',
    jobsError:      'Error',
    jobsDuration:   'Duration',
    jobsTokens:     'Tokens',
    jobsCost:       'Cost',
    jobsRetries:    'Retries',
  },
}

type Lang = 'ar' | 'fr' | 'en'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderStats {
  providerId:         string
  requestsToday:      number
  tokensToday:        number
  costUsdToday:       number
  successRateToday:   number
  avgLatencyMsToday:  number
  requestsMonth:      number
  tokensMonth:        number
  costUsdMonth:       number
  successRateMonth:   number
  avgLatencyMsMonth:  number
  lastSuccessAt:      string | null
  lastFailureReason:  string | null
}

interface Provider {
  id:                  string
  label:               string
  model:               string
  docsUrl:             string
  pricingNote:         string
  apiKeyEnv:           string
  apiKeyConfigured:    boolean
  registeredInProcess: boolean
  runtimeActive:       boolean
  runtimePriority:     number
  isEnabled:           boolean
  priority:            number
  isDefault:           boolean
  fallbackChain:       string[]
  notes:               string
  updatedAt:           string | null
  updatedBy:           string | null
  stats:               ProviderStats
}

interface PlatformTotals {
  requestsToday: number
  tokensToday:   number
  costUsdToday:  number
  requestsMonth: number
  tokensMonth:   number
  costUsdMonth:  number
  avgLatencyMs:  number
  failureRate:   number
}

interface HealthCheck {
  id:        string
  name:      string
  healthy:   boolean
  status:    string
  latencyMs: number | null
  error:     string | null
  checkedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(val: number) {
  if (val < 0.01) return `$${(val * 1000).toFixed(2)}m`
  return `$${val.toFixed(3)}`
}
function fmtMs(ms: number) {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}
function fmtPct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Health badge ─────────────────────────────────────────────────────────────

function HealthBadge({ status, lang }: { status: string; lang: Lang }) {
  const t = T[lang]
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">
        <CheckCircle2 className="w-3 h-3" /> {t.green}
      </span>
    )
  }
  if (status === 'degraded') {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">
        <AlertTriangle className="w-3 h-3" /> {t.yellow}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800">
      <XCircle className="w-3 h-3" /> {t.red}
    </span>
  )
}

// ─── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  lang,
  superHeader,
  onRefresh,
}: {
  provider: Provider
  lang: Lang
  superHeader: () => Record<string, string>
  onRefresh: () => void
}) {
  const t = T[lang]
  const [testing,   setTesting]   = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; status: string; latencyMs: number | null; error: string | null } | null>(null)
  const [updating,  setUpdating]  = useState(false)
  const [editPriority, setEditPriority] = useState(String(provider.priority))
  const [editNotes,    setEditNotes]    = useState(provider.notes)
  const [expanded,  setExpanded]  = useState(false)

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch(`/api/superadmin/ai-center/providers/${provider.id}/test`, {
        method: 'POST',
        headers: superHeader(),
      })
      const data = await r.json()
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, status: 'unavailable', latencyMs: null, error: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  async function toggleEnabled() {
    setUpdating(true)
    await fetch(`/api/superadmin/ai-center/providers/${provider.id}`, {
      method: 'PATCH',
      headers: { ...superHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !provider.isEnabled }),
    })
    setUpdating(false)
    onRefresh()
  }

  async function setDefault() {
    setUpdating(true)
    await fetch(`/api/superadmin/ai-center/providers/${provider.id}`, {
      method: 'PATCH',
      headers: { ...superHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    })
    setUpdating(false)
    onRefresh()
  }

  async function savePriorityAndNotes() {
    setUpdating(true)
    await fetch(`/api/superadmin/ai-center/providers/${provider.id}`, {
      method: 'PATCH',
      headers: { ...superHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: Number(editPriority), notes: editNotes }),
    })
    setUpdating(false)
    onRefresh()
  }

  const successColor = provider.stats.successRateToday > 0.95
    ? 'text-green-400'
    : provider.stats.successRateToday > 0.80
    ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className={`rounded-xl border ${provider.isEnabled ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-800 bg-zinc-950 opacity-70'} p-4 transition-all`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm">{provider.label}</span>
            {provider.isDefault && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800">
                <Star className="w-3 h-3" /> {t.default}
              </span>
            )}
            {provider.isEnabled
              ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-900">{t.enabled}</span>
              : <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">{t.disabled}</span>
            }
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {provider.model}</span>
            <span className="flex items-center gap-1">
              <Key className="w-3 h-3" />
              <span className={provider.apiKeyConfigured ? 'text-green-400' : 'text-red-400'}>
                {provider.apiKeyConfigured ? t.configured : t.notConfigured}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={provider.docsUrl} target="_blank" rel="noreferrer"
            className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={() => setExpanded(e => !e)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-zinc-500">{t.reqToday}</div>
          <div className="text-sm font-bold text-white">{fmtNum(provider.stats.requestsToday)}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-zinc-500">{t.costToday}</div>
          <div className="text-sm font-bold text-purple-300">{fmt$(provider.stats.costUsdToday)}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-zinc-500">{t.avgLatency}</div>
          <div className="text-sm font-bold text-blue-300">{fmtMs(provider.stats.avgLatencyMsToday)}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-zinc-500">{t.successRate}</div>
          <div className={`text-sm font-bold ${successColor}`}>{fmtPct(provider.stats.successRateToday)}</div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
          {/* MTD stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-800/30 rounded-lg p-2 text-center">
              <div className="text-xs text-zinc-500">{t.reqMonth}</div>
              <div className="text-sm font-semibold text-zinc-200">{fmtNum(provider.stats.requestsMonth)}</div>
            </div>
            <div className="bg-zinc-800/30 rounded-lg p-2 text-center">
              <div className="text-xs text-zinc-500">{t.costMonth}</div>
              <div className="text-sm font-semibold text-zinc-200">{fmt$(provider.stats.costUsdMonth)}</div>
            </div>
            <div className="bg-zinc-800/30 rounded-lg p-2 text-center">
              <div className="text-xs text-zinc-500">{t.lastSuccess}</div>
              <div className="text-xs font-medium text-zinc-300">{fmtDate(provider.stats.lastSuccessAt)}</div>
            </div>
          </div>

          {/* Pricing note */}
          <p className="text-xs text-zinc-500 italic">{provider.pricingNote}</p>

          {/* Priority + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">{t.priority}</label>
              <input
                type="number" min={1} max={99}
                value={editPriority}
                onChange={e => setEditPriority(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">{t.notes}</label>
              <input
                type="text"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleEnabled}
              disabled={updating}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                provider.isEnabled
                  ? 'bg-red-900/40 hover:bg-red-900/70 text-red-300 border border-red-800'
                  : 'bg-green-900/40 hover:bg-green-900/70 text-green-300 border border-green-800'
              }`}
            >
              {provider.isEnabled ? t.disable : t.enable}
            </button>

            {!provider.isDefault && (
              <button
                onClick={setDefault}
                disabled={updating}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-800 transition-all"
              >
                {t.setDefault}
              </button>
            )}

            <button
              onClick={savePriorityAndNotes}
              disabled={updating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 border border-blue-800 transition-all"
            >
              {updating ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t.save}
            </button>

            <button
              onClick={testConnection}
              disabled={testing || !provider.apiKeyConfigured}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all disabled:opacity-40"
            >
              {testing ? (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{t.testing}</span>
              ) : t.testConnection}
            </button>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`rounded-lg p-3 text-xs ${testResult.ok ? 'bg-green-900/20 border border-green-800 text-green-300' : 'bg-red-900/20 border border-red-800 text-red-300'}`}>
              {testResult.ok ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {T[lang].green}
                  {testResult.latencyMs !== null && ` — ${fmtMs(testResult.latencyMs)}`}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  {testResult.error ?? testResult.status}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Fallback chain configurator ──────────────────────────────────────────────

function FallbackChainConfig({
  providers,
  lang,
  superHeader,
  onRefresh,
}: {
  providers: Provider[]
  lang: Lang
  superHeader: () => Record<string, string>
  onRefresh: () => void
}) {
  const t = T[lang]
  const enabledProviders = providers.filter(p => p.isEnabled).sort((a, b) => a.priority - b.priority)
  const [chain, setChain] = useState<string[]>(
    enabledProviders.map(p => p.id)
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setChain(enabledProviders.map(p => p.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers.length])

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...chain]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setChain(next)
  }
  function moveDown(idx: number) {
    if (idx === chain.length - 1) return
    const next = [...chain]
    ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
    setChain(next)
  }

  async function save() {
    setSaving(true)
    await fetch('/api/superadmin/ai-center/fallback-chain', {
      method: 'POST',
      headers: { ...superHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ chain }),
    })
    setSaving(false)
    onRefresh()
  }

  const labelFor = (id: string) => providers.find(p => p.id === id)?.label ?? id

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" /> {t.fallbackChain}
        </h3>
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all disabled:opacity-50 flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {saving ? t.saving : t.saveChain}
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-3">{t.drag}</p>
      <div className="space-y-1.5">
        {chain.map((id, idx) => (
          <div key={id} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
            <GripVertical className="w-4 h-4 text-zinc-600 flex-shrink-0" />
            <span className="text-xs font-medium text-white flex-1">{idx + 1}. {labelFor(id)}</span>
            {idx === 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-800">
                {t.default}
              </span>
            )}
            <div className="flex gap-1">
              <button onClick={() => moveUp(idx)} disabled={idx === 0}
                className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => moveDown(idx)} disabled={idx === chain.length - 1}
                className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Health page ──────────────────────────────────────────────────────────────

function HealthPage({
  lang,
  superHeader,
}: {
  lang: Lang
  superHeader: () => Record<string, string>
}) {
  const t = T[lang]
  const [checks,   setChecks]   = useState<HealthCheck[]>([])
  const [loading,  setLoading]  = useState(false)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/superadmin/ai-center/health', { headers: superHeader() })
      const data = await r.json()
      setChecks(data.checks ?? [])
      setCheckedAt(data.checkedAt ?? null)
    } finally {
      setLoading(false)
    }
  }, [superHeader])

  useEffect(() => { run() }, [run])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" /> {t.health}
        </h2>
        <div className="flex items-center gap-3">
          {checkedAt && <span className="text-xs text-zinc-600">{fmtDate(checkedAt)}</span>}
          <button onClick={run} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> {t.refresh}
          </button>
        </div>
      </div>

      {checks.length === 0 ? (
        <div className="text-center text-zinc-600 py-12 text-sm">{loading ? t.loading : t.noProviders}</div>
      ) : (
        <div className="space-y-3">
          {checks.map(c => (
            <div key={c.id} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{c.name}</div>
                {c.error && <div className="text-xs text-red-400 mt-0.5">{c.error}</div>}
              </div>
              {c.latencyMs !== null && (
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {fmtMs(c.latencyMs)}
                </span>
              )}
              <HealthBadge status={c.status} lang={lang} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Analytics page ───────────────────────────────────────────────────────────

function AnalyticsPage({
  lang,
  superHeader,
}: {
  lang: Lang
  superHeader: () => Record<string, string>
}) {
  const t = T[lang]
  const [totals,      setTotals]      = useState<PlatformTotals | null>(null)
  const [perProvider, setPerProvider] = useState<ProviderStats[]>([])
  const [loading,     setLoading]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/superadmin/ai-center/analytics', { headers: superHeader() })
      const data = await r.json()
      setTotals(data.totals ?? null)
      setPerProvider(data.perProvider ?? [])
    } finally {
      setLoading(false)
    }
  }, [superHeader])

  useEffect(() => { load() }, [load])

  if (loading && !totals) {
    return <div className="text-center text-zinc-600 py-12 text-sm">{t.loading}</div>
  }

  return (
    <div className="space-y-6">
      {/* Platform totals */}
      {totals && (
        <div>
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Platform — Today</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <BarChart3 className="w-4 h-4 text-blue-400" />, label: t.reqToday,    val: fmtNum(totals.requestsToday) },
              { icon: <Zap className="w-4 h-4 text-purple-400" />,     label: t.tokensToday, val: fmtNum(totals.tokensToday) },
              { icon: <DollarSign className="w-4 h-4 text-green-400" />, label: t.costToday,  val: fmt$(totals.costUsdToday) },
              { icon: <DollarSign className="w-4 h-4 text-amber-400" />, label: t.costMonth,  val: fmt$(totals.costUsdMonth) },
              { icon: <Clock className="w-4 h-4 text-blue-400" />,      label: t.avgLatency,  val: fmtMs(totals.avgLatencyMs) },
              { icon: <XCircle className="w-4 h-4 text-red-400" />,    label: t.failureRate,  val: fmtPct(totals.failureRate) },
              { icon: <BarChart3 className="w-4 h-4 text-zinc-400" />, label: t.reqMonth,     val: fmtNum(totals.requestsMonth) },
              { icon: <Zap className="w-4 h-4 text-zinc-400" />,        label: 'Tokens MTD',  val: fmtNum(totals.tokensMonth) },
            ].map((card, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">{card.icon}<span className="text-xs text-zinc-500">{card.label}</span></div>
                <div className="text-lg font-bold text-white">{card.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-provider breakdown */}
      {perProvider.length > 0 && (
        <div>
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Per Provider — Today</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-600 border-b border-zinc-800">
                  <th className="text-left py-2 px-3">Provider</th>
                  <th className="text-right py-2 px-3">{t.reqToday}</th>
                  <th className="text-right py-2 px-3">{t.tokensToday}</th>
                  <th className="text-right py-2 px-3">{t.costToday}</th>
                  <th className="text-right py-2 px-3">{t.avgLatency}</th>
                  <th className="text-right py-2 px-3">{t.successRate}</th>
                </tr>
              </thead>
              <tbody>
                {perProvider.map(p => (
                  <tr key={p.providerId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 px-3 text-zinc-300 font-medium capitalize">{p.providerId}</td>
                    <td className="py-2 px-3 text-right text-zinc-400">{fmtNum(p.requestsToday)}</td>
                    <td className="py-2 px-3 text-right text-zinc-400">{fmtNum(p.tokensToday)}</td>
                    <td className="py-2 px-3 text-right text-purple-300">{fmt$(p.costUsdToday)}</td>
                    <td className="py-2 px-3 text-right text-blue-300">{fmtMs(p.avgLatencyMsToday)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${p.successRateToday > 0.95 ? 'text-green-400' : p.successRateToday > 0.8 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {fmtPct(p.successRateToday)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AICenterPage() {
  const [lang, setLang] = useState<Lang>('ar')
  const [secret, setSecret] = useState('')
  const [email,  setEmail]  = useState('')
  const [authed, setAuthed] = useState(false)
  const [loginErr, setLoginErr] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [tab, setTab] = useState<'providers' | 'analytics' | 'health' | 'jobs'>('providers')

  const [providers, setProviders] = useState<Provider[]>([])
  const [loading,   setLoading]   = useState(false)

  const secretRef = useRef(secret)
  const emailRef  = useRef(email)
  useEffect(() => { secretRef.current = secret }, [secret])
  useEffect(() => { emailRef.current  = email  }, [email])

  const superHeader = useCallback((): Record<string, string> => ({
    'x-superadmin-secret': secretRef.current,
    'x-superadmin-email':  emailRef.current,
  }), [])

  // ── AI Jobs state ──────────────────────────────────────────────────────────
  const [jobs,        setJobs]        = useState<any[]>([])
  const [jobsStats,   setJobsStats]   = useState<any>(null)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobDetail,   setJobDetail]   = useState<any>(null)
  const [jobFilter,   setJobFilter]   = useState({ status: '', module: '', provider: '', jobType: '', search: '' })
  const jobsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadJobs = useCallback(async () => {
    setJobsLoading(true)
    try {
      const params = new URLSearchParams()
      if (jobFilter.status)   params.set('status',   jobFilter.status)
      if (jobFilter.module)   params.set('module',   jobFilter.module)
      if (jobFilter.provider) params.set('provider', jobFilter.provider)
      if (jobFilter.jobType)  params.set('jobType',  jobFilter.jobType)
      if (jobFilter.search)   params.set('search',   jobFilter.search)
      const [jr, sr] = await Promise.all([
        fetch(`/api/superadmin/ai-jobs?${params}&limit=100`, { headers: superHeader() }),
        fetch('/api/superadmin/ai-jobs/stats', { headers: superHeader() }),
      ])
      if (jr.ok) { const d = await jr.json(); setJobs(d.jobs ?? []) }
      if (sr.ok) setJobsStats(await sr.json())
    } finally { setJobsLoading(false) }
  }, [jobFilter, superHeader])

  useEffect(() => {
    if (tab !== 'jobs') {
      if (jobsIntervalRef.current) { clearInterval(jobsIntervalRef.current); jobsIntervalRef.current = null }
      return
    }
    loadJobs()
    jobsIntervalRef.current = setInterval(loadJobs, 5000)
    return () => { if (jobsIntervalRef.current) clearInterval(jobsIntervalRef.current) }
  }, [tab, loadJobs])

  async function loadJobDetail(id: string) {
    const r = await fetch(`/api/superadmin/ai-jobs/${id}`, { headers: superHeader() })
    if (r.ok) setJobDetail(await r.json())
  }

  async function cancelAIJob(id: string) {
    await fetch(`/api/superadmin/ai-jobs/${id}/cancel`, { method: 'POST', headers: superHeader() })
    loadJobs()
    if (jobDetail?.id === id) setJobDetail((p: any) => ({ ...p, status: 'CANCELLED' }))
  }

  async function retryAIJob(id: string) {
    await fetch(`/api/superadmin/ai-jobs/${id}/retry`, { method: 'POST', headers: superHeader() })
    loadJobs()
  }

  async function login() {
    setLoginLoading(true)
    setLoginErr('')
    try {
      const r = await fetch('/api/superadmin/ai-center/providers', {
        headers: { 'x-superadmin-secret': secret, 'x-superadmin-email': email },
      })
      if (r.status === 401) { setLoginErr('كلمة سر خاطئة'); return }
      const data = await r.json()
      setProviders(data.providers ?? [])
      setAuthed(true)
    } catch {
      setLoginErr('خطأ في الشبكة')
    } finally {
      setLoginLoading(false)
    }
  }

  const loadProviders = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/superadmin/ai-center/providers', { headers: superHeader() })
      const data = await r.json()
      setProviders(data.providers ?? [])
    } finally {
      setLoading(false)
    }
  }, [superHeader])

  useEffect(() => {
    if (authed) loadProviders()
  }, [authed, loadProviders])

  const t = T[lang]

  // ── Login screen ──────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="flex gap-2 mb-8">
          {(['ar', 'fr', 'en'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${lang === l ? 'bg-purple-600 border-purple-500 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
              {l === 'ar' ? 'ع' : l === 'fr' ? 'FR' : 'EN'}
            </button>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Brain className="w-6 h-6 text-purple-400" />
            <h1 className="text-lg font-bold">{t.title}</h1>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              placeholder={t.email}
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
            <input
              type="password"
              placeholder={t.secret}
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
            {loginErr && <p className="text-red-400 text-xs text-center">{loginErr}</p>}
            <button
              onClick={login}
              disabled={loginLoading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.login}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main dashboard ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top nav */}
      <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href="/superadmin" className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
              <ArrowLeft className="w-4 h-4 inline" /> {t.back}
            </a>
            <span className="text-zinc-700">|</span>
            <div className="flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-sm">{t.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Lang switcher */}
            <div className="flex gap-1">
              {(['ar', 'fr', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2 py-0.5 text-xs rounded border transition-all ${lang === l ? 'bg-purple-600 border-purple-500 text-white' : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'}`}>
                  {l === 'ar' ? 'ع' : l === 'fr' ? 'FR' : 'EN'}
                </button>
              ))}
            </div>

            <button onClick={loadProviders} disabled={loading}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t.refresh}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-0 border-t border-zinc-800">
          {[
            { key: 'providers', label: t.providers, icon: <Brain className="w-3.5 h-3.5" /> },
            { key: 'analytics', label: t.analytics, icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { key: 'health',    label: t.health,    icon: <Activity className="w-3.5 h-3.5" /> },
            { key: 'jobs',      label: t.jobs,      icon: <Zap className="w-3.5 h-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                tab === key
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'providers' && (
          <div className="space-y-6">
            {/* Provider cards */}
            <div className="space-y-3">
              {providers.length === 0 && (
                <div className="text-center text-zinc-600 py-12 text-sm">{loading ? t.loading : t.noProviders}</div>
              )}
              {providers.map(p => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  lang={lang}
                  superHeader={superHeader}
                  onRefresh={loadProviders}
                />
              ))}
            </div>

            {/* Fallback chain */}
            {providers.length > 0 && (
              <FallbackChainConfig
                providers={providers}
                lang={lang}
                superHeader={superHeader}
                onRefresh={loadProviders}
              />
            )}
          </div>
        )}

        {tab === 'analytics' && (
          <AnalyticsPage lang={lang} superHeader={superHeader} />
        )}

        {tab === 'health' && (
          <HealthPage lang={lang} superHeader={superHeader} />
        )}

        {tab === 'jobs' && (
          <div className="space-y-4">
            {/* Stats pills */}
            {jobsStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: t.jobsRunning,        val: jobsStats.running,        color: 'text-blue-400',    bg: 'bg-blue-950/40 border-blue-800/40' },
                  { label: t.jobsQueued,         val: jobsStats.queued,         color: 'text-amber-400',   bg: 'bg-amber-950/40 border-amber-800/40' },
                  { label: t.jobsCompletedToday, val: jobsStats.completedToday, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/40' },
                  { label: t.jobsFailedToday,    val: jobsStats.failedToday,    color: 'text-red-400',     bg: 'bg-red-950/40 border-red-800/40' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                    <p className={`text-2xl font-black ${s.color}`}>{s.val ?? 0}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Secondary stats */}
            {jobsStats && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t.jobsAvgDuration, val: jobsStats.avgDurationMs ? `${(jobsStats.avgDurationMs/1000).toFixed(1)}s` : '—' },
                  { label: t.jobsAvgTokens,   val: jobsStats.avgTokens ? jobsStats.avgTokens.toLocaleString() : '—' },
                  { label: t.jobsAvgCost,     val: jobsStats.avgCost ? `$${jobsStats.avgCost.toFixed(4)}` : '—' },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-white">{s.val}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {['', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'].map(s => (
                <button key={s} onClick={() => setJobFilter(f => ({ ...f, status: s }))}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    jobFilter.status === s ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}>
                  {s || t.jobsAll}
                </button>
              ))}
              <input value={jobFilter.search} onChange={e => setJobFilter(f => ({ ...f, search: e.target.value }))}
                placeholder={t.jobsSearch}
                className="flex-1 min-w-[140px] bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500" />
            </div>

            {/* Job list + detail panel */}
            <div className="flex gap-4">
              {/* List */}
              <div className="flex-1 space-y-2 min-w-0">
                {jobsLoading && jobs.length === 0 && (
                  <div className="text-center py-8 text-zinc-600 text-sm"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />{t.loading}</div>
                )}
                {!jobsLoading && jobs.length === 0 && (
                  <div className="text-center py-8 text-zinc-600 text-sm">{t.jobsEmpty}</div>
                )}
                {jobs.map((job: any) => {
                  const STATUS_COLOR: Record<string, string> = {
                    QUEUED: 'bg-amber-900 text-amber-300', RUNNING: 'bg-blue-900 text-blue-300',
                    COMPLETED: 'bg-emerald-900 text-emerald-300', FAILED: 'bg-red-900 text-red-300',
                    CANCELLED: 'bg-zinc-800 text-zinc-400',
                  }
                  return (
                    <div key={job.id} onClick={() => loadJobDetail(job.id)}
                      className={`bg-zinc-900 border rounded-xl p-3 cursor-pointer transition-all hover:border-purple-700 ${jobDetail?.id === job.id ? 'border-purple-600' : 'border-zinc-800'}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[job.status] ?? 'bg-zinc-800 text-zinc-400'}`}>{job.status}</span>
                        <span className="text-xs font-semibold text-white truncate">{job.module} / {job.jobType}</span>
                        {job.provider && <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{job.provider}</span>}
                        <span className="ml-auto text-[10px] text-zinc-600">{new Date(job.queuedAt).toLocaleTimeString()}</span>
                      </div>
                      {job.status === 'RUNNING' && (
                        <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                        </div>
                      )}
                      {job.errorMessage && <p className="text-[10px] text-red-400 mt-1 truncate">{job.errorMessage}</p>}
                      <div className="flex gap-3 mt-1 text-[10px] text-zinc-600">
                        {job.durationMs && <span>{(job.durationMs/1000).toFixed(1)}s</span>}
                        {job.totalTokens && <span>{job.totalTokens.toLocaleString()} tok</span>}
                        {job.estimatedCost && <span>${job.estimatedCost.toFixed(4)}</span>}
                        {job.retryCount > 0 && <span>{job.retryCount} retries</span>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Detail panel */}
              {jobDetail && (
                <div className="w-80 shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 self-start sticky top-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white text-sm">{jobDetail.module} / {jobDetail.jobType}</p>
                    <button onClick={() => setJobDetail(null)} className="text-zinc-600 hover:text-white text-xs">✕</button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ['Status',        jobDetail.status],
                      ['Provider',      jobDetail.provider ?? '—'],
                      ['Model',         jobDetail.model ?? '—'],
                      [t.jobsDuration,  jobDetail.durationMs ? `${(jobDetail.durationMs/1000).toFixed(2)}s` : '—'],
                      [t.jobsTokens,    jobDetail.totalTokens?.toLocaleString() ?? '—'],
                      [t.jobsCost,      jobDetail.estimatedCost ? `$${jobDetail.estimatedCost.toFixed(5)}` : '—'],
                      [t.jobsRetries,   String(jobDetail.retryCount ?? 0)],
                      ['Input ref',     jobDetail.inputReference ?? '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-zinc-800 rounded-lg p-2">
                        <p className="text-zinc-500 text-[10px]">{k}</p>
                        <p className="text-white font-semibold truncate">{v}</p>
                      </div>
                    ))}
                  </div>

                  {jobDetail.errorMessage && (
                    <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-3">
                      <p className="text-xs font-semibold text-red-400 mb-1">{t.jobsError}</p>
                      <p className="text-xs text-red-300">{jobDetail.errorMessage}</p>
                    </div>
                  )}

                  {jobDetail.logs?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 mb-2">{t.jobsLogs}</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {jobDetail.logs.map((log: any) => (
                          <div key={log.id} className="flex gap-2 text-[10px]">
                            <span className="text-zinc-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            <span className={`shrink-0 font-bold ${log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-amber-400' : 'text-zinc-500'}`}>{log.level}</span>
                            <span className="text-zinc-300">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {['QUEUED', 'RUNNING'].includes(jobDetail.status) && (
                      <button onClick={() => cancelAIJob(jobDetail.id)}
                        className="flex-1 bg-red-900 hover:bg-red-800 text-red-300 text-xs font-semibold py-2 rounded-lg transition-all">
                        {t.jobsCancel}
                      </button>
                    )}
                    {jobDetail.status === 'FAILED' && (
                      <button onClick={() => retryAIJob(jobDetail.id)}
                        className="flex-1 bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs font-semibold py-2 rounded-lg transition-all">
                        {t.jobsRetry}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
