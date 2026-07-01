'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Search, RefreshCw, Power, Pause, Play, X, RotateCw, ArrowLeftRight } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingSubscription {
  id: string; tenantId: string; planId: string; planCode: string; planName: string
  status: string; startDate: string; endDate: string | null; renewalDate: string | null
  trialEndsAt: string | null; cancelledAt: string | null; graceEndsAt: string | null
  autoRenew: boolean; notes: string | null; createdAt: string; updatedAt: string
}

interface PlanOption { id: string; name: string; code: string }

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الاشتراكات', subtitle: 'إدارة اشتراكات المستأجرين',
    search: 'بحث بمعرف المستأجر...', refresh: 'تحديث',
    tenantId: 'معرف المستأجر', plan: 'الخطة', status: 'الحالة',
    renewalDate: 'تاريخ التجديد', trialEndsAt: 'نهاية التجربة',
    autoRenew: 'تجديد تلقائي', yes: 'نعم', no: 'لا',
    actions: 'إجراءات', activate: 'تفعيل', suspend: 'تعليق',
    resume: 'استئناف', cancel: 'إلغاء', renew: 'تجديد',
    changePlan: 'تغيير الخطة', loading: 'جاري التحميل...',
    noSubs: 'لا توجد اشتراكات', confirmCancel: 'هل أنت متأكد من الإلغاء؟',
    confirmSuspend: 'هل أنت متأكد من التعليق؟',
    allStatus: 'كل الحالات', newSub: 'اشتراك جديد',
    STATUS: {
      TRIAL: 'تجريبي', ACTIVE: 'نشط', GRACE_PERIOD: 'فترة سماح',
      SUSPENDED: 'موقوف', CANCELLED: 'ملغى', EXPIRED: 'منتهي الصلاحية',
    } as Record<string, string>,
    prev: 'السابق', next: 'التالي', of: 'من',
    changePlanTitle: 'تغيير خطة الاشتراك', selectPlan: 'اختر خطة', save: 'حفظ',
  },
  en: {
    title: 'Subscriptions', subtitle: 'Manage tenant subscriptions',
    search: 'Search by tenant ID...', refresh: 'Refresh',
    tenantId: 'Tenant ID', plan: 'Plan', status: 'Status',
    renewalDate: 'Renewal Date', trialEndsAt: 'Trial Ends',
    autoRenew: 'Auto-Renew', yes: 'Yes', no: 'No',
    actions: 'Actions', activate: 'Activate', suspend: 'Suspend',
    resume: 'Resume', cancel: 'Cancel', renew: 'Renew',
    changePlan: 'Change Plan', loading: 'Loading...',
    noSubs: 'No subscriptions found', confirmCancel: 'Are you sure you want to cancel?',
    confirmSuspend: 'Are you sure you want to suspend?',
    allStatus: 'All Statuses', newSub: 'New Subscription',
    STATUS: {
      TRIAL: 'Trial', ACTIVE: 'Active', GRACE_PERIOD: 'Grace Period',
      SUSPENDED: 'Suspended', CANCELLED: 'Cancelled', EXPIRED: 'Expired',
    } as Record<string, string>,
    prev: 'Previous', next: 'Next', of: 'of',
    changePlanTitle: 'Change Subscription Plan', selectPlan: 'Select a plan', save: 'Save',
  },
}

