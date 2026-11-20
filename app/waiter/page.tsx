'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { io as socketIO, Socket } from 'socket.io-client'
import {
  Bell, CheckCircle2, Clock, Users, LogOut, WifiOff,
  ShoppingCart, Plus, Minus, Trash2, Send, ChefHat, Utensils, Search, X,
} from 'lucide-react'
import { tr, getLang, setLang as saveLang, POS_LANGS, type Lang } from '../../src/lib/posI18n'

// ─── Local strings (keys identical across languages) ─────────────────────────

const WT = {
  ar: {
    urgent: 'عاجل',
    readyToServe: 'جاهز للتقديم',
    served: 'تم التقديم ✓',
    newOrders: 'طلبات جديدة',
    gotIt: 'تم الاطلاع ✓',
    customerCalls: 'نداءات الزبائن',
    done: 'تم ✓',
    billRequests: 'طلبات الحساب',
    paid: 'تم الدفع ✓',
    wholeTable: 'الطاولة كاملة',
    allClear: 'لا شيء بانتظارك',
    noAlerts: 'لا توجد تنبيهات نشطة',
    onMyWay: 'في الطريق ✓',
    onDuty: 'في الخدمة',
    offDuty: 'خارج الخدمة',
    noTables: 'لا توجد طاولات مخصّصة',
    askSupervisor: 'تواصل مع المشرف',
    noStaff: 'لا تتوفر بيانات الفريق',
    addMore: 'أضف المزيد',
    newOrder: '+ طلب جديد',
    selectTable: 'اختر طاولة',
    table: 'طاولة',
    change: 'تغيير',
    searchPh: 'ابحث عن صنف…',
    noResults: 'لا توجد نتائج',
    loadingMenu: 'جارٍ تحميل القائمة…',
    sending: 'جارٍ الإرسال…',
    navAlerts: 'التنبيهات',
    navTeam: 'الفريق',
    navOrder: 'طلب',
    zone: 'المنطقة',
    zonePh: 'مثال: التراس، الطابق العلوي…',
    saving: 'جارٍ الحفظ…',
    saveZone: 'حفظ المنطقة',
    releasing: 'جارٍ التحرير…',
    releaseTable: '✕ تحرير هذه الطاولة',
    cancel: 'إلغاء',
    failed: 'تعذّرت العملية، يرجى المحاولة مجدداً',
    networkError: 'تعذّر الاتصال بالشبكة',
    ackFailed: 'تعذّر تأكيد التنبيه، يرجى المحاولة مجدداً',
    updateFailed: 'تعذّر تحديث الطلب، يرجى المحاولة مجدداً',
    callWaiter: 'طلب النادل',
    cashPayment: 'دفع نقدي',
    cardPayment: 'دفع بالبطاقة',
    callWater: 'ماء',
    callClean: 'تنظيف',
    callOther: 'نداء',
    statusCompleted: 'مكتمل',
    statusCancelled: 'ملغى',
    logout: 'تسجيل الخروج',
    roleWaiter: 'نادل',
    roleSupervisor: 'مشرف',
    roleCashier: 'كاشير',
    roleManager: 'مدير',
    more: (n: number) => `+${n} تنبيهات أخرى`,
    seats: (s: string) => `المقاعد ${s}`,
    seat: (n: number) => `المقعد ${n}`,
    items: (n: number) => n === 1 ? 'صنف واحد' : n === 2 ? 'صنفان' : n <= 10 ? `${n} أصناف` : `${n} صنفاً`,
    now: 'الآن',
    min: (m: number) => `${m} د`,
    hm: (h: number, m: number) => m > 0 ? `${h} س ${m} د` : `${h} س`,
    lt1: 'أقل من دقيقة',
    handover: (d: string) => `يُنصح بتسليم المناوبة — ${d} في الخدمة · أطلِع زميلك قبل المغادرة`,
    tableSeat: (t: string | number, s: number) => `ط${t} · م${s}`,
    tShort: (t: string | number) => `ط${t}`,
  },
  fr: {
    urgent: 'Urgent',
    readyToServe: 'Prêt à servir',
    served: 'Servi ✓',
    newOrders: 'Nouvelles commandes',
    gotIt: 'Compris ✓',
    customerCalls: 'Appels clients',
    done: 'Terminé ✓',
    billRequests: 'Demandes d’addition',
    paid: 'Payé ✓',
    wholeTable: 'Table entière',
    allClear: 'Tout est en ordre',
    noAlerts: 'Aucune alerte active',
    onMyWay: 'J’arrive ✓',
    onDuty: 'En service',
    offDuty: 'Hors service',
    noTables: 'Aucune table assignée',
    askSupervisor: 'Demandez à votre superviseur',
    noStaff: 'Aucune donnée d’équipe',
    addMore: 'ajouter',
    newOrder: '+ Nouvelle commande',
    selectTable: 'Choisir une table',
    table: 'Table',
    change: 'Changer',
    searchPh: 'Rechercher un produit…',
    noResults: 'Aucun résultat',
    loadingMenu: 'Chargement du menu…',
    sending: 'Envoi…',
    navAlerts: 'Alertes',
    navTeam: 'Équipe',
    navOrder: 'Commande',
    zone: 'Zone',
    zonePh: 'ex. Terrasse, Étage…',
    saving: 'Enregistrement…',
    saveZone: 'Enregistrer la zone',
    releasing: 'Libération…',
    releaseTable: '✕ Libérer cette table',
    cancel: 'Annuler',
    failed: 'Échec, réessayez',
    networkError: 'Erreur réseau',
    ackFailed: 'Échec de la confirmation — réessayez',
    updateFailed: 'Échec de la mise à jour — réessayez',
    callWaiter: 'Appel serveur',
    cashPayment: 'Paiement espèces',
    cardPayment: 'Paiement carte',
    callWater: 'Eau',
    callClean: 'Nettoyage',
    callOther: 'Appel',
    statusCompleted: 'Terminée',
    statusCancelled: 'Annulée',
    logout: 'Déconnexion',
    roleWaiter: 'Serveur',
    roleSupervisor: 'Superviseur',
    roleCashier: 'Caissier',
    roleManager: 'Gérant',
    more: (n: number) => `+${n} autres alertes`,
    seats: (s: string) => `Places ${s}`,
    seat: (n: number) => `Place ${n}`,
    items: (n: number) => `${n} article${n === 1 ? '' : 's'}`,
    now: 'maintenant',
    min: (m: number) => `${m} min`,
    hm: (h: number, m: number) => m > 0 ? `${h}h${m}` : `${h}h`,
    lt1: '< 1 min',
    handover: (d: string) => `Passation recommandée — ${d} de service · Briefez votre collègue avant de partir`,
    tableSeat: (t: string | number, s: number) => `T${t} · P${s}`,
    tShort: (t: string | number) => `T${t}`,
  },
  en: {
    urgent: 'Urgent',
    readyToServe: 'Ready to serve',
    served: 'Served ✓',
    newOrders: 'New orders',
    gotIt: '{w.gotIt}',
    customerCalls: 'Customer calls',
    done: 'Done ✓',
    billRequests: 'Bill requests',
    paid: '{w.paid}',
    wholeTable: 'Whole table',
    allClear: 'All clear',
    noAlerts: 'No active alerts',
    onMyWay: '{w.onMyWay}',
    onDuty: 'On duty',
    offDuty: 'Off duty',
    noTables: 'No tables assigned',
    askSupervisor: 'Ask your supervisor',
    noStaff: 'No team data available',
    addMore: 'add more',
    newOrder: '+ New order',
    selectTable: 'Select table',
    table: 'Table',
    change: 'Change',
    searchPh: 'Search a product…',
    noResults: 'No results',
    loadingMenu: 'Loading menu…',
    sending: 'Sending…',
    navAlerts: 'Alerts',
    navTeam: 'Team',
    navOrder: 'Order',
    zone: 'Zone',
    zonePh: 'e.g. Terrace, Upstairs…',
    saving: 'Saving…',
    saveZone: 'Save zone',
    releasing: 'Releasing…',
    releaseTable: '✕ Release this table',
    cancel: 'Cancel',
    failed: 'Something went wrong, please try again',
    networkError: 'Network error',
    ackFailed: 'Failed to acknowledge — try again',
    updateFailed: 'Failed to update — try again',
    callWaiter: 'Call waiter',
    cashPayment: 'Cash payment',
    cardPayment: 'Card payment',
    callWater: 'Water',
    callClean: 'Cleaning',
    callOther: 'Call',
    statusCompleted: 'Completed',
    statusCancelled: 'Cancelled',
    logout: 'Log out',
    roleWaiter: 'Waiter',
    roleSupervisor: 'Supervisor',
    roleCashier: 'Cashier',
    roleManager: 'Manager',
    more: (n: number) => `+${n} more alerts`,
    seats: (s: string) => `Seats ${s}`,
    seat: (n: number) => `Seat ${n}`,
    items: (n: number) => `${n} item${n === 1 ? '' : 's'}`,
    now: 'now',
    min: (m: number) => `${m}m`,
    hm: (h: number, m: number) => m > 0 ? `${h}h ${m}m` : `${h}h`,
    lt1: '< 1m',
    handover: (d: string) => `Handover recommended — ${d} on shift · Brief your colleague before leaving`,
    tableSeat: (t: string | number, s: number) => `T${t} · S${s}`,
    tShort: (t: string | number) => `T${t}`,
  },
  es: {
    urgent: 'Urgente',
    readyToServe: 'Listo para servir',
    served: 'Servido ✓',
    newOrders: 'Pedidos nuevos',
    gotIt: 'Entendido ✓',
    customerCalls: 'Llamadas de clientes',
    done: 'Hecho ✓',
    billRequests: 'Solicitudes de cuenta',
    paid: 'Pagado ✓',
    wholeTable: 'Mesa completa',
    allClear: 'Todo en orden',
    noAlerts: 'Sin alertas activas',
    onMyWay: 'Voy ✓',
    onDuty: 'En servicio',
    offDuty: 'Fuera de servicio',
    noTables: 'Sin mesas asignadas',
    askSupervisor: 'Pregunta a tu supervisor',
    noStaff: 'Sin datos del equipo',
    addMore: 'añadir más',
    newOrder: '+ Nuevo pedido',
    selectTable: 'Elegir mesa',
    table: 'Mesa',
    change: 'Cambiar',
    searchPh: 'Buscar un producto…',
    noResults: 'Sin resultados',
    loadingMenu: 'Cargando menú…',
    sending: 'Enviando…',
    navAlerts: 'Alertas',
    navTeam: 'Equipo',
    navOrder: 'Pedido',
    zone: 'Zona',
    zonePh: 'ej. Terraza, Planta alta…',
    saving: 'Guardando…',
    saveZone: 'Guardar zona',
    releasing: 'Liberando…',
    releaseTable: '✕ Liberar esta mesa',
    cancel: 'Cancelar',
    failed: 'Error, inténtalo de nuevo',
    networkError: 'Error de red',
    ackFailed: 'Error al confirmar — inténtalo de nuevo',
    updateFailed: 'Error al actualizar — inténtalo de nuevo',
    callWaiter: 'Llamar al camarero',
    cashPayment: 'Pago en efectivo',
    cardPayment: 'Pago con tarjeta',
    callWater: 'Agua',
    callClean: 'Limpieza',
    callOther: 'Llamada',
    statusCompleted: 'Completado',
    statusCancelled: 'Cancelado',
    logout: 'Cerrar sesión',
    roleWaiter: 'Camarero',
    roleSupervisor: 'Supervisor',
    roleCashier: 'Cajero',
    roleManager: 'Gerente',
    more: (n: number) => `+${n} alertas más`,
    seats: (s: string) => `Asientos ${s}`,
    seat: (n: number) => `Asiento ${n}`,
    items: (n: number) => `${n} artículo${n === 1 ? '' : 's'}`,
    now: 'ahora',
    min: (m: number) => `${m} min`,
    hm: (h: number, m: number) => m > 0 ? `${h}h ${m}m` : `${h}h`,
    lt1: '< 1 min',
    handover: (d: string) => `Relevo recomendado — ${d} de servicio · Informa a tu compañero antes de salir`,
    tableSeat: (t: string | number, s: number) => `M${t} · A${s}`,
    tShort: (t: string | number) => `M${t}`,
  },
}
type WStrings = (typeof WT)['en']
const wtOf = (lang: string): WStrings => (WT as Record<string, WStrings>)[lang] ?? WT.ar

