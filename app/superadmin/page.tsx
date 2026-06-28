'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Trash2, X, BarChart3, CalendarPlus, Zap, Coffee } from 'lucide-react'
import type { Overview, Tenant, MrrData, ModalState, Theme } from './components/types'
import ThemeA from './components/themes/ThemeA'
import ThemeB from './components/themes/ThemeB'
import ThemeC from './components/themes/ThemeC'

// Countries that get the $25 maintenance pack by default
const MAINTENANCE_COUNTRIES = ['SA','AE','KW','QA','BH','OM','FR','ES','BE','DE','IT','NL','PT','GB','US']

function defaultMaintenance(country: string) {
  return MAINTENANCE_COUNTRIES.includes(country.toUpperCase())
}

type ModalTab = 'billing' | 'trial' | 'activate'

// ─── Commission tier lookup (mirrors billing.ts) ──────────────────────────────

const TIERS: Record<string, { max: number; fee: number }[]> = {
  MA: [{max:20,fee:.5},{max:50,fee:3},{max:80,fee:5},{max:100,fee:7},{max:150,fee:10},{max:Infinity,fee:15}],
  SA: [{max:15,fee:1},{max:40,fee:3},{max:70,fee:6},{max:120,fee:10},{max:200,fee:15},{max:Infinity,fee:22}],
  AE: [{max:15,fee:1},{max:40,fee:3},{max:80,fee:6},{max:130,fee:10},{max:200,fee:15},{max:Infinity,fee:22}],
  KW: [{max:1.5,fee:.1},{max:4,fee:.3},{max:8,fee:.6},{max:15,fee:1},{max:25,fee:1.5},{max:Infinity,fee:2.5}],
  QA: [{max:15,fee:1},{max:40,fee:3},{max:70,fee:6},{max:120,fee:10},{max:200,fee:15},{max:Infinity,fee:22}],
  DZ: [{max:500,fee:15},{max:1200,fee:80},{max:2000,fee:150},{max:3000,fee:200},{max:5000,fee:300},{max:Infinity,fee:450}],
  TN: [{max:5,fee:.15},{max:15,fee:.8},{max:25,fee:1.5},{max:40,fee:2},{max:70,fee:3},{max:Infinity,fee:5}],
  EG: [{max:50,fee:2},{max:150,fee:10},{max:250,fee:18},{max:400,fee:28},{max:600,fee:40},{max:Infinity,fee:60}],
  SN: [{max:800,fee:25},{max:2000,fee:100},{max:4000,fee:200},{max:7000,fee:350},{max:Infinity,fee:600}],
  EU: [{max:5,fee:.1},{max:12,fee:.25},{max:25,fee:.5},{max:50,fee:.8},{max:100,fee:1.2},{max:Infinity,fee:2}],
}
const EU = ['FR','ES','BE','DE','IT','NL','PT']

function getCommission(price: number, country: string): number {
  const tiers = TIERS[country] ?? (EU.includes(country) ? TIERS.EU : TIERS.MA)
  for (const t of tiers) if (price < t.max) return t.fee
  return tiers[tiers.length - 1].fee
}

function estimateCycle(
  coffeePrice: number, sandwichPrice: number,
  country: string, cycle: number,
  maintenance: boolean, maintenanceFee: number,
  perDayCoffee = 10, perDaySandwich = 10
): { commission: number; maintenanceAmt: number; total: number } {
  const coffeeComm   = getCommission(coffeePrice,   country)
  const sandwichComm = getCommission(sandwichPrice, country)
  const commission   = parseFloat(((perDayCoffee * coffeeComm + perDaySandwich * sandwichComm) * cycle).toFixed(2))
  const maintenanceAmt = maintenance ? maintenanceFee : 0
  return { commission, maintenanceAmt, total: parseFloat((commission + maintenanceAmt).toFixed(2)) }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BILLING_LABELS: Record<string, string> = {
  GRACE_PERIOD:    'تجريبي',
  COLLECTING_DEBT: 'نشط',
  SUSPENDED:       'موقوف'
}
const BILLING_COLORS: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-900/50 text-amber-300 border border-amber-700',
  COLLECTING_DEBT: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
  SUSPENDED:       'bg-red-900/50 text-red-300 border border-red-700'
}
const TIER_COLORS: Record<string, string> = {
  ECONOMY:  'bg-sky-900/50 text-sky-300 border border-sky-700',
  ADVANCED: 'bg-violet-900/50 text-violet-300 border border-violet-700'
}
const TIER_AR: Record<string, string> = { ECONOMY: 'اقتصادي', ADVANCED: 'متقدم' }

