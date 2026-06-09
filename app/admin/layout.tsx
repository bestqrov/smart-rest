'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, UtensilsCrossed, QrCode, Share2,
  CreditCard, LogOut, ChevronRight, Menu, X,
  AlertTriangle, Loader2, Gift, Zap, ChefHat, Bell, Monitor,
  Users, BarChart3, Copy, Check, ExternalLink, Building2,
  Banknote, Wallet, CalendarClock, Sparkles, Settings, Languages, TrendingUp, Film,
  Package, Lock
} from 'lucide-react'
import { AdminLangProvider, useLang, type AdminLang } from './lang-context'
import { A, type AdminT } from '@/lib/adminI18n'

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV = [
  { href: '/admin/dashboard',  icon: LayoutDashboard, key: 'dashboard'  },
  { href: '/admin/menu-gen',   icon: Sparkles,        key: 'menuAI'     },
  { href: '/admin/menu',       icon: UtensilsCrossed, key: 'menu'       },
  { href: '/admin/tables',     icon: QrCode,          key: 'tables'     },
  { href: '/admin/staff',      icon: Users,           key: 'staff'      },
  { href: '/admin/attendance', icon: CalendarClock,   key: 'attendance' },
  { href: '/admin/financials', icon: BarChart3,       key: 'financials' },
  { href: '/admin/margins',   icon: TrendingUp,      key: 'margins'    },
  { href: '/admin/marketing',  icon: Film,            key: 'marketing'  },
  { href: '/admin/social',     icon: Share2,          key: 'social'     },
  { href: '/admin/billing',    icon: CreditCard,      key: 'billing'    },
  { href: '/admin/settings',   icon: Settings,        key: 'settings'   },
] as const

const STAFF_LINKS = [
  { href: '/kitchen', icon: ChefHat,  key: 'kitchenKds' },
  { href: '/waiter',  icon: Bell,     key: 'waiterView'  },
  { href: '/pos',     icon: Monitor,  key: 'miniPos'     },
] as const

// ── Types ─────────────────────────────────────────────────────────────────────

type CafeState = {
  name: string
  subdomain: string
  billingStatus: string
  inTrial: boolean
  trialEndsAt: string | null
  hasExtendedTrial: boolean
  currency: string
  monthlyFee: number | null
  subscriptionTier: string | null
  logoUrl: string | null
  isSmartInventoryEnabled: boolean
}

// ── Payment Gate translations ─────────────────────────────────────────────────