// ─── Colour palettes ──────────────────────────────────────────────────────────

const PALETTES = [
  { dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700 ring-1 ring-rose-300' },
  { dot: 'bg-sky-500',     badge: 'bg-sky-100 text-sky-700 ring-1 ring-sky-300' },
  { dot: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700 ring-1 ring-violet-300' },
  { dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' },
  { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' },
  { dot: 'bg-fuchsia-500', badge: 'bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-300' },
  { dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700 ring-1 ring-orange-300' },
  { dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700 ring-1 ring-teal-300' },
  { dot: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' },
  { dot: 'bg-pink-500',    badge: 'bg-pink-100 text-pink-700 ring-1 ring-pink-300' },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = 'call_waiter' | 'pay_cash' | 'pay_tpe'

type WaiterNotif = {
  orderId: string; tableId: string | null; tableNumber: number | null
  type: NotifType; isActive: boolean; receivedAt: string
}
type ReadyOrder = {
  id: string; createdAt: string
  table: { tableNumber: number } | null
  originalTable: { tableNumber: number } | null
  seat: { seatNumber: number } | null
  items: { id: string; quantity: number; product: { nameEn: string; nameAr?: string | null; nameFr?: string | null } }[]
}
type LegacyCall  = { id: string; tableId: string; tableNumber?: number; type: string; message?: string | null; createdAt: string }
type BillRequest = { id: string; tableId: string; tableNumber?: number; seatNumbers?: number[]; payScope?: string; message?: string | null; createdAt: string }
type NewOrder    = { orderId: string; mergeLabel: string; totalPrice: string; createdAt: string }
type TodayOrder = {
  id: string; status: 'COMPLETED' | 'CANCELLED'; createdAt: string
  table: { tableNumber: number } | null
  originalTable: { tableNumber: number } | null
  seat: { seatNumber: number } | null
  items: { quantity: number; product: { id: string; nameEn: string; nameAr?: string | null; nameFr?: string | null } }[]
}
type WaiterStatus = {
  id: string; name: string; role: string
  shiftStatus: 'ACTIVE' | 'OFF_DUTY'
  clockInTime: string | null
  assignedTables: { id: string; tableNumber: number; zone?: string | null }[]
}

// ─── Notification config ──────────────────────────────────────────────────────

const NOTIF_META: Record<NotifType, { emoji: string; label: 'callWaiter' | 'cashPayment' | 'cardPayment'; border: string; glow: string; btn: string }> = {
  call_waiter: {
    emoji: '🔔', label: 'callWaiter',
    border: 'border-l-amber-400',
    glow:   'shadow-amber-500/20',
    btn:    'bg-amber-500 hover:bg-amber-400',
  },
  pay_cash: {
    emoji: '💵', label: 'cashPayment',
    border: 'border-l-red-400',
    glow:   'shadow-red-500/20',
    btn:    'bg-red-500 hover:bg-red-400',
  },
  pay_tpe: {
    emoji: '💳', label: 'cardPayment',
    border: 'border-l-violet-400',
    glow:   'shadow-violet-500/20',
    btn:    'bg-violet-500 hover:bg-violet-400',
  },
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function playToneSeq(freqs: number[], interval = 200) {
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext
    if (!C) return
    const ctx = new C() as AudioContext
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = f; osc.type = 'sine'
      const t = ctx.currentTime + (i * interval) / 1000
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.start(t); osc.stop(t + 0.27)
    })
  } catch {}
}

const NOTIF_SOUND: Record<NotifType, () => void> = {
  call_waiter: () => playToneSeq([660, 880]),
  pay_cash:    () => playToneSeq([440, 440, 660], 180),
  pay_tpe:     () => playToneSeq([880, 1047, 880], 180),
}
const playReadyChime = () => playToneSeq([523, 659, 784, 1047], 140)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(iso: string, lang: string) {
  const w = wtOf(lang)
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)  return w.now
  if (m < 60) return w.min(m)
  return w.hm(Math.floor(m / 60), m % 60)
}

function shiftDuration(clockIn: string | null, lang: string) {
  if (!clockIn) return null
  const w = wtOf(lang)
  const m = Math.floor((Date.now() - new Date(clockIn).getTime()) / 60000)
  if (m < 1)  return w.lt1
  if (m < 60) return w.min(m)
  return w.hm(Math.floor(m / 60), m % 60)
}

function roleLabel(role: string, lang: string) {
  const w = wtOf(lang)
  return role === 'WAITER' ? w.roleWaiter : role === 'SUPERVISOR' ? w.roleSupervisor
    : role === 'CASHIER' ? w.roleCashier : role === 'MANAGER' || role === 'BOSS' || role === 'OWNER' ? w.roleManager : role
}

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function resolveToken(): { token: string; isPOS: boolean } | null {
  try {
    const t = localStorage.getItem('posToken')
    if (t) { const p = JSON.parse(atob(t.split('.')[1])); if (p.staffId && p.cafeId) return { token: t, isPOS: true } }
    const a = localStorage.getItem('token')
    if (a) { const p = JSON.parse(atob(a.split('.')[1])); if (p.cafeId) return { token: a, isPOS: false } }
  } catch {}
  return null
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// ─── Menu types ───────────────────────────────────────────────────────────────

// Dish name in the staff member's language, falling back to whatever exists.
function productName(p: { nameEn?: string | null; nameAr?: string | null; nameFr?: string | null }, lang: string): string {
  const pick = lang === 'ar' ? p.nameAr : lang === 'fr' ? p.nameFr : p.nameEn
  return pick || p.nameEn || p.nameAr || p.nameFr || ''
}

type MenuProduct = { id: string; nameEn: string; nameAr: string; nameFr: string; price: number }
type MenuCat     = { id: string; nameEn: string; nameAr: string; products: MenuProduct[] }
type CartItem    = { productId: string; name: string; price: number; qty: number }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WaiterPage() {
  const [lang, setLangState] = useState<Lang>('ar')
  useEffect(() => { setLangState(getLang()) }, [])
  const L = (key: Parameters<typeof tr>[0]) => tr(key, lang)
  const w = wtOf(lang)

  const [authed,    setAuthed]    = useState(false)
  const [isPOS,     setIsPOS]     = useState(false)
  const [cafeId,    setCafeId]    = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState('WAITER')
  const [connected, setConnected] = useState(false)
  const [cafeInfo,  setCafeInfo]  = useState<{ name: string; logoUrl: string | null; currency: string }>({ name: '', logoUrl: null, currency: '' })

  const [waiters,       setWaiters]       = useState<WaiterStatus[]>([])
  const [notifications, setNotifications] = useState<WaiterNotif[]>([])
  const [ready,         setReady]         = useState<ReadyOrder[]>([])
  const [newOrders,     setNewOrders]     = useState<NewOrder[]>([])
  const [legacyCalls,   setLegacyCalls]   = useState<LegacyCall[]>([])
  const [bills,         setBills]         = useState<BillRequest[]>([])
  const [todayOrders,   setTodayOrders]   = useState<TodayOrder[]>([])

  const [tab,  setTab]  = useState<'alerts' | 'team' | 'today' | 'order'>('alerts')
  const [, setTick]     = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flashActionError(msg: string) {
    setActionError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setActionError(null), 4000)
  }

  // ── Manage table (zone + release) — both endpoints already existed with
  // zero UI caller anywhere in the app. Scoped to the current waiter's own
  // assigned tables since /release only allows the assigned waiter or a
  // supervisor, and this keeps the affordance consistent for both actions.
  const [manageTable, setManageTable] = useState<{ id: string; tableNumber: number; zone?: string | null } | null>(null)
  const [zoneInput,   setZoneInput]   = useState('')
  const [savingZone,  setSavingZone]  = useState(false)
  const [releasing,   setReleasing]   = useState(false)
  const [manageError, setManageError] = useState('')

  function openManageTable(t: { id: string; tableNumber: number; zone?: string | null }) {
    setManageTable(t)
    setZoneInput(t.zone ?? '')
    setManageError('')
  }

  async function saveZone() {
    if (!manageTable || !zoneInput.trim()) return
    setSavingZone(true); setManageError('')
    try {
      const res = await fetch(`/api/pos/tables/${manageTable.id}/zone`, {
        method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: zoneInput.trim() }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setManageError(wtOf(lang).failed); return }
      setManageTable(null)
      loadWaiters()
    } catch {
      setManageError(wtOf(lang).networkError)
    } finally {
      setSavingZone(false)
    }
  }

  async function releaseTable() {
    if (!manageTable) return
    setReleasing(true); setManageError('')
    try {
      const res = await fetch(`/api/pos/tables/${manageTable.id}/release`, {
        method: 'DELETE', headers: authHeader(),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setManageError(wtOf(lang).failed); return }
      setManageTable(null)
      loadWaiters()
    } catch {
      setManageError(wtOf(lang).networkError)
    } finally {
      setReleasing(false)
    }
  }

  // order tab
  const [menuCats,        setMenuCats]        = useState<MenuCat[]>([])
  const [activeCat,       setActiveCat]       = useState('')
  const [productSearch,   setProductSearch]   = useState('')
  const [orderTable,      setOrderTable]      = useState<{ id: string; tableNumber: number } | null>(null)
  const [orderCart,       setOrderCart]       = useState<CartItem[]>([])
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderDone,       setOrderDone]       = useState(false)
  const [lastOrderTable,  setLastOrderTable]  = useState<{ id: string; tableNumber: number } | null>(null)
  const [orderErr,        setOrderErr]        = useState('')

  const tokenRef   = useRef('')
  const socketRef  = useRef<Socket | null>(null)
  const beepRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const notifsRef  = useRef<WaiterNotif[]>([])

  useEffect(() => { notifsRef.current = notifications }, [notifications])

  function authHeader() { return { Authorization: `Bearer ${tokenRef.current}` } }

  // ── boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const resolved = resolveToken()
    if (!resolved) { window.location.href = '/pos'; return }
    const p = JSON.parse(atob(resolved.token.split('.')[1]))
    tokenRef.current = resolved.token
    setCafeId(p.cafeId)
    setIsPOS(resolved.isPOS)
    setAuthed(true)
    setStaffName(localStorage.getItem('staffName') ?? '')
    setStaffRole(p.staffRole ?? 'WAITER')

    // Fetch cafe name + logo (the public menu API needs a table token, not a subdomain)
    const subdomain = localStorage.getItem('subdomain') || localStorage.getItem('posLastSubdomain')
    if (subdomain) {
      fetch(`/api/public/cafe/${encodeURIComponent(subdomain)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return
          setCafeInfo({ name: d.name || '', logoUrl: d.logoUrl || null, currency: d.currency || '' })
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const loadWaiters = useCallback(async () => {
    if (!isPOS) return
    const res = await fetch('/api/pos/waiters/status', { headers: authHeader() })
    if (res.ok) setWaiters((await res.json()).waiters ?? [])
  }, [isPOS])

  useEffect(() => {
    if (!authed) return
    loadWaiters()
    // table_assigned/table_released socket handlers already call loadWaiters()
    // directly — this is now just a reconnect safety net.
    const t = setInterval(loadWaiters, 180_000)
    return () => clearInterval(t)
  }, [authed, loadWaiters])

  const loadReady = useCallback(async () => {
    const ep = isPOS ? '/api/pos/waiter/ready' : '/api/orders?status=DELIVERED'
    const data = await fetch(ep, { headers: authHeader() }).then(r => r.ok ? r.json() : [])
    setReady((data as ReadyOrder[]).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
  }, [isPOS])

  useEffect(() => { if (authed) loadReady() }, [authed, loadReady])

  const loadTodayOrders = useCallback(async () => {
    if (!isPOS) return
    const res = await fetch('/api/pos/waiter/today', { headers: authHeader() })
    if (res.ok) { const d = await res.json(); setTodayOrders(d.orders ?? []) }
  }, [isPOS])

  useEffect(() => { if (authed) loadTodayOrders() }, [authed, loadTodayOrders])

  const vibrate = useCallback(() => { try { navigator.vibrate?.([200, 100, 200]) } catch {} }, [])

  function startBeepLoop(type: NotifType) {
    if (beepRef.current) return
    NOTIF_SOUND[type]()
    beepRef.current = setInterval(() => {
      const active = notifsRef.current.filter(n => n.isActive)
      if (active.length) NOTIF_SOUND[active[0].type]()
      else { clearInterval(beepRef.current!); beepRef.current = null }
    }, 3000)
  }

  function stopBeepIfQuiet() {
    if (!notifsRef.current.some(n => n.isActive) && beepRef.current) {
      clearInterval(beepRef.current); beepRef.current = null
    }
  }

  // ── socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !cafeId) return
    const socket = socketIO(SOCKET_URL || window.location.origin, {
      auth: { token: tokenRef.current }, transports: ['polling', 'websocket'],
    })
    socketRef.current = socket

    socket.on('connect',       () => { setConnected(true); socket.emit('join', `room_${cafeId}`) })
    socket.on('disconnect',    () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    socket.on('waiter_notification', (data: Omit<WaiterNotif, 'receivedAt'>) => {
      vibrate()
      const n: WaiterNotif = { ...data, receivedAt: new Date().toISOString() }
      setNotifications(prev => [n, ...prev.filter(x => x.orderId !== data.orderId)])
      startBeepLoop(data.type)
      // only switch to alerts if waiter is on team/order tab and not mid-order
    })

    socket.on('waiter_notification_acked', ({ orderId }: { orderId: string }) => {
      setNotifications(prev => prev.map(n => n.orderId === orderId ? { ...n, isActive: false } : n))
      stopBeepIfQuiet()
    })

    socket.on('waiter_order_ready', () => {
      vibrate(); playReadyChime()
      loadReady()
    })

    socket.on('new_order', (o: { orderId: string; mergeLabel: string; totalPrice: string }) => {
      vibrate()
      setNewOrders(prev => [{ ...o, createdAt: new Date().toISOString() }, ...prev.filter(x => x.orderId !== o.orderId)])
    })

    socket.on('waiter_called', (c: LegacyCall) => {
      vibrate()
      setLegacyCalls(prev => [c, ...prev.filter(x => x.id !== c.id)])
    })
    socket.on('waiter_acknowledged', ({ id }: { id: string }) =>
      setLegacyCalls(prev => prev.filter(c => c.id !== id))
    )

    socket.on('bill_requested', (b: BillRequest) => {
      vibrate()
      setBills(prev => [b, ...prev.filter(x => x.id !== b.id)])
    })

    socket.on('order_status_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        setReady(prev => prev.filter(o => o.id !== orderId))
        setNewOrders(prev => prev.filter(o => o.orderId !== orderId))
      }
    })

    socket.on('table_assigned', () => loadWaiters())
    socket.on('table_released', () => loadWaiters())

    return () => {
      socket.disconnect()
      if (beepRef.current) { clearInterval(beepRef.current); beepRef.current = null }
    }
  }, [authed, cafeId, isPOS, vibrate, loadReady, loadWaiters])

  // ── actions ────────────────────────────────────────────────────────────────
  async function ackNotification(orderId: string) {
    setNotifications(prev => prev.map(n => n.orderId === orderId ? { ...n, isActive: false } : n))
    stopBeepIfQuiet()
    try {
      const res = await fetch('/api/waiter/notifications/ack', {
        method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setNotifications(prev => prev.map(n => n.orderId === orderId ? { ...n, isActive: true } : n))
      const original = notifsRef.current.find(n => n.orderId === orderId)
      startBeepLoop(original?.type ?? 'call_waiter')
      flashActionError(wtOf(lang).ackFailed)
    }
  }

  function ackLegacyCall(callId: string) {
    socketRef.current?.emit('ack_call', { cafeId, callId })
    setLegacyCalls(prev => prev.filter(c => c.id !== callId))
  }

  async function markServed(orderId: string) {
    const order = ready.find(o => o.id === orderId)
    setReady(prev => prev.filter(o => o.id !== orderId))
    try {
      const ep = isPOS ? `/api/pos/waiter/orders/${orderId}/served` : `/api/orders/${orderId}/status`
      const body = isPOS ? undefined : JSON.stringify({ status: 'COMPLETED' })
      const res = await fetch(ep, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body })
      if (!res.ok) throw new Error()
    } catch {
      // Put it back — the order wasn't actually marked served, so silently
      // dropping it from the "ready to serve" list would hide a table that
      // still needs food brought out.
      if (order) setReady(prev => prev.find(o => o.id === orderId) ? prev : [...prev, order].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
      flashActionError(wtOf(lang).updateFailed)
    }
  }

  function logout() {
    localStorage.removeItem('posToken'); localStorage.removeItem('staffName')
    window.location.href = '/pos'
  }

  async function openOrderTab() {
    setTab('order'); setOrderDone(false); setOrderErr('')
    if (menuCats.length > 0) return
    try {
      const res = await fetch('/api/pos/menu', { headers: authHeader() })
      if (res.ok) { const d = await res.json(); setMenuCats(d.categories ?? []); setActiveCat(d.categories?.[0]?.id ?? '') }
    } catch {}
  }

  function addToCart(p: MenuProduct) {
    setOrderCart(prev => {
      const ex = prev.find(c => c.productId === p.id)
      if (ex) return prev.map(c => c.productId === p.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { productId: p.id, name: productName(p, lang), price: p.price, qty: 1 }]
    })
  }

  function updateCartQty(productId: string, delta: number) {
    setOrderCart(prev => prev.map(c => c.productId === productId ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0))
  }

  async function submitOrder() {
    if (!orderTable || orderCart.length === 0 || !isPOS) return
    setOrderSubmitting(true); setOrderErr('')
    try {
      const res = await fetch('/api/pos/orders', {
        method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: orderTable.id, items: orderCart.map(c => ({ productId: c.productId, quantity: c.qty })), paymentMethod: 'CASH' }),
      })
      if (!res.ok) { const d = await res.json(); setOrderErr(wtOf(lang).failed); return }
      setLastOrderTable(orderTable)
      setOrderCart([]); setOrderTable(null); setOrderDone(true)
      setTimeout(() => setOrderDone(false), 3000)
    } catch { setOrderErr(wtOf(lang).networkError) }
    finally { setOrderSubmitting(false) }
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const activeNotifs  = useMemo(() => notifications.filter(n => n.isActive), [notifications])
  const alertCount    = activeNotifs.length + ready.length + newOrders.length + legacyCalls.length + bills.length
  const activeWaiters = useMemo(() => waiters.filter(w => w.shiftStatus === 'ACTIVE'), [waiters])
  const offWaiters    = useMemo(() => waiters.filter(w => w.shiftStatus === 'OFF_DUTY'), [waiters])
  const selfWaiter    = waiters.find(w => w.name === staffName) ?? null
  const selfTables    = selfWaiter?.assignedTables ?? []
  const visibleProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    return q
      ? menuCats.flatMap(c => c.products).filter(p =>
          (p.nameEn || '').toLowerCase().includes(q) || (p.nameAr || '').toLowerCase().includes(q))
      : (menuCats.find(c => c.id === activeCat)?.products ?? [])
  }, [productSearch, menuCats, activeCat])
  const cartTotal     = orderCart.reduce((s, c) => s + c.price * c.qty, 0)
  const cartQty       = orderCart.reduce((s, c) => s + c.qty, 0)

  // Shift clock
  const clockInIso   = selfWaiter?.clockInTime ?? null
  const shiftMinutes = clockInIso
    ? Math.floor((Date.now() - new Date(clockInIso).getTime()) / 60000)
    : 0
  const clockInStr   = clockInIso
    ? new Date(clockInIso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
    : null
  const passation    = shiftMinutes >= 450  // warn after 7h 30m

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes notif-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .notif-dot { animation: notif-pulse 1.2s ease-in-out infinite }
      `}</style>

      <div className="h-screen bg-slate-100 flex flex-col overflow-hidden text-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="shrink-0 bg-white border-b-2 border-emerald-300 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Left: cafe logo + name + waiter */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shrink-0 overflow-hidden">
                {cafeInfo.logoUrl
                  ? <Image src={cafeInfo.logoUrl} alt="logo" width={40} height={40} className="w-full h-full object-cover" />
                  : <Utensils className="w-4 h-4 text-emerald-600" />
                }
              </div>
              <div className="min-w-0">
                {cafeInfo.name && (
                  <p className="text-[11px] text-slate-400 font-medium truncate leading-none mb-0.5">{cafeInfo.name}</p>
                )}
                <p className="font-bold text-sm text-slate-800 leading-none truncate">
                  {staffName || w.roleWaiter}
                  <span className="ms-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
                    {roleLabel(staffRole, lang)}
                  </span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {clockInStr && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {clockInStr} · {shiftDuration(clockInIso, lang)}
                    </span>
                  )}
                  {connected
                    ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    : <WifiOff className="w-3 h-3 text-red-500" />
                  }
                </div>
              </div>
            </div>

            {/* Right: lang + logout */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex gap-0.5">
                {POS_LANGS.map(l => (
                  <button key={l.code} onClick={() => { saveLang(l.code); setLangState(l.code) }}
                    className={`w-7 h-7 rounded-lg text-sm transition-all ${lang === l.code ? 'bg-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}>
                    {l.flag}
                  </button>
                ))}
              </div>
              <button onClick={logout} title={w.logout} aria-label={w.logout}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition-all text-slate-500">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Passation banner — shown after 7h30m on shift */}
          {passation && (
            <div className="px-4 py-2 bg-amber-50 border-t-2 border-amber-200 flex items-center gap-2">
              <span className="text-base shrink-0">⚑</span>
              <p className="text-xs text-amber-700 font-medium">
                {w.handover(shiftDuration(clockInIso, lang) ?? '')}
              </p>
            </div>
          )}
        </header>

        {/* ── Action failure banner — actions update the UI optimistically, so a
            failed request must be surfaced, not silently swallowed ── */}
        {actionError && (
          <div className="shrink-0 bg-red-600 text-white text-sm font-bold px-4 py-2.5 flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" /> {actionError}
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-24">
          <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

            {/* ════ ALERTS TAB ════ */}
            {tab === 'alerts' && (
              <>
                {/* Active notifications — urgent (red frame) */}
                {activeNotifs.length > 0 && (
                  <div className="border-2 border-red-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-red-500 px-3 py-1.5"><Label text={w.urgent} count={activeNotifs.length} light /></div>
                    <div className="p-2 space-y-2 bg-red-50/50">
                    {activeNotifs.slice(0, 6).map(n => {
                      const m = NOTIF_META[n.type]
                      return (
                        <div key={n.orderId}
                          className={`bg-white border border-slate-200 border-l-4 ${m.border} rounded-2xl p-4 flex items-center gap-3 shadow-sm`}>
                          <span className="notif-dot text-2xl shrink-0">{m.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm">{w.table} {n.tableNumber ?? '?'}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{w[m.label]} · {elapsed(n.receivedAt, lang)}</p>
                          </div>
                          <button onClick={() => ackNotification(n.orderId)}
                            className={`shrink-0 ${m.btn} text-white text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-all`}>
                            {w.onMyWay}
                          </button>
                        </div>
                      )
                    })}
                    {activeNotifs.length > 6 && (
                      <p className="text-center text-xs text-slate-400 py-1">{w.more(activeNotifs.length - 6)}</p>
                    )}
                    </div>
                  </div>
                )}

                {/* Ready to serve (green frame) */}
                {ready.length > 0 && (
                  <div className="border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-emerald-500 px-3 py-1.5"><Label text={w.readyToServe} count={ready.length} light /></div>
                    <div className="p-2 space-y-2 bg-emerald-50/50">
                    {ready.map(order => {
                      const tableNum = (order.originalTable ?? order.table)?.tableNumber
                      return (
                        <div key={order.id} className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChefHat className="w-4 h-4 text-emerald-600" />
                              <span className="font-bold text-emerald-700 text-sm">{w.table} {tableNum ?? '?'}</span>
                              {order.seat && <span className="text-xs text-slate-400">· {w.seat(order.seat.seatNumber)}</span>}
                            </div>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{elapsed(order.createdAt, lang)}
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {order.items.map(item => (
                              <li key={item.id} className="text-sm text-slate-600 flex items-center gap-2">
                                <span className="text-emerald-600 font-bold">{item.quantity}×</span>
                                {productName(item.product, lang)}
                              </li>
                            ))}
                          </ul>
                          <button onClick={() => markServed(order.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> {w.served}
                          </button>
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )}

                {/* New orders (sky frame) */}
                {newOrders.length > 0 && (
                  <div className="border-2 border-sky-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-sky-500 px-3 py-1.5"><Label text={w.newOrders} count={newOrders.length} light /></div>
                    <div className="p-2 space-y-2 bg-sky-50/50">
                    {newOrders.map(o => (
                      <div key={o.orderId} className="bg-white border border-sky-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                        <span className="text-2xl shrink-0">📋</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{o.mergeLabel}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{o.totalPrice} · {elapsed(o.createdAt, lang)}</p>
                        </div>
                        <button onClick={() => setNewOrders(prev => prev.filter(x => x.orderId !== o.orderId))}
                          className="shrink-0 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">
                          {w.gotIt}
                        </button>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {/* Customer calls (slate frame) */}
                {legacyCalls.length > 0 && (
                  <div className="border-2 border-slate-300 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-500 px-3 py-1.5"><Label text={w.customerCalls} count={legacyCalls.length} light /></div>
                    <div className="p-2 space-y-2 bg-slate-50">
                    {legacyCalls.map(c => (
                      <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                        <span className="text-2xl shrink-0">
                          {c.type === 'WATER' ? '🧊' : c.type === 'CLEAN' ? '🧹' : '📣'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm">{w.table} {c.tableNumber ?? '?'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{c.type === 'WATER' ? w.callWater : c.type === 'CLEAN' ? w.callClean : w.callOther}{c.message ? ` · ${c.message}` : ''} · {elapsed(c.createdAt, lang)}</p>
                        </div>
                        <button onClick={() => ackLegacyCall(c.id)}
                          className="shrink-0 bg-slate-600 hover:bg-slate-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">
                          {w.done}
                        </button>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {/* Bill requests (violet frame) */}
                {bills.length > 0 && (
                  <div className="border-2 border-violet-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-violet-500 px-3 py-1.5"><Label text={w.billRequests} count={bills.length} light /></div>
                    <div className="p-2 space-y-2 bg-violet-50/50">
                    {bills.map(b => (
                      <div key={b.id} className="bg-white border border-violet-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                        <span className="text-2xl shrink-0">🧾</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm">{w.table} {b.tableNumber ?? '?'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {b.payScope === 'SEATS' && b.seatNumbers?.length
                              ? w.seats(b.seatNumbers.join(', '))
                              : w.wholeTable
                            } · {elapsed(b.createdAt, lang)}
                          </p>
                        </div>
                        <button onClick={() => setBills(prev => prev.filter(x => x.id !== b.id))}
                          className="shrink-0 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">
                          {w.paid}
                        </button>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {alertCount === 0 && (
                  <div className="text-center py-16 bg-white border-2 border-emerald-100 rounded-2xl">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <p className="font-bold text-slate-700">{w.allClear}</p>
                    <p className="text-sm text-slate-400 mt-1">{w.noAlerts}</p>
                  </div>
                )}
              </>
            )}

            {/* ════ TEAM TAB ════ */}
            {tab === 'team' && (
              <>
                {activeWaiters.length > 0 && (
                  <div className="border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-emerald-500 px-3 py-1.5"><Label text={w.onDuty} count={activeWaiters.length} light /></div>
                    <div className="p-2 space-y-2 bg-emerald-50/40">
                    {activeWaiters.map(w => {
                      const p    = PALETTES[waiters.indexOf(w) % PALETTES.length]
                      const myA  = activeNotifs.filter(n => n.tableId && w.assignedTables.some(t => t.id === n.tableId))
                      const dur  = shiftDuration(w.clockInTime, lang)
                      return (
                        <div key={w.id} className={`bg-white border rounded-2xl p-4 space-y-3 shadow-sm ${myA.length > 0 ? 'border-red-300' : 'border-slate-200'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`relative w-10 h-10 rounded-xl ${p.dot} flex items-center justify-center shrink-0`}>
                              <span className="text-white font-black text-xs">{initials(w.name)}</span>
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate">{w.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.badge} whitespace-nowrap`}>{roleLabel(w.role, lang)}</span>
                                {dur && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{dur}</span>}
                              </div>
                            </div>
                            {myA.length > 0 && (
                              <span className="w-6 h-6 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center animate-pulse shrink-0">
                                {myA.length}
                              </span>
                            )}
                          </div>
                          {w.assignedTables.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {w.assignedTables.map(t => {
                                const hasA = myA.some(n => n.tableId === t.id)
                                const isMine = w.id === selfWaiter?.id
                                const pillClass = `text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${hasA ? 'bg-red-100 text-red-600 ring-1 ring-red-300' : 'bg-slate-100 text-slate-500'} ${isMine ? 'active:scale-95' : ''}`
                                const label = `${wtOf(lang).tShort(t.tableNumber)}${t.zone ? ` · ${t.zone}` : ''}${hasA ? ' 🔔' : ''}`
                                return isMine ? (
                                  <button key={t.id} onClick={() => openManageTable(t)} className={pillClass}>{label}</button>
                                ) : (
                                  <span key={t.id} className={pillClass}>{label}</span>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">{wtOf(lang).noTables}</p>
                          )}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )}

                {offWaiters.length > 0 && (
                  <div className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-400 px-3 py-1.5"><Label text={w.offDuty} count={offWaiters.length} light /></div>
                    <div className="p-2 bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {offWaiters.map(w => {
                        const p = PALETTES[waiters.indexOf(w) % PALETTES.length]
                        return (
                          <div key={w.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2.5 opacity-70">
                            <div className={`w-8 h-8 rounded-lg ${p.dot} flex items-center justify-center shrink-0`}>
                              <span className="text-white font-black text-[10px]">{initials(w.name)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-700 truncate">{w.name}</p>
                              <p className="text-[10px] text-slate-400">{roleLabel(w.role, lang)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    </div>
                  </div>
                )}

                {waiters.length === 0 && (
                  <div className="text-center py-16 bg-white border-2 border-slate-200 rounded-2xl">
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-400 text-sm">{w.noStaff}</p>
                  </div>
                )}
              </>
            )}

            {/* ════ TODAY TAB ════ */}
            {tab === 'today' && (
              <div className="border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-emerald-500 px-3 py-1.5"><Label text={L('nav_today')} count={todayOrders.length} light /></div>
                <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-emerald-50/40">
                  {todayOrders.length === 0 && (
                    <div className="col-span-2 text-center py-16 text-slate-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm">{L('today_empty')}</p>
                    </div>
                  )}
                  {todayOrders.map(o => {
                    const tableNum = o.table?.tableNumber ?? o.originalTable?.tableNumber
                    const itemCount = o.items.reduce((s, it) => s + it.quantity, 0)
                    return (
                      <div key={o.id} className={`bg-white border rounded-2xl p-3 space-y-1.5 shadow-sm ${o.status === 'CANCELLED' ? 'border-red-200' : 'border-emerald-200'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-800">
                            {tableNum ? (o.seat?.seatNumber ? w.tableSeat(tableNum, o.seat.seatNumber) : w.tShort(tableNum)) : ''}
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${o.status === 'CANCELLED' ? 'text-red-500' : 'text-emerald-500'}`}>{o.status === 'CANCELLED' ? w.statusCancelled : w.statusCompleted}</span>
                        </div>
                        <p className="text-xs text-slate-500">{w.items(itemCount)}</p>
                        <p className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ════ ORDER TAB ════ */}
            {tab === 'order' && (
              <>
                {orderDone ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white border-2 border-emerald-200 rounded-2xl">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <p className="font-bold text-xl text-emerald-600">{L('order_sent')}</p>
                    <div className="flex gap-2 mt-2">
                      {lastOrderTable && (
                        <button onClick={() => { setOrderDone(false); setOrderTable(lastOrderTable); setProductSearch('') }}
                          className="px-5 py-3 bg-white border-2 border-emerald-300 text-emerald-700 rounded-xl font-bold text-sm active:scale-95 transition-all">
                          {w.table} {lastOrderTable.tableNumber} — {w.addMore}
                        </button>
                      )}
                      <button onClick={() => { setOrderDone(false); setOrderTable(null) }}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
                        {w.newOrder}
                      </button>
                    </div>
                  </div>
                ) : !orderTable ? (
                  <div className="border-2 border-sky-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-sky-500 px-3 py-1.5"><Label text={w.selectTable} count={selfTables.length} light /></div>
                    <div className="p-3 bg-sky-50/40">
                    {selfTables.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <p className="text-sm">{w.noTables}</p>
                        <p className="text-xs mt-1">{w.askSupervisor}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {selfTables.map(t => (
                          <button key={t.id} onClick={() => { setOrderTable(t); setProductSearch('') }}
                            className="bg-white border border-sky-200 hover:border-sky-400 rounded-2xl p-4 flex flex-col items-center gap-1 transition-all active:scale-95 shadow-sm">
                            <span className="text-2xl font-black text-slate-800">{t.tableNumber}</span>
                            <span className="text-[10px] text-slate-400">{w.table}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Table banner */}
                    <div className="flex items-center justify-between bg-emerald-100 border-2 border-emerald-300 rounded-2xl px-4 py-3">
                      <span className="font-black text-emerald-700">{w.table} {orderTable.tableNumber}</span>
                      <button onClick={() => { setOrderTable(null); setOrderCart([]); setProductSearch('') }}
                        className="text-xs bg-white hover:bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-emerald-700 transition-all">
                        {w.change}
                      </button>
                    </div>

                    {/* Product search — find an item across all categories in one go,
                        instead of hunting through category tabs during a rush */}
                    {menuCats.length > 0 && (
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          placeholder={w.searchPh}
                          className="w-full pl-10 pr-9 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {productSearch && (
                          <button onClick={() => setProductSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Category tabs — hidden while searching (results already span all categories) */}
                    {menuCats.length > 0 && !productSearch && (
                      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {menuCats.map(cat => (
                          <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                            className={`shrink-0 px-4 py-3 rounded-full text-xs font-bold transition-all ${
                              activeCat === cat.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800'
                            }`}>
                            {lang === 'ar' ? (cat.nameAr || cat.nameEn) : cat.nameEn}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Product grid */}
                    {menuCats.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <p className="text-sm">{w.loadingMenu}</p>
                      </div>
                    ) : (() => {
                      const q = productSearch.trim().toLowerCase()
                      if (q && visibleProducts.length === 0) {
                        return <p className="text-center text-sm text-slate-400 py-8">{w.noResults}</p>
                      }
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          {visibleProducts.map(p => {
                            const inCart = orderCart.find(c => c.productId === p.id)
                            return (
                              <button key={p.id} onClick={() => addToCart(p)}
                                className={`bg-white rounded-2xl border p-3 flex flex-col gap-2 text-left transition-all active:scale-95 shadow-sm ${
                                  inCart ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                                }`}>
                                <p className="font-bold text-slate-800 text-xs leading-snug">
                                  {lang === 'ar' ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)}
                                </p>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-emerald-600">{p.price} {cafeInfo.currency}</span>
                                  {inCart && (
                                    <span className="bg-emerald-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                                      {inCart.qty}
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })()}

                    {/* Cart */}
                    {orderCart.length > 0 && (
                      <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-3 shadow-sm">
                        <p className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-emerald-600" />
                          {w.items(cartQty)} · {cartTotal.toFixed(2)} {cafeInfo.currency}
                        </p>
                        <div className="space-y-2 max-h-44 overflow-y-auto">
                          {orderCart.map(c => (
                            <div key={c.productId} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 truncate">{c.name}</p>
                                <p className="text-xs text-slate-400">{c.price} × {c.qty} = {(c.price * c.qty).toFixed(2)} {cafeInfo.currency}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => updateCartQty(c.productId, -1)}
                                  className="w-11 h-11 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center active:scale-90 transition-all">
                                  {c.qty === 1 ? <Trash2 className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4 text-slate-500" />}
                                </button>
                                <span className="w-6 text-center font-bold text-sm text-slate-800">{c.qty}</span>
                                <button onClick={() => updateCartQty(c.productId, 1)}
                                  className="w-11 h-11 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center justify-center active:scale-90 transition-all">
                                  <Plus className="w-4 h-4 text-emerald-600" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {orderErr && <p className="text-sm text-red-500">{orderErr}</p>}
                        <button onClick={submitOrder} disabled={orderSubmitting}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                          {orderSubmitting
                            ? <span>{w.sending}</span>
                            : <><Send className="w-4 h-4" />{L('submit_order')}</>
                          }
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

          </div>
        </main>

        {/* ── Bottom nav ─────────────────────────────────────────────────── */}
        <nav className="shrink-0 fixed bottom-0 left-0 right-0 bg-white border-t-2 border-emerald-200 flex flex-col safe-bottom shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
          <p className="text-center text-[9px] text-slate-300 font-medium pt-1.5 select-none tracking-wide">
            Powered by <span className="text-slate-400">SmartRestau</span>
          </p>
          <div className="flex">
          {([
            {
              id: 'alerts' as const,
              icon: <Bell className="w-5 h-5" />,
              label: w.navAlerts,
              badge: alertCount,
            },
            {
              id: 'team' as const,
              icon: <Users className="w-5 h-5" />,
              label: w.navTeam,
              badge: activeWaiters.length,
            },
            {
              id: 'today' as const,
              icon: <CheckCircle2 className="w-5 h-5" />,
              label: L('nav_today'),
              badge: todayOrders.length,
            },
            {
              id: 'order' as const,
              icon: <ShoppingCart className="w-5 h-5" />,
              label: w.navOrder,
              badge: cartQty,
            },
          ] as const).map(item => (
            <button key={item.id}
              onClick={() => { if (item.id === 'order') { openOrderTab() } else { setTab(item.id); if (item.id === 'today') loadTodayOrders() } }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all relative ${
                tab === item.id ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <div className="relative">
                {item.icon}
                {item.badge > 0 && (
                  <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 text-[10px] font-black rounded-full flex items-center justify-center px-1 ${
                    item.id === 'alerts' && alertCount > 0
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-slate-300 text-slate-700'
                  }`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">{item.label}</span>
              {tab === item.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </button>
          ))}
          </div>
        </nav>

        {/* ── Manage table — zone + release, both existing endpoints with no prior UI ── */}
        {manageTable && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setManageTable(null)}>
            <div className="w-full max-w-md bg-white rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
              <h3 className="font-black text-lg text-slate-800">{w.table} {manageTable.tableNumber}</h3>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">{w.zone}</label>
                <input value={zoneInput} onChange={e => setZoneInput(e.target.value)}
                  placeholder={w.zonePh}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              {manageError && <p className="text-red-500 text-xs font-medium">{manageError}</p>}

              <button onClick={saveZone} disabled={savingZone || !zoneInput.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
                {savingZone ? w.saving : w.saveZone}
              </button>

              <button onClick={releaseTable} disabled={releasing}
                className="w-full py-3 bg-white border-2 border-red-200 hover:bg-red-50 disabled:opacity-40 text-red-600 rounded-xl font-bold text-sm active:scale-95 transition-all">
                {releasing ? w.releasing : w.releaseTable}
              </button>

              <button onClick={() => setManageTable(null)}
                className="w-full py-2 text-slate-400 text-sm font-medium">
                {w.cancel}
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ text, count, urgent, light }: { text: string; count: number; urgent?: boolean; light?: boolean }) {
  if (light) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-black uppercase tracking-widest text-white">{text}</span>
        {count > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/25 text-white">{count}</span>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 px-1 mb-1">
      <span className={`text-xs font-black uppercase tracking-widest ${urgent ? 'text-red-500' : 'text-slate-500'}`}>{text}</span>
      {count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${urgent ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
          {count}
        </span>
      )}
    </div>
  )
}
