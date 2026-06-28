'use client'

import { useEffect, useState, useCallback } from 'react'
import { Settings2, Save, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RuntimeSetting {
  key: string; value: unknown; type: string; description: string
  category: string; updatedAt: string; updatedBy?: string; readonly?: boolean
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الإعدادات الحية', subtitle: 'تعديل الإعدادات دون إعادة تشغيل الخادم',
    refresh: 'تحديث', save: 'حفظ', saving: 'جاري الحفظ...',
    saved: 'تم الحفظ', readonly: 'للقراءة فقط',
    categories: {
      system: 'النظام', ai: 'الذكاء الاصطناعي', billing: 'الفواتير',
      certification: 'الشهادة', analytics: 'التحليلات', marketing: 'التسويق', ops: 'العمليات',
    },
  },
  en: {
    title: 'Runtime Config', subtitle: 'Edit settings without restarting the server',
    refresh: 'Refresh', save: 'Save', saving: 'Saving...', saved: 'Saved', readonly: 'Read-only',
    categories: {
      system: 'System', ai: 'AI', billing: 'Billing',
      certification: 'Certification', analytics: 'Analytics', marketing: 'Marketing', ops: 'Operations',
    },
  },
}
type Lang = keyof typeof T

export default function RuntimePage() {
  const lang: Lang = 'ar'
  const t   = T[lang]
  const isRTL = lang === 'ar'

  const { header } = useSAAuth()
  const [settings, setSettings] = useState<RuntimeSetting[]>([])
  const [drafts,   setDrafts]   = useState<Record<string, unknown>>({})
  const [saving,   setSaving]   = useState<Record<string, boolean>>({})
  const [saved,    setSaved]    = useState<Record<string, boolean>>({})
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/superadmin/ops/runtime', { headers: header() })
      const data = await res.json()
      if (res.ok) {
        setSettings(data.settings ?? [])
        const init: Record<string, unknown> = {}
        for (const s of (data.settings ?? [])) init[s.key] = s.value
        setDrafts(init)
      }
    } finally { setLoading(false) }
  }, [header])

  useEffect(() => { load() }, [load])

  async function save(key: string) {
    setSaving(p => ({ ...p, [key]: true }))
    try {
      await fetch(`/api/superadmin/ops/runtime/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { ...header(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: drafts[key] }),
      })
      setSaved(p => ({ ...p, [key]: true }))
      setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000)
    } finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  // Group by category
  const groups: Record<string, RuntimeSetting[]> = {}
  for (const s of settings) {
    if (!groups[s.category]) groups[s.category] = []
    groups[s.category].push(s)
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{t.subtitle}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </button>
      </div>

      {/* Settings grouped by category */}
      <div className="space-y-6">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              {(t.categories as any)[cat] ?? cat}
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
              {items.map(setting => (
                <div key={setting.key} className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded-md">{setting.key}</code>
                      {setting.readonly && (
                        <span className="text-xs text-zinc-600">{t.readonly}</span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">{setting.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {setting.type === 'boolean' ? (
                      <button
                        onClick={() => !setting.readonly && setDrafts(p => ({ ...p, [setting.key]: !p[setting.key] }))}
                        disabled={setting.readonly}
                        className={`relative w-10 h-6 rounded-full transition-colors ${
                          drafts[setting.key] ? 'bg-indigo-600' : 'bg-zinc-700'
                        } ${setting.readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${drafts[setting.key] ? 'start-5' : 'start-1'}`} />
                      </button>
                    ) : (
                      <input
                        type={setting.type === 'number' ? 'number' : 'text'}
                        value={String(drafts[setting.key] ?? '')}
                        onChange={e => !setting.readonly && setDrafts(p => ({
                          ...p,
                          [setting.key]: setting.type === 'number' ? Number(e.target.value) : e.target.value,
                        }))}
                        disabled={setting.readonly}
                        className="w-32 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                      />
                    )}

                    {!setting.readonly && (
                      <button onClick={() => save(setting.key)} disabled={saving[setting.key]}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50">
                        {saved[setting.key]   ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                         saving[setting.key]  ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                         <Save className="w-3.5 h-3.5" />}
                        {saved[setting.key] ? t.saved : saving[setting.key] ? t.saving : t.save}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