const TG = {
  ar: {
    trialEnd:    'انتهت الفترة التجريبية',
    suspended:   'حسابك موقوف مؤقتاً',
    trialSub:    'لمواصلة استخدام Smart Resto، يُرجى إتمام دفع الاشتراك الشهري',
    suspendSub:  'لاستعادة الخدمة، يُرجى تسوية الفاتورة المستحقة',
    invoice:     'الفاتورة الشهرية',
    perMonth:    '/ شهر',
    tier:        'الباقة',
    tierEcon:    'اقتصادية (ECONOMY)',
    tierAdv:     'متقدمة (ADVANCED)',
    chooseMethod:'اختر طريقة الدفع',
    methodBank:  'تحويل بنكي',
    methodBankSub:'IBAN / SWIFT — بنوك مغربية في أفريقيا',
    methodWU:    'Western Union',
    methodWUSub: 'تحويل فوري دولي',
    methodPP:    'PayPal / بطاقة',
    methodPPSub: 'دفع إلكتروني فوري',
    bankName:    'البنك',
    acctName:    'اسم الحساب',
    iban:        'IBAN',
    swift:       'SWIFT / BIC',
    wuRecipient: 'اسم المستلم',
    wuCountry:   'الدولة',
    wuCity:      'المدينة',
    ppLink:      'رابط PayPal',
    ppNote:      'انقر لفتح صفحة الدفع، ثم أدخل رقم المعاملة أدناه',
    openPaypal:  'فتح PayPal',
    refLabel:    'مرجع التحويل / رقم المعاملة',
    refPh:       'رقم التأكيد أو المرجع الخاص بالتحويل',
    noteLabel:   'ملاحظة إضافية (اختياري)',
    notePh:      'مثال: المبلغ المحوَّل، تاريخ التحويل...',
    submit:      'إرسال إشعار الدفع ✉️',
    submitting:  'جارٍ الإرسال...',
    refRequired: 'يرجى إدخال رقم المرجع أو المعاملة',
    copy:        'نسخ',
    copied:      '✓',
    successTitle:'✅ تم إرسال الإشعار بنجاح',
    successMsg:  'تلقّى فريق Smart Resto إشعار دفعك وسيراجعه خلال 24 ساعة عمل. سيُفعَّل حسابك فور التأكيد — شكراً لثقتك.',
    altSep:      'أو اختر بديلاً مجانياً',
    altTitle:    'الباقة الذكية بالعمولة (بدون رسوم مسبقة)',
    altDesc:     'رسوم رمزية فقط على كل طلب مكتمل — بدون دفعات مسبقة. مناسبة للانطلاق الفوري.',
    altBtn:      'تفعيل الباقة الذكية',
    activating:  'جارٍ التفعيل...',
    extTitle:    'أو تمديد التجربة 7 أيام مقابل $5',
    extBtn:      'تمديد مقابل $5',
    lang:        'اللغة',
  },
  fr: {
    trialEnd:    "Période d'essai terminée",
    suspended:   'Compte suspendu',
    trialSub:    'Pour continuer à utiliser Smart Resto, veuillez régler votre abonnement mensuel',
    suspendSub:  'Pour rétablir le service, veuillez régler la facture en attente',
    invoice:     'Facture mensuelle',
    perMonth:    '/ mois',
    tier:        'Forfait',
    tierEcon:    'Économique (ECONOMY)',
    tierAdv:     'Avancé (ADVANCED)',
    chooseMethod:'Choisissez votre mode de paiement',
    methodBank:  'Virement bancaire',
    methodBankSub:'IBAN / SWIFT — Banques marocaines en Afrique',
    methodWU:    'Western Union',
    methodWUSub: 'Envoi rapide international',
    methodPP:    'PayPal / Carte',
    methodPPSub: 'Paiement en ligne immédiat',
    bankName:    'Banque',
    acctName:    'Nom du compte',
    iban:        'IBAN',
    swift:       'SWIFT / BIC',
    wuRecipient: 'Destinataire',
    wuCountry:   'Pays',
    wuCity:      'Ville',
    ppLink:      'Lien PayPal',
    ppNote:      'Cliquez pour ouvrir la page de paiement, puis entrez le numéro de transaction ci-dessous',
    openPaypal:  'Ouvrir PayPal',
    refLabel:    'Référence / N° de transaction',
    refPh:       'N° de confirmation ou référence du virement',
    noteLabel:   'Note supplémentaire (optionnel)',
    notePh:      'Ex: montant envoyé, date du virement...',
    submit:      'Envoyer la preuve de paiement ✉️',
    submitting:  'Envoi en cours...',
    refRequired: 'Veuillez entrer la référence ou le numéro de transaction',
    copy:        'Copier',
    copied:      '✓',
    successTitle:'✅ Notification envoyée avec succès',
    successMsg:  "L'équipe Smart Resto a reçu votre notification et la vérifiera dans les 24h ouvrables. Votre compte sera activé dès confirmation — merci de votre confiance.",
    altSep:      'Ou choisissez une alternative gratuite',
    altTitle:    'Commission intelligente (sans frais initiaux)',
    altDesc:     'Frais symboliques uniquement sur chaque commande complétée — sans paiement initial. Idéal pour démarrer rapidement.',
    altBtn:      'Activer la commission intelligente',
    activating:  'Activation...',
    extTitle:    'Ou prolongez l\'essai 7 jours pour $5',
    extBtn:      'Prolonger pour $5',
    lang:        'Langue',
  },
  en: {
    trialEnd:    'Trial period ended',
    suspended:   'Account suspended',
    trialSub:    'To continue using Smart Resto, please complete your monthly subscription payment',
    suspendSub:  'To restore service, please settle your outstanding invoice',
    invoice:     'Monthly Invoice',
    perMonth:    '/ month',
    tier:        'Plan',
    tierEcon:    'Economy (ECONOMY)',
    tierAdv:     'Advanced (ADVANCED)',
    chooseMethod:'Choose payment method',
    methodBank:  'Bank Transfer',
    methodBankSub:'IBAN / SWIFT — Moroccan banks in Africa',
    methodWU:    'Western Union',
    methodWUSub: 'International fast transfer',
    methodPP:    'PayPal / Card',
    methodPPSub: 'Instant online payment',
    bankName:    'Bank',
    acctName:    'Account Name',
    iban:        'IBAN',
    swift:       'SWIFT / BIC',
    wuRecipient: 'Recipient Name',
    wuCountry:   'Country',
    wuCity:      'City',
    ppLink:      'PayPal Link',
    ppNote:      'Click to open the payment page, then enter your transaction number below',
    openPaypal:  'Open PayPal',
    refLabel:    'Transfer Reference / Transaction #',
    refPh:       'Confirmation number or transfer reference',
    noteLabel:   'Additional note (optional)',
    notePh:      'e.g. amount sent, transfer date...',
    submit:      'Send Payment Notification ✉️',
    submitting:  'Sending...',
    refRequired: 'Please enter the reference or transaction number',
    copy:        'Copy',
    copied:      '✓',
    successTitle:'✅ Notification sent successfully',
    successMsg:  'The Smart Resto team received your payment notification and will review it within 24 business hours. Your account will be activated upon confirmation — thank you for your trust.',
    altSep:      'Or choose a free alternative',
    altTitle:    'Smart Commission model (no upfront fees)',
    altDesc:     'Nominal fees only on each completed order — no upfront payments. Perfect for getting started immediately.',
    altBtn:      'Activate Smart Commission',
    activating:  'Activating...',
    extTitle:    'Or extend trial 7 days for $5',
    extBtn:      'Extend for $5',
    lang:        'Language',
  },
  es: {
    trialEnd:    'Período de prueba terminado',
    suspended:   'Cuenta suspendida',
    trialSub:    'Para continuar usando Smart Resto, complete el pago mensual de su suscripción',
    suspendSub:  'Para restaurar el servicio, liquide su factura pendiente',
    invoice:     'Factura mensual',
    perMonth:    '/ mes',
    tier:        'Plan',
    tierEcon:    'Económico (ECONOMY)',
    tierAdv:     'Avanzado (ADVANCED)',
    chooseMethod:'Elige tu método de pago',
    methodBank:  'Transferencia bancaria',
    methodBankSub:'IBAN / SWIFT — Bancos marroquíes en África',
    methodWU:    'Western Union',
    methodWUSub: 'Envío internacional rápido',
    methodPP:    'PayPal / Tarjeta',
    methodPPSub: 'Pago en línea inmediato',
    bankName:    'Banco',
    acctName:    'Nombre de cuenta',
    iban:        'IBAN',
    swift:       'SWIFT / BIC',
    wuRecipient: 'Destinatario',
    wuCountry:   'País',
    wuCity:      'Ciudad',
    ppLink:      'Enlace PayPal',
    ppNote:      'Haz clic para abrir la página de pago, luego ingresa el número de transacción a continuación',
    openPaypal:  'Abrir PayPal',
    refLabel:    'Referencia / N° de transacción',
    refPh:       'N° de confirmación o referencia de transferencia',
    noteLabel:   'Nota adicional (opcional)',
    notePh:      'Ej: monto enviado, fecha de transferencia...',
    submit:      'Enviar comprobante de pago ✉️',
    submitting:  'Enviando...',
    refRequired: 'Ingresa la referencia o el número de transacción',
    copy:        'Copiar',
    copied:      '✓',
    successTitle:'✅ Notificación enviada con éxito',
    successMsg:  'El equipo de Smart Resto recibió tu comprobante y lo revisará en 24 horas hábiles. Tu cuenta se activará tras la confirmación — gracias por tu confianza.',
    altSep:      'O elige una alternativa gratuita',
    altTitle:    'Modelo de comisión inteligente (sin costos iniciales)',
    altDesc:     'Cargos nominales solo en cada pedido completado — sin pagos anticipados. Perfecto para comenzar de inmediato.',
    altBtn:      'Activar comisión inteligente',
    activating:  'Activando...',
    extTitle:    'O extiende la prueba 7 días por $5',
    extBtn:      'Extender por $5',
    lang:        'Idioma',
  },
}

