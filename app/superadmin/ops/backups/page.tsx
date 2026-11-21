'use client'

import { useEffect, useState, useCallback } from 'react'
import { HardDrive, Play, Trash2, CheckCircle2, XCircle, Loader2, Clock, RefreshCw } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

type BackupStatus = 'pending' | 'running' | 'completed' | 'failed'

interface BackupRecord {
  id: string; label: string; status: BackupStatus; sizeBytes?: number
  entities: Record<string, number>; triggeredBy: string
  createdAt: string; completedAt?: string; error?: string
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'لقطات عدد السجلات', subtitle: 'تسجيل عدد السجلات في كل جدول للمقارنة — ليست نسخة احتياطية',
    trigger: 'تسجيل لقطة الآن', refresh: 'تحديث',
    label: 'التسمية', status: 'الحالة', size: 'حجم تقديري', by: 'بواسطة',
    createdAt: 'وقت الإنشاء', entities: 'عدد السجلات',
    completed: 'مكتملة', failed: 'فشلت', running: 'جاري', pending: 'قيد الانتظار',
    delete: 'حذف', empty: 'لا توجد لقطات',
    confirmDelete: 'هل تريد حذف هذه اللقطة؟',
  },
  en: {
    title: 'Record-count snapshots', subtitle: 'Counts rows per collection for comparison — not a backup',
    trigger: 'Take snapshot', refresh: 'Refresh',
    label: 'Label', status: 'Status', size: 'Size', by: 'By',
    createdAt: 'Created', entities: 'Record counts',
    completed: 'Completed', failed: 'Failed', running: 'Running', pending: 'Pending',
    delete: 'Delete', empty: 'No backups yet',
    confirmDelete: 'Delete this backup record?',
  },
}
type Lang = keyof typeof T

const STATUS_STYLE: Record<BackupStatus, { color: string; icon: typeof CheckCircle2 }> = {
  completed: { color: 'text-emerald-400', icon: CheckCircle2 },
  failed:    { color: 'text-red-400',     icon: XCircle },
  running:   { color: 'text-blue-400',    icon: Loader2 },
  pending:   { color: 'text-zinc-400',    icon: Clock },
}

function fmtBytes(n?: number): string {
  if (!n) return '—'
  if (n < 1024)       return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export default function BackupsPage() {
  const lang: Lang = 'ar'
  const t   = T[lang]
  const isRTL = lang === 'ar'

  const { header } = useSAAuth()
  const [backups,    setBackups]    = useState<BackupRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/superadmin/ops/backup', { headers: header() })
      const data = await res.json()
      if (res.ok) setBackups(data.backups ?? [])
    } finally { setLoading(false) }
  }, [header])

  useEffect(() => { load() }, [load])

  async function trigger() {
    setTriggering(true)
    try {
      const res = await fetch('/api/superadmin/ops/backup/trigger', {
        method: 'POST', headers: { ...header(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: `Manual — ${new Date().toLocaleString()}` }),
      })
      if (res.ok) { await load() }
    } finally { setTriggering(false) }
  }

  async function del(id: string) {
    if (!confirm(t.confirmDelete)) return
    setDeleting(id)
    try {
      await fetch(`/api/superadmin/ops/backup/${id}`, { method: 'DELETE', headers: header() })
      setBackups(prev => prev.filter(b => b.id !== id))
    } finally { setDeleting(null) }
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Honesty banner: this feature only counts records (BackupService.collectEntityCounts);
          it copies no data. Real backups/restores must come from MongoDB Atlas. */}
      <div className="mb-5 rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
        {isRTL
          ? '⚠️ هذه الصفحة لا تنسخ أي بيانات — تسجّل فقط عدد السجلات. النسخ الاحتياطي والاسترجاع الحقيقي يتمّان من MongoDB Atlas (Backup / Point-in-Time Restore). تأكّد من تفعيله هناك.'
          : '⚠️ This page copies no data — it only records row counts. Real backups and restores come from MongoDB Atlas (Backup / Point-in-Time Restore). Make sure it is enabled there.'}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </button>
          <button onClick={trigger} disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
            {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {t.trigger}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
              <th className="text-start px-4 py-3 font-medium">{t.label}</th>
              <th className="text-start px-4 py-3 font-medium">{t.status}</th>
              <th className="text-start px-4 py-3 font-medium hidden sm:table-cell">{t.size}</th>
              <th className="text-start px-4 py-3 font-medium hidden md:table-cell">{t.by}</th>
              <th className="text-start px-4 py-3 font-medium hidden lg:table-cell">{t.createdAt}</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {backups.map(b => {
              const s    = STATUS_STYLE[b.status]
              const Icon = s.icon
              return (
                <tr key={b.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3 text-white font-medium text-sm max-w-xs truncate">{b.label}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 text-xs ${s.color}`}>
                      <Icon className={`w-3.5 h-3.5 ${b.status === 'running' ? 'animate-spin' : ''}`} />
                      {(t as any)[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden sm:table-cell">{fmtBytes(b.sizeBytes)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">{b.triggeredBy}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => del(b.id)} disabled={deleting === b.id}
                      className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40">
                      {deleting === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              )
            })}
            {!loading && backups.length === 0 && (
              <tr><td colSpan={6} className="text-center text-zinc-500 py-16">
                <HardDrive className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                {t.empty}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
