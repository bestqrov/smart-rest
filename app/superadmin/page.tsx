'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Shield, RefreshCw, Loader2, Filter,
  TrendingUp, Users, AlertTriangle, CheckCircle,
  Wallet, Globe, Ban, Edit3, Trash2,
  ChevronDown, ChevronUp, X, Play, CalendarPlus,
  Coffee, Zap, BarChart3, Sandwich, Package
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  totalCafes:       number
  activeCafes:      number
  suspendedCafes:   number
  trialCafes:       number
  economyCafes:     number
  advancedCafes:    number
  totalAccruedDebt: number
  totalRevenue:     number
  mrr:              number
}

interface Tenant {
  id:               string
  name:             string
  businessName:     string
  subdomain:        string
  country:          string
  currency:         string
  isActive:         boolean
  walletBalance:    number
  billingStatus:    string
  trialEndsAt:      string | null
  hasExtendedTrial: boolean
  subscriptionTier: string | null
  monthlyFee:       number | null
  coffeeRefPrice:   number | null
  sandwichRefPrice: number | null
  weeklyOrderCount: number | null
  billingCycle:     number | null
  maintenancePack:  boolean
  maintenanceFee:   number | null
  nextBillingDate:  string | null
  isSmartInventoryEnabled:        boolean
  inventoryActivationRequested:   boolean
  inventoryActivationRequestedAt: string | null
  _count:           { orders: number }
  isDemo:           boolean
}

// Countries that get the $25 maintenance pack by default
const MAINTENANCE_COUNTRIES = ['SA','AE','KW','QA','BH','OM','FR','ES','BE','DE','IT','NL','PT','GB','US']

function defaultMaintenance(country: string) {
  return MAINTENANCE_COUNTRIES.includes(country.toUpperCase())
}

type ModalTab = 'billing' | 'trial' | 'activate'