type TGLang = keyof typeof TG
type PayMethod = 'BANK_TRANSFER' | 'WESTERN_UNION' | 'PAYPAL'

// ── Payment details (update these with your real banking info) ────────────────
const BANK_INFO = {
  bankName:    process.env.NEXT_PUBLIC_PAYMENT_BANK_NAME    ?? 'Attijariwafa Bank',
  acctName:    process.env.NEXT_PUBLIC_PAYMENT_BANK_ACCOUNT ?? 'Smart Resto SaaS',
  iban:        process.env.NEXT_PUBLIC_PAYMENT_BANK_IBAN    ?? 'MA64 0115 1900 0001 2345 6789 0123',
  swift:       process.env.NEXT_PUBLIC_PAYMENT_BANK_SWIFT   ?? 'BCMAMAMC',
}
const WU_INFO = {
  name:    process.env.NEXT_PUBLIC_PAYMENT_WU_NAME    ?? 'Smart Resto',
  country: process.env.NEXT_PUBLIC_PAYMENT_WU_COUNTRY ?? 'Morocco',
  city:    process.env.NEXT_PUBLIC_PAYMENT_WU_CITY    ?? 'Casablanca',
}
const PAYPAL_LINK = process.env.NEXT_PUBLIC_PAYPAL_LINK ?? 'https://paypal.me/smartresto'