const STATUS_COLOR: Record<string, string> = {
  TRIAL:        'bg-blue-900 text-blue-300',
  ACTIVE:       'bg-green-900 text-green-300',
  GRACE_PERIOD: 'bg-amber-900 text-amber-300',
  SUSPENDED:    'bg-orange-900 text-orange-300',
  CANCELLED:    'bg-red-900 text-red-400',
  EXPIRED:      'bg-zinc-700 text-zinc-400',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()

  const [data, setData]           = useState<{ subscriptions: BillingSubscription[]; total: number; page: number; pages: number } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [page, setPage]           = useState(1)
  const [changePlanSub, setChangePlanSub] = useState<string | null>(null)
  const [plans, setPlans]         = useState<PlanOption[]>([])
  const [newPlanId, setNewPlanId] = useState('')

  const t = T[lang]
  const isRTL = lang === 'ar'

  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (search) params.set('tenantId', search)
      if (statusFilter) params.set('status', statusFilter)
      const res  = await fetch(`/api/superadmin/billing/subscriptions?${params}`, { headers: header() })
      const json = await res.json()
      setData(json)
    } finally { setLoading(false) }
  }, [header, page, search, statusFilter])

  useEffect(() => { load() }, [load])

  async function action(id: string, path: string, body?: Record<string, unknown>) {
    await fetch(`/api/superadmin/billing/subscriptions/${id}${path}`, {
      method: 'POST',
      headers: { ...header(), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    load()
  }

  async function handleSuspend(id: string) {
    if (!confirm(t.confirmSuspend)) return
    await action(id, '/suspend')
  }

  async function handleCancel(id: string) {
    if (!confirm(t.confirmCancel)) return
    await action(id, '/cancel')
  }

  async function openChangePlan(id: string) {
    setChangePlanSub(id)
    setNewPlanId('')
    if (plans.length === 0) {
      const res  = await fetch('/api/superadmin/billing/plans', { headers: header() })
      const json = await res.json()
      setPlans(json.plans ?? [])
    }
  }

  async function submitChangePlan() {
    if (!changePlanSub || !newPlanId) return
    await action(changePlanSub, '/change-plan', { planId: newPlanId })
    setChangePlanSub(null)
  }

  function goPage(p: number) {
    setPage(p)
    load(p)
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />
            {t.title}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 transition">
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>
          <button onClick={() => load()} disabled={loading}
            className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition" title={t.refresh}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t.search}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl ps-10 pe-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500" />
        </div>
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100">
          <option value="">{t.allStatus}</option>
          {Object.keys(t.STATUS).map(s => (
            <option key={s} value={s}>{t.STATUS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                <th className="px-4 py-3 text-start">{t.tenantId}</th>
                <th className="px-4 py-3 text-start hidden md:table-cell">{t.plan}</th>
                <th className="px-4 py-3 text-start">{t.status}</th>
                <th className="px-4 py-3 text-start hidden lg:table-cell">{t.renewalDate} / {t.trialEndsAt}</th>
                <th className="px-4 py-3 text-start hidden md:table-cell">{t.autoRenew}</th>
                <th className="px-4 py-3 text-end">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />{t.loading}
                </td></tr>
              ) : !data || data.subscriptions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">{t.noSubs}</td></tr>
              ) : data.subscriptions.map(sub => {
                const canActivate = sub.status === 'TRIAL' || sub.status === 'GRACE_PERIOD'
                const canSuspend  = sub.status === 'ACTIVE' || sub.status === 'GRACE_PERIOD'
                const canResume   = sub.status === 'SUSPENDED'
                const canRenew    = sub.status === 'ACTIVE' || sub.status === 'GRACE_PERIOD'
                const canCancel   = sub.status !== 'CANCELLED' && sub.status !== 'EXPIRED'
                return (
                  <tr key={sub.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-zinc-200">{sub.tenantId}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-zinc-200">{sub.planName}</div>
                      <div className="text-xs text-zinc-500 font-mono">{sub.planCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[sub.status] ?? 'bg-zinc-700 text-zinc-400'}`}>
                        {t.STATUS[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-zinc-300 text-xs">
                      {sub.status === 'TRIAL' ? fmtDate(sub.trialEndsAt) : fmtDate(sub.renewalDate)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-zinc-300 text-xs">
                      {sub.autoRenew ? t.yes : t.no}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {canActivate && (
                          <button onClick={() => action(sub.id, '/activate')}
                            title={t.activate}
                            className="p-1.5 text-green-400 hover:bg-green-900/30 rounded">
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                        {canSuspend && (
                          <button onClick={() => handleSuspend(sub.id)}
                            title={t.suspend}
                            className="p-1.5 text-orange-400 hover:bg-orange-900/30 rounded">
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {canResume && (
                          <button onClick={() => action(sub.id, '/resume')}
                            title={t.resume}
                            className="p-1.5 text-green-400 hover:bg-green-900/30 rounded">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {canRenew && (
                          <button onClick={() => action(sub.id, '/renew')}
                            title={t.renew}
                            className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded">
                            <RotateCw className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openChangePlan(sub.id)}
                          title={t.changePlan}
                          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded">
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                        {canCancel && (
                          <button onClick={() => handleCancel(sub.id)}
                            title={t.cancel}
                            className="p-1.5 text-red-400 hover:bg-red-900/30 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5 text-sm text-zinc-400">
          <button onClick={() => goPage(Math.max(1, page - 1))} disabled={page <= 1}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition disabled:opacity-40">
            {t.prev}
          </button>
          <span>{page} {t.of} {data.pages}</span>
          <button onClick={() => goPage(Math.min(data.pages, page + 1))} disabled={page >= data.pages}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition disabled:opacity-40">
            {t.next}
          </button>
        </div>
      )}

      {/* Change Plan Modal */}
      {changePlanSub && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-5 text-zinc-100">{t.changePlanTitle}</h2>
            <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100">
              <option value="">{t.selectPlan}</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setChangePlanSub(null)}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition">
                {t.cancel}
              </button>
              <button onClick={submitChangePlan} disabled={!newPlanId}
                className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-600 rounded-lg transition disabled:opacity-50">
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