function trialDaysLeft(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [email,    setEmail]    = useState('')
  const [secret,   setSecret]   = useState('')
  const [authed,   setAuthed]   = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [tenants,  setTenants]  = useState<Tenant[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [sweepMsg, setSweepMsg] = useState('')

  const [filterCountry, setFilterCountry] = useState('MA')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterTier,    setFilterTier]    = useState('')
  const [sortBal,       setSortBal]       = useState<'asc' | 'desc'>('asc')

  const [modal,    setModal]    = useState<ModalState | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mrrData,  setMrrData]  = useState<MrrData | null>(null)
  const [mrrOpen,  setMrrOpen]  = useState(false)

  const [revenueHistory, setRevenueHistory] = useState<{ month: string; value: number }[]>([])

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('superadmin-theme') as Theme) ?? 'A'
    }
    return 'A'
  })

  function handleSetTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('superadmin-theme', t)
  }

  // Password reset requests
  const [pwResets,       setPwResets]       = useState<any[]>([])
  const [pwResetsOpen,   setPwResetsOpen]   = useState(false)
  const [pwResetLoading, setPwResetLoading] = useState(false)
  const [approvingReset, setApprovingReset] = useState<string | null>(null)

  async function loadPwResets() {
    setPwResetLoading(true)
    try {
      const res = await fetch('/api/superadmin/password-reset-requests', { headers: superHeader() })
      if (res.ok) setPwResets(await res.json())
    } finally { setPwResetLoading(false) }
  }

  async function approveReset(id: string) {
    setApprovingReset(id)
    try {
      const res  = await fetch(`/api/superadmin/password-reset-requests/${id}/approve`, { method: 'POST', headers: superHeader() })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Error'); return }
      alert('✅ Mot de passe temporaire envoyé par email!')
      loadPwResets()
    } finally { setApprovingReset(null) }
  }

  async function rejectReset(id: string) {
    if (!confirm('Rejeter cette demande?')) return
    await fetch(`/api/superadmin/password-reset-requests/${id}/reject`, { method: 'POST', headers: superHeader() })
    loadPwResets()
  }

  // Demo requests
  const [demoRequests,   setDemoRequests]   = useState<any[]>([])
  const [demoLoading,    setDemoLoading]    = useState(false)
  const [demoTab,        setDemoTab]        = useState<'pending'|'activated'|'rejected'>('pending')
  const [activatingDemo, setActivatingDemo] = useState<string | null>(null)

  // Quick delete by email
  const [deleteEmail,    setDeleteEmail]    = useState('')
  const [delByEmail,     setDelByEmail]     = useState(false)

  // Bulk select
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [bulkDeleting,   setBulkDeleting]   = useState(false)

  // Purge test data
  const [showPurge,    setShowPurge]    = useState(false)
  const [purgeKeep,    setPurgeKeep]    = useState('plage, qa')
  const [purging,      setPurging]      = useState(false)
  const [purgeResult,  setPurgeResult]  = useState<{ deleted: string[]; failed: string[] } | null>(null)

  // Premium plans
  const [premiumPlans,   setPremiumPlans]   = useState<any[]>([])
  const [editingPlan,    setEditingPlan]    = useState<any | null>(null)

  const secretRef = useRef(secret)
  useEffect(() => { secretRef.current = secret }, [secret])

  const emailRef = useRef(email)
  useEffect(() => { emailRef.current = email }, [email])

  const superHeader = useCallback(() => ({
    'x-superadmin-secret': secretRef.current,
    'x-superadmin-email':  emailRef.current,
    'Content-Type':        'application/json'
  }), [])

  const loadAll = useCallback(async (p = 1, append = false) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: '20',
      ...(filterCountry ? { country: filterCountry } : {}),
      ...(filterStatus  ? { status:  filterStatus  } : {}),
      ...(filterTier    ? { tier:    filterTier    } : {})
    })
    try {
      const [ovRes, tenRes] = await Promise.all([
        fetch('/api/superadmin/billing/overview', { headers: superHeader() }),
        fetch(`/api/superadmin/tenants/rich?${params}`, { headers: superHeader() })
      ])
      if (ovRes.ok)  {
        setOverview(await ovRes.json())
        // Fetch MRR breakdown in background
        fetch('/api/superadmin/mrr-breakdown', { headers: superHeader() })
          .then(r => r.ok ? r.json() : null).then(d => d && setMrrData(d))
        fetch('/api/superadmin/revenue-history', { headers: superHeader() })
          .then(r => r.ok ? r.json() : null).then(d => d && setRevenueHistory(d))
      }
      if (tenRes.ok) {
        const d = await tenRes.json()
        setTotal(d.total ?? 0)
        setTenants(prev => append ? [...prev, ...d.cafes] : d.cafes)
      }
      const r3 = await fetch('/api/superadmin/premium-plans', { headers: superHeader() })
      if (r3.ok) {
        const d3 = await r3.json()
        setPremiumPlans(d3.plans ?? [])
      }
    } finally { setLoading(false) }
  }, [superHeader, filterCountry, filterStatus, filterTier])

  const [loginErr,     setLoginErr]     = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  async function login() {
    if (!email.trim() || !secret.trim()) { setLoginErr('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return }
    setLoginErr(''); setLoginLoading(true)
    try {
      const res = await fetch('/api/superadmin/billing/overview', {
        headers: { 'x-superadmin-secret': secret, 'x-superadmin-email': email }
      })
      if (!res.ok) { setLoginErr('بيانات الدخول غير صحيحة'); return }
      setAuthed(true)
    } catch { setLoginErr('خطأ في الشبكة') }
    finally   { setLoginLoading(false) }
  }
  useEffect(() => { if (authed) loadAll(1) }, [authed, loadAll])

  async function runSweep() {
    setSweeping(true); setSweepMsg('')
    try {
      const res  = await fetch('/api/superadmin/billing/run-sweep', { method: 'POST', headers: superHeader() })
      const data = await res.json()
      setSweepMsg(`تم تحليل ${data.processed} مقهى`)
      loadAll(1)
    } catch { setSweepMsg('فشل التحليل') }
    finally   { setSweeping(false) }
  }

  async function suspend(id: string) {
    setActionId(id)
    await fetch(`/api/superadmin/tenants/${id}/suspend`, { method: 'POST', headers: superHeader() })
    setActionId(null); loadAll(1)
  }

  async function reactivate(id: string) {
    setActionId(id)
    await fetch(`/api/superadmin/tenants/${id}/reactivate`, {
      method: 'POST', headers: superHeader(), body: JSON.stringify({ clearDebt: false })
    })
    setActionId(null); loadAll(1)
  }

  async function deleteTenant(id: string) {
    setDeleting(true)
    try {
      await fetch(`/api/superadmin/tenants/${id}`, { method: 'DELETE', headers: superHeader() })
      setDeleteConfirm(null)
      loadAll(1)
    } finally { setDeleting(false) }
  }

  async function approveInventory(id: string) {
    setActionId(id)
    await fetch(`/api/superadmin/tenants/${id}/approve-inventory`, {
      method: 'POST', headers: superHeader()
    })
    setActionId(null)
    loadAll(page)
  }

  function openModal(tenant: Tenant, tab: ModalTab = 'billing') {
    setModal({ tenant, tab, loading: false, error: '',
      coffee:         String(tenant.coffeeRefPrice   ?? ''),
      sandwich:       String(tenant.sandwichRefPrice ?? ''),
      days:           '7',
      fee:            String(tenant.monthlyFee ?? ''),
      tier:           tenant.subscriptionTier ?? 'ECONOMY',
      billingCycle:   tenant.billingCycle ?? 15,
      maintenance:    tenant.maintenancePack ?? defaultMaintenance(tenant.country),
      maintenanceFee: String(tenant.maintenanceFee ?? 25),
      preview:        null
    })
  }

  function setMF<K extends keyof ModalState>(k: K, v: ModalState[K]) {
    setModal(m => m ? { ...m, [k]: v } : m)
  }

  async function previewBilling() {
    if (!modal) return
    setMF('loading', true)
    try {
      const res  = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/billing/compute`, {
        method: 'POST', headers: superHeader()
      })
      const data = await res.json()
      setMF('preview', { tier: data.tier, monthlyFee: data.monthlyFee, weeklyOrderCount: data.weeklyOrderCount })
    } finally { setMF('loading', false) }
  }

  async function savePrices() {
    if (!modal) return
    setMF('loading', true); setMF('error', '')
    try {
      const r1 = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/ref-prices`, {
        method: 'PATCH', headers: superHeader(),
        body: JSON.stringify({ coffeeRefPrice: Number(modal.coffee), sandwichRefPrice: Number(modal.sandwich) })
      })
      if (!r1.ok) { setMF('error', 'فشل حفظ الأسعار'); return }
      await fetch(`/api/superadmin/tenants/${modal.tenant.id}/billing/apply`, {
        method: 'POST', headers: superHeader()
      })
      setModal(null); loadAll(1)
    } finally { setMF('loading', false) }
  }

  async function extendTrial() {
    if (!modal) return
    setMF('loading', true); setMF('error', '')
    try {
      const res  = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/extend-trial`, {
        method: 'PATCH', headers: superHeader(), body: JSON.stringify({ days: Number(modal.days) })
      })
      const data = await res.json()
      if (!res.ok) { setMF('error', data.error ?? 'فشل'); return }
      setModal(null); loadAll(1)
    } finally { setMF('loading', false) }
  }

  async function manualActivate() {
    if (!modal) return
    setMF('loading', true); setMF('error', '')
    try {
      const res = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/activate`, {
        method: 'POST', headers: superHeader(),
        body: JSON.stringify({ monthlyFee: 0, tier: modal.tier })
      })
      if (!res.ok) { setMF('error', 'فشل التفعيل'); return }
      setModal(null); loadAll(1)
    } finally { setMF('loading', false) }
  }

  async function saveBillingConfig() {
    if (!modal) return
    setMF('loading', true); setMF('error', '')
    try {
      const res = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/billing-config`, {
        method: 'PATCH', headers: superHeader(),
        body: JSON.stringify({
          billingCycle:   modal.billingCycle,
          maintenancePack: modal.maintenance,
          maintenanceFee:  modal.maintenance ? Number(modal.maintenanceFee) : null,
          coffeeRefPrice:  modal.coffee ? Number(modal.coffee) : null,
          sandwichRefPrice: modal.sandwich ? Number(modal.sandwich) : null,
        })
      })
      if (!res.ok) { setMF('error', 'فشل الحفظ'); return }
      setModal(null); loadAll(1)
    } finally { setMF('loading', false) }
  }

  // ─── Quick delete by email ────────────────────────────────────────────────

  async function deleteByEmail() {
    const em = deleteEmail.trim().toLowerCase()
    if (!em) return
    if (!confirm(`⚠️ حذف كامل لحساب:\n${em}\n\nسيُحذف المستخدم + المقهى + كل البيانات. هل أنت متأكد؟`)) return
    setDelByEmail(true)
    try {
      const res = await fetch(`/api/superadmin/users/by-email?email=${encodeURIComponent(em)}`, {
        method: 'DELETE', headers: superHeader()
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'فشل الحذف'); return }
      alert(`✅ تم الحذف\nالإيميل: ${em}\nالمقهى: ${data.cafeId ?? 'لا يوجد'}`)
      setDeleteEmail('')
      loadAll(1)
    } finally { setDelByEmail(false) }
  }

  // ─── Bulk select helpers ──────────────────────────────────────────────────

  function toggleSelect(id: string, isDemo: boolean) {
    if (isDemo) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    const eligible = tenants.filter(t => !t.isDemo).map(t => t.id)
    setSelectedIds(new Set(eligible))
  }

  function clearSelection() { setSelectedIds(new Set()) }

  async function bulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`⚠️ سيتم حذف ${selectedIds.size} حساب نهائياً.\nالحسابات المحمية (Demo) ستُتخطى تلقائياً.\n\nهل أنت متأكد؟`)) return
    setBulkDeleting(true)
    try {
      const res  = await fetch('/api/superadmin/tenants/bulk-delete', {
        method:  'POST',
        headers: superHeader(),
        body:    JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'فشل الحذف'); return }
      alert(`✅ تم الحذف\n• محذوف: ${data.deleted?.length ?? 0}\n• محمي (Demo): ${data.skipped?.length ?? 0}\n• فشل: ${data.failed?.length ?? 0}`)
      setSelectedIds(new Set())
      loadAll(1)
    } finally { setBulkDeleting(false) }
  }

  async function toggleDemoFlag(id: string, current: boolean) {
    await fetch(`/api/superadmin/tenants/${id}/set-demo`, {
      method:  'PATCH',
      headers: superHeader(),
      body:    JSON.stringify({ isDemo: !current }),
    })
    setTenants(prev => prev.map(t => t.id === id ? { ...t, isDemo: !current } : t))
  }

  // ─── Demo requests ────────────────────────────────────────────────────────

  async function loadDemoRequests(status: string) {
    setDemoLoading(true)
    try {
      const res = await fetch(`/api/superadmin/demo-requests?status=${status}`, { headers: superHeader() })
      if (res.ok) setDemoRequests(await res.json())
    } finally { setDemoLoading(false) }
  }

  async function activateDemo(id: string) {
    setActivatingDemo(id)
    try {
      const res = await fetch(`/api/superadmin/demo-requests/${id}/activate`, {
        method: 'POST', headers: superHeader()
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'فشل التفعيل'); return }
      alert(`✅ تم التفعيل! subdomain: ${data.subdomain}`)
      loadDemoRequests(demoTab)
    } finally { setActivatingDemo(null) }
  }

  async function rejectDemo(id: string) {
    if (!confirm('هل تريد رفض هذا الطلب؟')) return
    await fetch(`/api/superadmin/demo-requests/${id}/reject`, {
      method: 'PATCH', headers: superHeader()
    })
    loadDemoRequests(demoTab)
  }

  // ─── Premium Plans ────────────────────────────────────────────────────────

  async function runPurge() {
    const keep = purgeKeep.split(',').map(s => s.trim()).filter(Boolean)
    setPurging(true); setPurgeResult(null)
    try {
      const res  = await fetch('/api/superadmin/tenants/purge-test', {
        method: 'POST', headers: superHeader(), body: JSON.stringify({ keep }),
      })
      const data = await res.json()
      setPurgeResult({ deleted: data.deleted ?? [], failed: data.failed ?? [] })
      loadAll(1)
    } catch { setPurgeResult({ deleted: [], failed: ['network error'] }) }
    finally { setPurging(false) }
  }

  async function savePlan(country: string, patch: Record<string, any>) {
    await fetch(`/api/superadmin/premium-plans/${country}`, {
      method:  'PUT',
      headers: superHeader(),
      body:    JSON.stringify(patch),
    })
    const r = await fetch('/api/superadmin/premium-plans', { headers: superHeader() })
    const d = await r.json()
    setPremiumPlans(d.plans ?? [])
    setEditingPlan(null)
  }

  // ─── Login screen ─────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4" dir="rtl">
        <div className="bg-gray-900 rounded-3xl p-8 w-full max-w-sm border border-gray-800 shadow-2xl">
          <div className="flex flex-col items-center mb-8 gap-3">
            <Image src="/assets/logo.png" alt="Smart Menu" width={52} height={52} className="rounded-2xl" />
            <div className="text-center">
              <h1 className="text-white font-extrabold text-xl">Super Admin</h1>
              <p className="text-gray-500 text-xs">Smart Resto · Control Room</p>
            </div>
          </div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="البريد الإلكتروني"
            dir="ltr"
            className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-emerald-500 mb-3 text-sm"
          />
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="كلمة المرور"
            className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-emerald-500 mb-4 text-center tracking-[0.3em] text-base"
          />
          {loginErr && (
            <p className="text-red-400 text-xs text-center mb-3">{loginErr}</p>
          )}
          <button onClick={login} disabled={loginLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-3.5 rounded-2xl font-extrabold transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'دخول →'}
          </button>
        </div>
      </div>
    )
  }

  // ─── Main dashboard ───────────────────────────────────────────────────────────

  const themeProps = {
    overview, tenants, total, mrrData, demoRequests, demoTab, revenueHistory,
    loading, sweeping, sweepMsg, page, filterCountry, filterStatus, filterTier,
    sortBal, actionId, selectedIds, bulkDeleting, deleteEmail, delByEmail,
    demoLoading, activatingDemo, mrrOpen, theme,
    onOpenPurge:        () => { setShowPurge(true); setPurgeResult(null) },
    onLoadAll:          loadAll,
    onRunSweep:         runSweep,
    onSuspend:          suspend,
    onReactivate:       reactivate,
    onOpenModal:        openModal,
    onDeleteConfirm:    setDeleteConfirm,
    onToggleSelect:     toggleSelect,
    onSelectAll:        selectAll,
    onClearSelection:   clearSelection,
    onBulkDelete:       bulkDelete,
    onToggleDemoFlag:   toggleDemoFlag,
    onApproveInventory: approveInventory,
    onDeleteByEmail:    deleteByEmail,
    onSetDeleteEmail:   setDeleteEmail,
    onLoadDemoRequests: loadDemoRequests,
    onActivateDemo:     activateDemo,
    onRejectDemo:       rejectDemo,
    onSetDemoTab:       setDemoTab,
    onSetFilterCountry: setFilterCountry,
    onSetFilterStatus:  setFilterStatus,
    onSetFilterTier:    setFilterTier,
    onSetSortBal:       setSortBal,
    onSetMrrOpen:       setMrrOpen,
    onSetTheme:         handleSetTheme,
    onLoadMore:         () => { const n = page + 1; setPage(n); loadAll(n, true) },
    premiumPlans,
    editingPlan,
    onSavePlan:         savePlan,
    onSetEditingPlan:   setEditingPlan,
  }

  return (
    <>
      {theme === 'A' && <ThemeA {...themeProps} />}
      {theme === 'B' && <ThemeB {...themeProps} />}
      {theme === 'C' && <ThemeC {...themeProps} />}

      {/* ── Password Reset Requests floating button + panel ── */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
        <button
          onClick={() => { setPwResetsOpen(o => !o); if (!pwResetsOpen) loadPwResets() }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-full shadow-xl text-sm font-semibold transition-all"
        >
          🔑 Réinitialisations
          {pwResets.filter(r => r.status === 'PENDING').length > 0 && (
            <span className="bg-white text-red-600 rounded-full text-xs font-bold w-5 h-5 flex items-center justify-center">
              {pwResets.filter(r => r.status === 'PENDING').length}
            </span>
          )}
        </button>

        {pwResetsOpen && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-white text-sm">🔑 Demandes de mot de passe</p>
              <button onClick={() => setPwResetsOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {pwResetLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : pwResets.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-3">Aucune demande en attente</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pwResets.map(r => (
                  <div key={r.id} className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{r.cafeName || '—'}</p>
                        <p className="text-gray-400 text-xs truncate">{r.email}</p>
                        <p className="text-gray-500 text-[10px]">{new Date(r.createdAt).toLocaleString('fr-FR')}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        r.status === 'PENDING' ? 'bg-amber-900 text-amber-300' :
                        r.status === 'SENT'    ? 'bg-blue-900 text-blue-300'  :
                        'bg-gray-700 text-gray-400'
                      }`}>{r.status}</span>
                    </div>
                    {['PENDING','SENT'].includes(r.status) && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveReset(r.id)}
                          disabled={approvingReset === r.id}
                          className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold py-1.5 rounded-lg transition-all disabled:opacity-50"
                        >
                          {approvingReset === r.id ? '…' : '✉️ Envoyer'}
                        </button>
                        <button
                          onClick={() => rejectReset(r.id)}
                          className="flex-1 bg-gray-700 hover:bg-red-800 text-gray-300 text-xs font-semibold py-1.5 rounded-lg transition-all"
                        >
                          Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <TenantModalInline
          modal={modal}
          setModal={setModal}
          setMF={setMF}
          saveBillingConfig={saveBillingConfig}
          extendTrial={extendTrial}
          manualActivate={manualActivate}
          superHeader={superHeader}
          loadAll={loadAll}
        />
      )}

      {showPurge && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-orange-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-900/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-extrabold text-base">Purge Test Data</h3>
                <p className="text-gray-400 text-xs mt-0.5">Deletes all cafes except protected subdomains</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 text-xs font-semibold">Protected subdomains (comma-separated)</label>
              <input
                value={purgeKeep}
                onChange={e => setPurgeKeep(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm font-mono"
                placeholder="plage, qa"
              />
              <p className="text-gray-600 text-xs">isDemo=true cafes are always kept regardless.</p>
            </div>
            {purgeResult && (
              <div className={`rounded-xl px-4 py-3 text-sm ${purgeResult.failed.length ? 'bg-red-950/40 border border-red-800' : 'bg-emerald-950/40 border border-emerald-800'}`}>
                {purgeResult.failed.length > 0
                  ? <p className="text-red-300">Failed: {purgeResult.failed.join(', ')}</p>
                  : <p className="text-emerald-300">Deleted {purgeResult.deleted.length} cafe(s): {purgeResult.deleted.join(', ') || 'none'}</p>
                }
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowPurge(false); setPurgeResult(null) }} disabled={purging}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm font-semibold">
                Cancel
              </button>
              <button onClick={runPurge} disabled={purging}
                className="flex-1 px-4 py-2.5 rounded-xl bg-orange-700 hover:bg-orange-600 text-white text-sm font-bold flex items-center justify-center gap-2">
                {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {purging ? 'Purging…' : 'Purge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-extrabold text-base">حذف نهائي</h3>
                <p className="text-gray-400 text-xs mt-0.5">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
              <p className="text-red-300 font-bold text-sm">{deleteConfirm.businessName || deleteConfirm.name}</p>
              <p className="text-red-500 text-xs mt-1">سيتم حذف كل الطلبات، المنيو، الطاولات، الموظفين، والسجلات.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm font-semibold">
                إلغاء
              </button>
              <button onClick={() => deleteTenant(deleteConfirm.id)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TenantModalInline({ modal, setModal, setMF, saveBillingConfig, extendTrial, manualActivate, superHeader, loadAll }: {
  modal: ModalState
  setModal: (m: ModalState | null) => void
  setMF: <K extends keyof ModalState>(k: K, v: ModalState[K]) => void
  saveBillingConfig: () => void
  extendTrial: () => void
  manualActivate: () => void
  superHeader: () => Record<string, string>
  loadAll: (p?: number) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-extrabold text-lg">{modal.tenant.businessName || modal.tenant.name}</h2>
            <p className="text-gray-400 text-xs">{modal.tenant.subdomain} · {modal.tenant.country} · {modal.tenant.currency}</p>
          </div>
          <button onClick={() => setModal(null)}
            className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
          {([
            { key: 'billing'  as ModalTab, icon: <BarChart3 className="w-3.5 h-3.5" />,    label: 'إعداد الفوترة' },
            { key: 'trial'    as ModalTab, icon: <CalendarPlus className="w-3.5 h-3.5" />, label: 'تمديد التجربة' },
            { key: 'activate' as ModalTab, icon: <Zap className="w-3.5 h-3.5" />,          label: 'تفعيل يدوي'   }
          ]).map(tab => (
            <button key={tab.key} onClick={() => setMF('tab', tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors ${
                modal.tab === tab.key
                  ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-950/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {modal.error && (
            <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-2 text-red-300 text-sm">{modal.error}</div>
          )}

          {/* ── Billing config tab ── */}
          {modal.tab === 'billing' && <>

            {/* Free subscription banner */}
            <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-800 rounded-2xl px-4 py-3">
              <span className="text-2xl">🆓</span>
              <div>
                <p className="text-emerald-300 font-bold text-sm">Abonnement GRATUIT</p>
                <p className="text-emerald-600 text-xs">Revenue = commission par commande uniquement</p>
              </div>
            </div>

            {/* Commission tiers summary */}
            <div className="bg-gray-800/50 rounded-2xl p-3 space-y-1.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Commission / commande ({modal.tenant.country})</p>
              {modal.tenant.country === 'MA' && [
                ['< 20 MAD','0.50 MAD'], ['20–50','3 MAD'], ['50–80','5 MAD'],
                ['80–100','7 MAD'], ['100–150','10 MAD'], ['> 150','15 MAD']
              ].map(([r,f]) => (
                <div key={r} className="flex justify-between text-xs"><span className="text-gray-500">{r}</span><span className="text-white font-bold">{f}</span></div>
              ))}
              {['SA','AE'].includes(modal.tenant.country) && [
                ['< 15','1'], ['15–40','3'], ['40–70','6'], ['70–120','10'], ['120–200','15'], ['> 200','22']
              ].map(([r,f]) => (
                <div key={r} className="flex justify-between text-xs"><span className="text-gray-500">{r} {modal.tenant.currency}</span><span className="text-white font-bold">{f} {modal.tenant.currency}</span></div>
              ))}
              {['FR','ES','BE','DE','IT','NL','PT','GB','US'].includes(modal.tenant.country) && [
                ['< 5€','€0.10'], ['5–12€','€0.25'], ['12–25€','€0.50'], ['25–50€','€0.80'], ['50–100€','€1.20'], ['> 100€','€2.00']
              ].map(([r,f]) => (
                <div key={r} className="flex justify-between text-xs"><span className="text-gray-500">{r}</span><span className="text-white font-bold">{f}</span></div>
              ))}
              {!['MA','SA','AE','FR','ES','BE','DE','IT','NL','PT','GB','US'].includes(modal.tenant.country) && (
                <p className="text-gray-500 text-xs">Voir billing.ts pour ce pays</p>
              )}
            </div>

            {/* Maintenance pack */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-white">Pack Maintenance ($25)</p>
                  <p className="text-xs text-gray-500">Service & Maintenance — Golfe / Europe</p>
                </div>
                <button onClick={() => setMF('maintenance', !modal.maintenance)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${modal.maintenance ? 'bg-emerald-600' : 'bg-gray-600'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${modal.maintenance ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {modal.maintenance && (
                <FInput label="Montant maintenance (USD)" value={modal.maintenanceFee}
                  onChange={v => setMF('maintenanceFee', v)} placeholder="25" type="number" />
              )}
            </div>

            {/* Billing cycle */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Cycle de paiement</p>
              <div className="grid grid-cols-3 gap-2">
                {[8, 15, 26].map(d => (
                  <button key={d} onClick={() => setMF('billingCycle', d)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      modal.billingCycle === d
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}>
                    {d} jours
                  </button>
                ))}
              </div>
            </div>

            {/* Estimation — 10 cafés/j + 10 sandwichs/j × cycle */}
            {(() => {
              const coffeeP   = Number(modal.coffee   || modal.tenant.coffeeRefPrice   || 15)
              const sandwichP = Number(modal.sandwich || modal.tenant.sandwichRefPrice || 35)
              const est = estimateCycle(
                coffeeP, sandwichP,
                modal.tenant.country,
                modal.billingCycle,
                modal.maintenance,
                Number(modal.maintenanceFee || 25)
              )
              const coffeeComm   = getCommission(coffeeP,   modal.tenant.country)
              const sandwichComm = getCommission(sandwichP, modal.tenant.country)
              return (
                <div className="bg-sky-950/30 border border-sky-800 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                    Estimation / {modal.billingCycle} jours
                  </p>

                  {/* Base: 10 coffees + 10 sandwiches per day */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">
                        ☕ 10 cafés/j × {modal.billingCycle}j × {coffeeComm} {modal.tenant.currency}
                      </span>
                      <span className="text-white font-bold">
                        {(10 * modal.billingCycle * coffeeComm).toFixed(2)} {modal.tenant.currency}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">
                        🥪 10 sandwichs/j × {modal.billingCycle}j × {sandwichComm} {modal.tenant.currency}
                      </span>
                      <span className="text-white font-bold">
                        {(10 * modal.billingCycle * sandwichComm).toFixed(2)} {modal.tenant.currency}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-sky-800/60 pt-1.5">
                      <span className="text-gray-400 font-semibold">Commission totale</span>
                      <span className="text-sky-300 font-bold">{est.commission.toFixed(2)} {modal.tenant.currency}</span>
                    </div>
                    {modal.maintenance && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-semibold">Pack Maintenance</span>
                        <span className="text-amber-400 font-bold">+ ${est.maintenanceAmt}</span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                    <span className="text-sm font-bold text-white">TOTAL / {modal.billingCycle}j</span>
                    <div className="text-end">
                      <span className="text-2xl font-extrabold text-amber-400">{est.total.toFixed(2)}</span>
                      {' '}<span className="text-amber-300 text-sm">{modal.tenant.currency}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-600">
                    Basé sur 10 cafés + 10 sandwichs par jour · prix ref: {coffeeP} / {sandwichP} {modal.tenant.currency}
                  </p>
                </div>
              )
            })()}

            {/* Ref prices (for estimation only) */}
            <details className="group">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 list-none flex items-center gap-1">
                <Coffee className="w-3 h-3" /> Prix de référence (estimation) ▸
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <FInput label="☕ Prix café" value={modal.coffee} onChange={v => setMF('coffee', v)} placeholder="0.00" type="number" />
                <FInput label="🥪 Prix sandwich" value={modal.sandwich} onChange={v => setMF('sandwich', v)} placeholder="0.00" type="number" />
              </div>
            </details>

            <button onClick={saveBillingConfig} disabled={modal.loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors active:scale-95"
            >
              {modal.loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '💾 Enregistrer la configuration'}
            </button>
          </>}

          {/* Trial tab */}
          {modal.tab === 'trial' && <>
            <p className="text-gray-400 text-xs leading-relaxed">
              تمديد الفترة التجريبية يُعيد ضبط حالة الاشتراك ويمنح المقهى مهلة إضافية لإتمام الدفع.
              <br />
              انتهاء التجربة الحالي:{' '}
              <span className="text-white">{modal.tenant.trialEndsAt ? new Date(modal.tenant.trialEndsAt).toLocaleDateString('ar') : '—'}</span>
              {modal.tenant.hasExtendedTrial && ' (ممدد مسبقاً)'}
            </p>
            <FInput label="عدد الأيام الإضافية"
              value={modal.days} onChange={v => setMF('days', v)} placeholder="7" type="number" />
            <div className="bg-amber-950/30 border border-amber-800 rounded-xl p-3 text-xs text-amber-300">
              التاريخ الجديد المتوقع:{' '}
              <strong>{new Date(Date.now() + Number(modal.days || 0) * 86_400_000).toLocaleDateString('ar')}</strong>
            </div>
            <button onClick={extendTrial} disabled={modal.loading || !modal.days}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors active:scale-95"
            >
              {modal.loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `📅 تمديد ${modal.days} يوم`}
            </button>
          </>}

          {/* Activate tab */}
          {modal.tab === 'activate' && <>
            <p className="text-gray-400 text-xs leading-relaxed">
              تفعيل يدوي يتجاوز التحليل التلقائي ويُحوّل المقهى مباشرة إلى حالة "نشط – COLLECTING_DEBT".
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">الشريحة</p>
                <select value={modal.tier} onChange={e => setMF('tier', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                >
                  <option value="ECONOMY">اقتصادي ({"< 50 طلبية"})</option>
                  <option value="ADVANCED">متقدم ({"≥ 50 طلبية"})</option>
                </select>
              </div>
              <FInput label={`الاشتراك الشهري (${modal.tenant.currency})`}
                value={modal.fee} onChange={v => setMF('fee', v)} placeholder="0.00" type="number" />
            </div>
            <button onClick={manualActivate} disabled={modal.loading || !modal.fee}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors active:scale-95"
            >
              {modal.loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '⚡ تفعيل الحساب'}
            </button>
          </>}
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
      >
        {children}
      </select>
    </div>
  )
}

function FInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: React.ReactNode; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
      />
    </div>
  )
}

function RowBtn({ icon, label, color, loading, onClick }: {
  icon: React.ReactNode; label: string; color: 'red' | 'green' | 'blue' | 'amber'
  loading: boolean; onClick: () => void
}) {
  const cls = {
    red:   'bg-red-900/50 hover:bg-red-800 text-red-300',
    green: 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300',
    blue:  'bg-blue-900/50 hover:bg-blue-800 text-blue-300',
    amber: 'bg-amber-900/50 hover:bg-amber-800 text-amber-300 border border-amber-700/50 animate-pulse'
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1 ${cls[color]} px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon} {label}
    </button>
  )
}