// ── AdminLayout ───────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLangProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminLangProvider>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { lang, isRTL } = useLang()
  const t = A[lang]
  const [open, setOpen]   = useState(false)
  const [cafe, setCafe]   = useState<CafeState | null>(null)
  const [gateAction, setGateAction] = useState<string | null>(null)

  function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

  async function loadCafe() {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    const [profile, finance] = await Promise.all([
      fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/finance/status',     { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ])
    if (profile) {
      if (!profile.isProfileComplete && !pathname.startsWith('/admin/onboarding')) {
        router.replace('/admin/onboarding')
        return
      }
      setCafe({
        name:                    profile.businessName || profile.name,
        subdomain:               profile.subdomain,
        billingStatus:           profile.billingStatus,
        inTrial:                 finance?.inTrial ?? false,
        trialEndsAt:             finance?.trialEndsAt ?? null,
        hasExtendedTrial:        profile.hasExtendedTrial ?? false,
        currency:                profile.currency ?? 'MAD',
        monthlyFee:              finance?.monthlyFee ?? profile.monthlyFee ?? null,
        subscriptionTier:        finance?.subscriptionTier ?? profile.subscriptionTier ?? null,
        logoUrl:                 profile.logoUrl ?? null,
        isSmartInventoryEnabled: profile.isSmartInventoryEnabled ?? false,
      })
    }
  }

  useEffect(() => { loadCafe() }, [router, pathname])

  async function doGateAction(endpoint: string) {
    setGateAction(endpoint)
    await fetch(`/api/finance/${endpoint}`, { method: 'POST', headers: authHeader() })
    setGateAction(null)
    await loadCafe()
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('cafeId')
    router.push('/landing')
  }

  const billingBadge: Record<string, string> = {
    GRACE_PERIOD:    'bg-amber-100 text-amber-700',
    COLLECTING_DEBT: 'bg-blue-100  text-blue-700',
    SUSPENDED:       'bg-red-100   text-red-700'
  }
  const billingLabel: Record<string, string> = {
    GRACE_PERIOD:    t.statusTrial,
    COLLECTING_DEBT: t.statusActive,
    SUSPENDED:       t.statusSuspend,
  }

  const showPaymentGate = cafe
    && pathname !== '/admin/billing'
    && !pathname.startsWith('/admin/onboarding')
    && (
      (!cafe.inTrial && cafe.billingStatus === 'GRACE_PERIOD') ||
      cafe.billingStatus === 'SUSPENDED'
    )

  return (
    <div className="min-h-screen bg-gray-50 flex" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Sidebar (desktop) ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1a2744] min-h-screen shrink-0">
        <div className="px-5 py-5 border-b border-[#243460]">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            {cafe?.logoUrl ? (
              <img
                src={cafe.logoUrl}
                alt={cafe.name}
                className="w-9 h-9 rounded-lg object-contain aspect-square bg-white/10 shrink-0 border border-gray-700"
              />
            ) : (
              <Image src="/assets/logo.png" alt="Smart Menu" width={36} height={36} className="rounded-lg shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm">SmartMenu</div>
              {cafe && <div className="text-gray-400 text-xs truncate">{cafe.subdomain}.smartmenu.ma</div>}
            </div>
          </Link>
          {/* Cafe name under the logo row */}
          {cafe?.name && (
            <p className="text-gray-300 text-xs font-semibold mt-2 truncate">{cafe.name}</p>
          )}
        </div>

        {cafe && (
          <div className="px-5 py-3 border-b border-[#243460]">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${billingBadge[cafe.billingStatus] || 'bg-gray-700 text-gray-300'}`}>
              {billingLabel[cafe.billingStatus] || cafe.billingStatus}
            </span>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                  active ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-[#243460] hover:text-white'
                }`}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium flex-1">{t[item.key as keyof AdminT]}</span>
                {active && <ChevronRight className={`w-4 h-4 opacity-70 ${!isRTL ? 'rotate-180' : ''}`} />}
              </Link>
            )
          })}

          {/* ── Smart Inventory (premium gated item) ────────────────── */}
          {cafe && (
            <Link href="/admin/inventory"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative ${
                pathname.startsWith('/admin/inventory')
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:bg-[#243460] hover:text-white'
              }`}>
              <Package className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium flex-1">
                {lang === 'ar' ? 'المخزون' : lang === 'fr' ? 'Inventaire' : 'Inventory'}
              </span>
              {!cafe.isSmartInventoryEnabled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Lock className="w-2.5 h-2.5" />
                  PRO
                </span>
              )}
              {pathname.startsWith('/admin/inventory') && (
                <ChevronRight className={`w-4 h-4 opacity-70 ${!isRTL ? 'rotate-180' : ''}`} />
              )}
            </Link>
          )}
        </nav>

        <div className="px-3 pb-3 border-t border-[#243460] pt-3">
          <p className="text-xs text-gray-600 uppercase tracking-widest px-2 mb-2">{t.staffScreens}</p>
          {STAFF_LINKS.map(item => (
            <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-[#243460] hover:text-white transition-colors group mb-1">
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium flex-1">{t[item.key as keyof AdminT]}</span>
              <span className="text-gray-700 text-xs group-hover:text-gray-500">↗</span>
            </a>
          ))}
        </div>

        <div className="px-3 py-3 border-t border-[#243460] space-y-1">
          <LangSwitcherSidebar />
          <button onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:bg-[#243460] hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="text-sm">{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-[#1a2744] px-4 py-3 flex items-center justify-between">
        <button onClick={() => setOpen(true)} className="text-gray-300 p-1">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          {cafe?.logoUrl ? (
            <img src={cafe.logoUrl} alt={cafe.name} className="w-7 h-7 rounded-lg object-contain aspect-square bg-white/10" />
          ) : (
            <Image src="/assets/logo.png" alt="Smart Menu" width={28} height={28} className="rounded-lg" />
          )}
          <span className="text-white font-bold text-sm truncate max-w-[140px]">
            {cafe?.name || 'SmartMenu'}
          </span>
        </div>
        <div className="w-8" />
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative bg-[#1a2744] w-72 h-full flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="px-4 py-4 flex items-center justify-between border-b border-[#243460]">
              <div className="flex items-center gap-2">
                {cafe?.logoUrl ? (
                  <img src={cafe.logoUrl} alt={cafe.name} className="w-8 h-8 rounded-lg object-contain aspect-square bg-white/10" />
                ) : (
                  <Image src="/assets/logo.png" alt="Smart Menu" width={32} height={32} className="rounded-lg" />
                )}
                <span className="text-white font-bold truncate max-w-[140px]">{cafe?.name || 'SmartMenu'}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            {cafe && (
              <div className="px-4 py-3 border-b border-[#243460]">
                <p className="text-gray-400 text-xs truncate">{cafe.subdomain}.smartmenu.ma</p>
                <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${billingBadge[cafe.billingStatus] || ''}`}>
                  {billingLabel[cafe.billingStatus] || cafe.billingStatus}
                </span>
              </div>
            )}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV.map((item) => {
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl ${
                      active ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-[#243460] hover:text-white'
                    }`}>
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{t[item.key as keyof AdminT]}</span>
                  </Link>
                )
              })}

              {/* Smart Inventory (gated) */}
              {cafe && (
                <Link href="/admin/inventory" onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl ${
                    pathname.startsWith('/admin/inventory')
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-400 hover:bg-[#243460] hover:text-white'
                  }`}>
                  <Package className="w-5 h-5" />
                  <span className="font-medium flex-1">
                    {lang === 'ar' ? 'المخزون' : lang === 'fr' ? 'Inventaire' : 'Inventory'}
                  </span>
                  {!cafe.isSmartInventoryEnabled && (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </Link>
              )}
            </nav>
            <div className="px-3 py-4 border-t border-[#243460] space-y-1">
              <LangSwitcherSidebar />
              <button onClick={logout}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-gray-400 hover:bg-[#243460] hover:text-red-400">
                <LogOut className="w-5 h-5" />
                <span>{t.logout}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ──────────────────────────────────────────── */}
      <main className="flex-1 md:overflow-y-auto pt-14 md:pt-0 relative">
        {/* Watermark — cafe logo at 5% opacity fixed behind all content */}
        {cafe?.logoUrl && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat bg-contain opacity-[0.05]"
            style={{ backgroundImage: `url(${cafe.logoUrl})` }}
          />
        )}
        <div className="relative z-10">
          {children}
        </div>
      </main>

      {/* ── Payment Gate overlay ──────────────────────────────────── */}
      {showPaymentGate && cafe && (
        <PaymentGate
          cafe={cafe}
          doAction={doGateAction}
          actionInFlight={gateAction}
        />
      )}
    </div>
  )
}