interface ModalState {
  tenant:          Tenant
  tab:             ModalTab
  loading:         boolean
  error:           string
  coffee:          string
  sandwich:        string
  days:            string
  fee:             string
  tier:            string
  billingCycle:    number
  maintenance:     boolean
  maintenanceFee:  string
  preview:  { tier: string; monthlyFee: number; weeklyOrderCount: number } | null
}

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

  const [filterCountry, setFilterCountry] = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterTier,    setFilterTier]    = useState('')
  const [sortBal,       setSortBal]       = useState<'asc' | 'desc'>('asc')

  const [modal,    setModal]    = useState<ModalState | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mrrData,  setMrrData]  = useState<{ totalMRR_USD: number; computedAt: string; byCountry: any[] } | null>(null)
  const [mrrOpen,  setMrrOpen]  = useState(false)

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
      }
      if (tenRes.ok) {
        const d = await tenRes.json()
        setTotal(d.total ?? 0)
        setTenants(prev => append ? [...prev, ...d.cafes] : d.cafes)
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

  // ─── Main dashboard ───────────────────────────────────────────────────────

  const hasMore = tenants.length < total

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Image src="/assets/logo.png" alt="Smart Menu" width={36} height={36} className="rounded-xl" />
            <div>
              <h1 className="text-white font-extrabold text-xl leading-none">Super Admin</h1>
              <p className="text-gray-500 text-xs">Smart Resto · لوحة التحكم العليا</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {sweepMsg && <span className="text-emerald-400 text-xs bg-emerald-950/50 border border-emerald-700 px-3 py-1 rounded-full">{sweepMsg}</span>}
            <a href="/superadmin/landing"
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              <Globe className="w-4 h-4" /> Landing Page
            </a>
            <button onClick={runSweep} disabled={sweeping}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              {sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              تحليل الاشتراكات
            </button>
            <button onClick={() => loadAll(1)} disabled={loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Quick Delete by Email ──────────────────────────────────────────── */}
        <div className="bg-red-950/20 border border-red-900/40 rounded-2xl px-5 py-4">
          <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3">🗑️ حذف حساب تجريبي بالإيميل</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={deleteEmail}
              onChange={e => setDeleteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && deleteByEmail()}
              placeholder="you@gmail.com"
              dir="ltr"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
            />
            <button
              onClick={deleteByEmail}
              disabled={delByEmail || !deleteEmail.trim()}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap"
            >
              {delByEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              حذف الكامل
            </button>
          </div>
          <p className="text-gray-700 text-xs mt-2">يحذف: User + Cafe + كل البيانات + tokens المعلقة</p>
        </div>

        {/* ── Demo Requests Panel ────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-emerald-400" />
              <h2 className="text-white font-bold">طلبات التجربة المجانية</h2>
              {demoRequests.filter(d => d.status === 'pending').length > 0 && (
                <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {demoRequests.filter(d => d.status === 'pending').length}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {(['pending','activated','rejected'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setDemoTab(t); loadDemoRequests(t) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    demoTab === t
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {{ pending: 'معلق', activated: 'مُفعّل', rejected: 'مرفوض' }[t]}
                </button>
              ))}
              <button
                onClick={() => loadDemoRequests(demoTab)}
                className="p-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${demoLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {demoRequests.length === 0 ? (
            <div className="py-10 text-center text-gray-600 text-sm">
              {demoLoading ? 'جاري التحميل...' : 'لا توجد طلبات'}
              {!demoLoading && demoTab === 'pending' && (
                <button onClick={() => loadDemoRequests('pending')} className="block mx-auto mt-2 text-emerald-500 text-xs underline">
                  تحديث
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {demoRequests.map(d => (
                <div key={d.id} className="flex items-start justify-between px-5 py-4 hover:bg-gray-800/40 transition-colors flex-wrap gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{d.businessName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        {{ RESTAURANT:'🍽️ مطعم', CAFE:'☕ مقهى', TRAITEUR:'🎂 طراتور', PASTRY:'🧁 حلويات', FOOD_TRUCK:'🚚 فود تراك', HOTEL:'🏨 فندق' }[d.businessType] ?? d.businessType}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs">{d.ownerName} · {d.city} · {d.country}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{d.phone}</span>
                      <span>{d.email}</span>
                    </div>
                    {d.notes && <p className="text-zinc-600 text-xs italic">{d.notes}</p>}
                    <p className="text-gray-700 text-xs">{new Date(d.createdAt).toLocaleString('ar-MA')}</p>
                  </div>
                  {d.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => activateDemo(d.id)}
                        disabled={activatingDemo === d.id}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                      >
                        {activatingDemo === d.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <CheckCircle className="w-3.5 h-3.5" />}
                        تفعيل 7 أيام
                      </button>
                      <button
                        onClick={() => rejectDemo(d.id)}
                        className="flex items-center gap-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> رفض
                      </button>
                    </div>
                  )}
                  {d.status === 'activated' && (
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> مُفعّل
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KPI cards */}
        {overview && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { icon: Users,         label: 'إجمالي المقاهي', val: overview.totalCafes,     color: 'text-blue-400',    bg: 'border-blue-800/50'    },
                { icon: CheckCircle,   label: 'نشطة',            val: overview.activeCafes,    color: 'text-emerald-400', bg: 'border-emerald-800/50' },
                { icon: AlertTriangle, label: 'موقوفة',           val: overview.suspendedCafes, color: 'text-red-400',     bg: 'border-red-800/50'     },
                { icon: Globe,         label: 'تجريبية',          val: overview.trialCafes,     color: 'text-amber-400',   bg: 'border-amber-800/50'   },
              ].map((k, i) => (
                <div key={i} className={`bg-gray-900 rounded-2xl p-4 border ${k.bg}`}>
                  <k.icon className={`w-4 h-4 mb-2 ${k.color}`} />
                  <div className="text-xs text-gray-500 mb-0.5">{k.label}</div>
                  <div className={`text-2xl font-extrabold ${k.color}`}>{k.val}</div>
                </div>
              ))}

              {/* MRR Card — USD + breakdown button */}
              <div className="bg-violet-950/40 border border-violet-800/50 rounded-2xl p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  <button onClick={() => setMrrOpen(true)}
                    title="Breakdown par pays"
                    className="w-5 h-5 rounded-full bg-violet-900/60 hover:bg-violet-700 flex items-center justify-center text-violet-400 hover:text-white transition-colors text-[10px] font-extrabold">
                    i
                  </button>
                </div>
                <div className="text-xs text-gray-500 mb-0.5">MRR المتوقع</div>
                {mrrData ? (
                  <div className="text-2xl font-extrabold text-violet-400">
                    ${mrrData.totalMRR_USD.toFixed(0)}
                    <span className="text-xs text-gray-500 font-normal ml-1">USD/mois</span>
                  </div>
                ) : (
                  <div className="text-2xl font-extrabold text-violet-400 animate-pulse">…</div>
                )}
                {mrrData && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    {new Date(mrrData.computedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Subscription tier split */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-950/40 border border-sky-800 rounded-2xl p-4 flex items-center gap-4">
                <Coffee className="w-9 h-9 text-sky-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-sky-400 font-bold uppercase tracking-wide">الشريحة الاقتصادية</p>
                  <p className="text-4xl font-extrabold text-white">{overview.economyCafes}</p>
                  <p className="text-xs text-sky-300/60 mt-0.5">{"< 50 طلبية / أسبوع"}</p>
                </div>
              </div>
              <div className="bg-violet-950/40 border border-violet-800 rounded-2xl p-4 flex items-center gap-4">
                <Zap className="w-9 h-9 text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-violet-400 font-bold uppercase tracking-wide">الشريحة المتقدمة</p>
                  <p className="text-4xl font-extrabold text-white">{overview.advancedCafes}</p>
                  <p className="text-xs text-violet-300/60 mt-0.5">{"≥ 50 طلبية / أسبوع"}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Filters */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-wrap gap-3 items-end">
          <FSelect label="الدولة" value={filterCountry} onChange={setFilterCountry}>
            <option value="">الكل</option>
            <option value="MA">المغرب 🇲🇦</option>
            <option value="SA">السعودية 🇸🇦</option>
            <option value="AE">الإمارات 🇦🇪</option>
          </FSelect>
          <FSelect label="الحالة" value={filterStatus} onChange={setFilterStatus}>
            <option value="">الكل</option>
            <option value="GRACE_PERIOD">تجريبي</option>
            <option value="COLLECTING_DEBT">نشط</option>
            <option value="SUSPENDED">موقوف</option>
          </FSelect>
          <FSelect label="الشريحة" value={filterTier} onChange={setFilterTier}>
            <option value="">الكل</option>
            <option value="ECONOMY">اقتصادي</option>
            <option value="ADVANCED">متقدم</option>
          </FSelect>
          <div>
            <p className="text-xs text-gray-500 mb-1">الرصيد</p>
            <button onClick={() => setSortBal(s => s === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {sortBal === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {sortBal === 'asc' ? 'الأقل أولاً' : 'الأعلى أولاً'}
            </button>
          </div>
          <button onClick={() => { setPage(1); loadAll(1) }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            <Filter className="w-4 h-4" /> تصفية
          </button>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-2 z-20 flex items-center justify-between bg-red-950/90 border border-red-700/60 rounded-2xl px-5 py-3 mb-3 backdrop-blur-sm shadow-xl">
            <span className="text-red-300 font-bold text-sm">{selectedIds.size} حساب محدد</span>
            <div className="flex items-center gap-2">
              <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
                إلغاء التحديد
              </button>
              <button
                onClick={bulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-4 py-1.5 rounded-xl transition-colors text-sm"
              >
                {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف {selectedIds.size} حساب
              </button>
            </div>
          </div>
        )}

        {/* Tenants table */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="px-3 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                      checked={tenants.filter(t => !t.isDemo).length > 0 && tenants.filter(t => !t.isDemo).every(t => selectedIds.has(t.id))}
                      onChange={e => e.target.checked ? selectAll() : clearSelection()}
                      title="تحديد الكل"
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">المقهى</th>
                  <th className="px-4 py-3 text-right font-medium">المنطقة</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-center font-medium">التجربة</th>
                  <th className="px-4 py-3 text-center font-medium">طلبات / أسبوع</th>
                  <th className="px-4 py-3 text-right font-medium">الشريحة</th>
                  <th className="px-4 py-3 text-right font-medium">الاشتراك / شهر</th>
                  <th className="px-4 py-3 text-right font-medium">الرصيد</th>
                  <th className="px-4 py-3 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {tenants.map(t => {
                  const bal      = Number(t.walletBalance)
                  const days     = trialDaysLeft(t.trialEndsAt)
                  const checked  = selectedIds.has(t.id)
                  return (
                    <tr key={t.id}
                      className={`transition-colors cursor-pointer ${checked ? 'bg-red-950/20' : 'hover:bg-gray-800/30'}`}
                      onClick={() => openModal(t)}
                    >
                      <td className="px-3 py-3 text-center" onClick={e => { e.stopPropagation(); toggleSelect(t.id, t.isDemo) }}>
                        {t.isDemo
                          ? <span title="محمي — لا يمكن حذفه" className="text-amber-500 text-base select-none">🛡</span>
                          : <input
                              type="checkbox"
                              className="accent-emerald-500 w-4 h-4 cursor-pointer"
                              checked={checked}
                              onChange={() => toggleSelect(t.id, t.isDemo)}
                            />
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white flex items-center gap-2">
                          {t.businessName || t.name}
                          {t.isDemo && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Demo</span>}
                          {t.inventoryActivationRequested && !t.isSmartInventoryEnabled && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                              <Package className="w-2.5 h-2.5" /> مخزون
                            </span>
                          )}
                          {t.isSmartInventoryEnabled && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <Package className="w-2.5 h-2.5" /> ✓
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs">{t.subdomain}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.country}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${BILLING_COLORS[t.billingStatus] ?? 'bg-gray-700 text-gray-300'}`}>
                          {BILLING_LABELS[t.billingStatus] ?? t.billingStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {days == null ? <span className="text-gray-600">—</span>
                          : days > 0  ? <span className="text-amber-400">{days} يوم</span>
                          :             <span className="text-red-400">انتهت</span>}
                        {t.hasExtendedTrial && <span className="mr-1 text-sky-400 text-[10px]">↗ممدد</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-white">{t.weeklyOrderCount ?? t._count.orders}</span>
                      </td>
                      <td className="px-4 py-3">
                        {t.subscriptionTier
                          ? <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TIER_COLORS[t.subscriptionTier] ?? 'bg-gray-700 text-gray-300'}`}>{TIER_AR[t.subscriptionTier] ?? t.subscriptionTier}</span>
                          : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 font-bold text-violet-300 text-xs">
                        {t.monthlyFee != null ? `${t.monthlyFee.toFixed(2)} ${t.currency}` : '—'}
                      </td>
                      <td className={`px-4 py-3 font-bold text-xs ${bal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {bal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 flex-wrap">
                          {t.billingStatus !== 'SUSPENDED'
                            ? <RowBtn icon={<Ban className="w-3 h-3" />}     label="إيقاف" color="red"   loading={actionId === t.id} onClick={() => suspend(t.id)} />
                            : <RowBtn icon={<CheckCircle className="w-3 h-3" />} label="تفعيل" color="green" loading={actionId === t.id} onClick={() => reactivate(t.id)} />}
                          <RowBtn icon={<Edit3 className="w-3 h-3" />} label="إعداد" color="blue" loading={false} onClick={() => openModal(t, 'billing')} />
                          <RowBtn icon={<Trash2 className="w-3 h-3" />} label="حذف" color="red" loading={false} onClick={() => setDeleteConfirm(t)} />
                          <RowBtn
                            icon={<span className="text-[11px]">{t.isDemo ? '🛡' : '🔓'}</span>}
                            label={t.isDemo ? 'محمي' : 'حماية'}
                            color={t.isDemo ? 'amber' : 'blue'}
                            loading={false}
                            onClick={() => toggleDemoFlag(t.id, t.isDemo)}
                          />
                          {/* Smart Inventory approval button — shows only when requested */}
                          {t.inventoryActivationRequested && !t.isSmartInventoryEnabled && (
                            <RowBtn
                              icon={<Package className="w-3 h-3" />}
                              label="موافقة مخزون"
                              color="amber"
                              loading={actionId === t.id}
                              onClick={() => approveInventory(t.id)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…
            </div>
          )}
          {!loading && tenants.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">لا توجد بيانات</div>
          )}
          {hasMore && !loading && (
            <div className="p-4 text-center border-t border-gray-800">
              <button
                onClick={() => { const n = page + 1; setPage(n); loadAll(n, true) }}
                className="text-sm text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-1 mx-auto"
              >
                <ChevronDown className="w-4 h-4" /> تحميل المزيد ({total - tenants.length} متبقٍ)
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Modal ── */}
      {modal && (
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
      )}

      {/* ── MRR Breakdown Modal ── */}
      {mrrOpen && mrrData && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setMrrOpen(false)}>
          <div className="bg-gray-900 border border-violet-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-950 to-slate-900 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-extrabold text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-400" /> MRR المتوقع — Breakdown
                </h3>
                <p className="text-violet-400 text-xs mt-0.5">
                  Calculé le {new Date(mrrData.computedAt).toLocaleString('fr')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total USD/mois</p>
                <p className="text-2xl font-extrabold text-violet-400">${mrrData.totalMRR_USD.toFixed(2)}</p>
              </div>
            </div>

            <div className="p-4 space-y-1 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 pb-2 border-b border-gray-800">
                <span>Pays</span><span className="text-right">Cafés</span>
                <span className="text-right">Commission locale</span>
                <span className="text-right">USD/mois</span>
              </div>
              {mrrData.byCountry.map((r: any) => (
                <div key={r.country} className="grid grid-cols-4 items-center px-2 py-2 rounded-xl hover:bg-gray-800/50 text-sm">
                  <span className="font-bold text-white">{r.country}</span>
                  <span className="text-right text-gray-400">{r.cafes}</span>
                  <span className="text-right text-gray-300 text-xs">
                    {r.monthlyCommissionLocal.toFixed(0)} {r.currency}
                    {r.monthlyMaintenanceUSD > 0 && <span className="text-amber-400"> +${r.monthlyMaintenanceUSD.toFixed(0)}</span>}
                  </span>
                  <span className="text-right font-extrabold text-violet-300">${r.monthlyUSD.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-gray-800 text-[10px] text-gray-600 flex justify-between">
              <span>Basé sur 10 cafés + 10 sandwichs/jour × orders_weekly × taux de commission</span>
              <button onClick={() => setMrrOpen(false)} className="text-gray-400 hover:text-white px-2">✕</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ── */}
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

            <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 space-y-1">
              <p className="text-red-300 font-bold text-sm">{deleteConfirm.businessName || deleteConfirm.name}</p>
              <p className="text-red-400 text-xs">{deleteConfirm.subdomain} · {deleteConfirm.country}</p>
              <p className="text-red-500 text-xs mt-2">
                سيتم حذف كل الطلبات، المنيو، الطاولات، الموظفين، والسجلات المالية بشكل نهائي.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteTenant(deleteConfirm.id)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                {deleting ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}

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