// ── LangSwitcherSidebar ───────────────────────────────────────────────────────

function LangSwitcherSidebar() {
  const { lang, setLang } = useLang()
  const LANGS: { code: AdminLang; flag: string }[] = [
    { code: 'ar', flag: '🇲🇦' },
    { code: 'en', flag: '🇬🇧' },
    { code: 'fr', flag: '🇫🇷' },
    { code: 'es', flag: '🇪🇸' },
  ]
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <Languages className="w-4 h-4 text-gray-500 shrink-0" />
      <div className="flex gap-0.5 flex-1">
        {LANGS.map(({ code, flag }) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${
              lang === code
                ? 'bg-emerald-600 text-white'
                : 'text-gray-500 hover:bg-[#243460] hover:text-white'
            }`}
          >
            {flag} {code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── PaymentGate ───────────────────────────────────────────────────────────────

function PaymentGate({
  cafe,
  doAction,
  actionInFlight,
}: {
  cafe: CafeState
  doAction: (endpoint: string) => Promise<void>
  actionInFlight: string | null
}) {
  const [lang,      setLang]      = useState<TGLang>('ar')
  const [method,    setMethod]    = useState<PayMethod>('BANK_TRANSFER')
  const [reference, setReference] = useState('')
  const [note,      setNote]      = useState('')
  const [submitting,setSubmitting]= useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [copied,    setCopied]    = useState<string | null>(null)
  const [invoice,   setInvoice]   = useState<{
    amount: number; commissionDebt: number; maintenanceFee: number
    maintenancePack: boolean; currency: string; tier: string | null
    billingCycle: number; nextBillingDate: string | null
    isFreeSubscription: boolean
  } | null>(null)

  const t     = TG[lang]
  const isRTL = lang === 'ar'
  const suspended = cafe.billingStatus === 'SUSPENDED'

  // Fetch invoice on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/finance/subscription-invoice', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setInvoice(d))
  }, [])

  const amount           = invoice?.amount          ?? 0
  const commissionDebt   = invoice?.commissionDebt  ?? 0
  const maintenanceFee   = invoice?.maintenanceFee  ?? 0
  const currency         = invoice?.currency        ?? cafe.currency ?? 'MAD'
  const tier             = invoice?.tier            ?? cafe.subscriptionTier ?? null
  const billingCycle     = invoice?.billingCycle    ?? 15
  const nextBillingDate  = invoice?.nextBillingDate ?? null
  const hasMaintenance   = invoice?.maintenancePack ?? false

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  async function handleSubmit() {
    if (!reference.trim()) { setSubmitErr(t.refRequired); return }
    setSubmitErr('')
    setSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/finance/payment-request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ method, reference: reference.trim(), proofNote: note.trim() || undefined, amount, currency }),
      })
      if (res.ok) setSubmitted(true)
      else {
        const body = await res.json().catch(() => ({}))
        setSubmitErr((body as { error?: string }).error ?? 'Error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      type="button"
      onClick={() => copyText(text, id)}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-600 transition-colors shrink-0"
    >
      {copied === id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied === id ? t.copied : t.copy}
    </button>
  )

  const InfoRow = ({ label, value, copyId }: { label: string; value: string; copyId: string }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 w-20">{label}</span>
      <span className="text-sm font-mono font-semibold text-slate-800 flex-1 break-all">{value}</span>
      <CopyBtn text={value} id={copyId} />
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-4">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-3xl px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-extrabold text-base">
                  {suspended ? t.suspended : t.trialEnd}
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  {suspended ? t.suspendSub : t.trialSub}
                </p>
              </div>
            </div>
            {/* Lang switcher */}
            <div className="flex gap-1">
              {(Object.keys(TG) as TGLang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                    lang === l ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Invoice chip — commission-based model */}
          <div className="bg-white/10 rounded-2xl px-4 py-3 space-y-2">
            {/* Free subscription badge */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                🆓 {lang === 'ar' ? 'اشتراك مجاني' : lang === 'fr' ? 'Abonnement gratuit' : 'Free Subscription'}
              </span>
              <span className="text-[10px] text-slate-500">
                {lang === 'ar' ? `دورة ${billingCycle} يوم` : lang === 'fr' ? `Cycle ${billingCycle}j` : `${billingCycle}-day cycle`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{lang === 'ar' ? 'عمولة متراكمة' : lang === 'fr' ? 'Commission cumulée' : 'Accumulated commission'}</span>
                  <span className="text-white font-bold">{commissionDebt.toFixed(2)} {currency}</span>
                </div>
                {hasMaintenance && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{lang === 'ar' ? 'صيانة وخدمة' : lang === 'fr' ? 'Maintenance' : 'Maintenance'}</span>
                    <span className="text-amber-300 font-bold">+ ${maintenanceFee}</span>
                  </div>
                )}
              </div>
              <div className="text-end">
                <p className="text-slate-400 text-xs">{lang === 'ar' ? 'المجموع المستحق' : lang === 'fr' ? 'Total dû' : 'Total due'}</p>
                <span className="text-3xl font-extrabold text-amber-400">{amount > 0 ? amount.toFixed(2) : '0.00'}</span>
                {' '}<span className="text-amber-300 font-semibold text-sm">{currency}</span>
                {nextBillingDate && (
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {lang === 'ar' ? 'موعد الدفع:' : lang === 'fr' ? 'Échéance:' : 'Due:'}{' '}
                    {new Date(nextBillingDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5">

          {submitted ? (
            /* ── Success screen ─────────────────────────────────── */
            <div className="text-center py-4 space-y-3">
              <div className="text-5xl">✅</div>
              <h3 className="text-lg font-extrabold text-slate-800">{t.successTitle}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{t.successMsg}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 mt-2">
                ⏱ 24h max
              </div>
            </div>
          ) : (
            <>
              {/* ── Method tabs ──────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t.chooseMethod}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'BANK_TRANSFER' as PayMethod, icon: Building2, label: t.methodBank,  sub: t.methodBankSub },
                    { key: 'WESTERN_UNION' as PayMethod, icon: Banknote,  label: t.methodWU,    sub: t.methodWUSub   },
                    { key: 'PAYPAL'        as PayMethod, icon: Wallet,    label: t.methodPP,    sub: t.methodPPSub   },
                  ] as const).map(({ key, icon: Icon, label, sub }) => (
                    <button key={key} type="button" onClick={() => setMethod(key)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center transition-all ${
                        method === key
                          ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                          : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-slate-50'
                      }`}>
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-xs font-bold leading-tight">{label}</span>
                      <span className="text-[10px] opacity-70 leading-tight hidden sm:block">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Method details ───────────────────────────────── */}
              <div className="bg-slate-50 rounded-2xl p-4">
                {method === 'BANK_TRANSFER' && (
                  <div className="space-y-0">
                    <InfoRow label={t.bankName} value={BANK_INFO.bankName} copyId="bankName" />
                    <InfoRow label={t.acctName} value={BANK_INFO.acctName} copyId="acctName" />
                    <InfoRow label={t.iban}     value={BANK_INFO.iban}     copyId="iban" />
                    <InfoRow label={t.swift}    value={BANK_INFO.swift}    copyId="swift" />
                    {amount > 0 && (
                      <InfoRow label="Montant" value={`${amount} ${currency}`} copyId="amount" />
                    )}
                  </div>
                )}

                {method === 'WESTERN_UNION' && (
                  <div className="space-y-0">
                    <InfoRow label={t.wuRecipient} value={WU_INFO.name}    copyId="wuName" />
                    <InfoRow label={t.wuCountry}   value={WU_INFO.country} copyId="wuCountry" />
                    <InfoRow label={t.wuCity}      value={WU_INFO.city}    copyId="wuCity" />
                    {amount > 0 && (
                      <InfoRow label="Montant" value={`${amount} ${currency}`} copyId="wuAmount" />
                    )}
                  </div>
                )}

                {method === 'PAYPAL' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">{t.ppNote}</p>
                    <a
                      href={`${PAYPAL_LINK}/${amount}${currency}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-[#0070ba] hover:bg-[#005ea6] text-white rounded-xl font-bold text-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t.openPaypal} {amount > 0 ? `— ${amount} ${currency}` : ''}
                    </a>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="flex-1 h-px bg-slate-200" />
                      {t.ppLink}: <span className="font-mono text-slate-600">{PAYPAL_LINK}</span>
                      <CopyBtn text={PAYPAL_LINK} id="ppLink" />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Reference input ──────────────────────────────── */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
                    🔢 {t.refLabel}
                  </label>
                  <input
                    value={reference}
                    onChange={e => { setReference(e.target.value); setSubmitErr('') }}
                    placeholder={t.refPh}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
                    📝 {t.noteLabel}
                  </label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder={t.notePh}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
                  />
                </div>

                {submitErr && (
                  <p className="text-red-500 text-xs font-medium">{submitErr}</p>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-amber-500/20"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.submitting}</>
                    : t.submit
                  }
                </button>
              </div>

              {/* ── Alternative: AI Commission ───────────────────── */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400 shrink-0">{t.altSep}</span>
                  <span className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold text-emerald-800">{t.altTitle}</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">{t.altDesc}</p>
                  <button
                    onClick={() => doAction('accept-ai-package')}
                    disabled={!!actionInFlight}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                  >
                    {actionInFlight === 'accept-ai-package'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Zap className="w-4 h-4" />
                    }
                    {actionInFlight === 'accept-ai-package' ? t.activating : t.altBtn}
                  </button>
                </div>

                {!cafe.hasExtendedTrial && (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-violet-600 shrink-0" />
                      <span className="text-xs text-violet-700 font-medium">{t.extTitle}</span>
                    </div>
                    <button
                      onClick={() => doAction('extend-trial')}
                      disabled={!!actionInFlight}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-60 shrink-0"
                    >
                      {actionInFlight === 'extend-trial'
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Gift className="w-3 h-3" />
                      }
                      {t.extBtn}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
