"use client"

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  QrCode, Zap, BarChart3, Globe, Star, CheckCircle, Menu, X,
  MessageCircle, ArrowRight, Loader2, Smartphone, ChefHat,
  Users, CreditCard, Bell, Languages, Layers, TrendingUp,
  Shield, Clock, Phone, Mail, MapPin, ChevronDown, ChevronUp,
  Utensils, Coffee, Building2, ShoppingBag, Play
} from 'lucide-react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '500+', label: 'مطعم ومقهى', labelFr: 'Restaurants' },
  { value: '3', label: 'دول مخدومة', labelFr: 'Pays couverts' },
  { value: '50K+', label: 'طلب يومياً', labelFr: 'Commandes/jour' },
  { value: '4.9★', label: 'تقييم المطاعم', labelFr: 'Note moyenne' },
]

const INDUSTRIES = [
  { icon: Utensils,   title: 'المطاعم',        titleFr: 'Restaurants',    desc: 'منيو QR، طلبات فورية، متابعة المطبخ KDS، إحصاءات مبيعات',  color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400', iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100' },
  { icon: Coffee,     title: 'المقاهي',         titleFr: 'Cafés & Snacks', desc: 'قائمة مشروبات، طلبات بالمقعد، نظام دمج الطاولات للمجموعات', color: 'bg-amber-50 border-amber-200 hover:border-amber-400',     iconColor: 'text-amber-600',  iconBg: 'bg-amber-100'  },
  { icon: Building2,  title: 'الفنادق',         titleFr: 'Hôtels & Resorts', desc: 'خدمة الغرف، منيو الموبايل، فواتير مخصصة لكل غرفة',        color: 'bg-sky-50 border-sky-200 hover:border-sky-400',           iconColor: 'text-sky-600',    iconBg: 'bg-sky-100'    },
  { icon: ShoppingBag, title: 'فود كورت',       titleFr: 'Food Courts',    desc: 'منيو موحد لعدة أجنحة، تتبع الطلبات، نظام الكوبونات والعروض', color: 'bg-rose-50 border-rose-200 hover:border-rose-400',         iconColor: 'text-rose-600',   iconBg: 'bg-rose-100'   },
]

const FEATURES = [
  { icon: QrCode,      title: 'QR Menu بدون تطبيق',     titleFr: 'Menu QR — Sans App',            desc: 'يمسح الزبون الكود ويطلب مباشرة — لا تحميل، لا إنشاء حساب. يعمل على أي هاتف.' },
  { icon: Zap,         title: 'طلبات فورية للمطبخ',     titleFr: 'Commandes Instantanées',         desc: 'الطلب يصل للمطبخ في الثانية — مع صوت تنبيه وشاشة KDS مخصصة للشيف.' },
  { icon: Languages,   title: 'متعدد اللغات',           titleFr: 'Multi-langues',                  desc: 'المنيو بالعربية، الفرنسية، الإنجليزية — السياح والمحليين يطلبون بسهولة.' },
  { icon: Layers,      title: 'دمج الطاولات',           titleFr: 'Fusion de Tables',               desc: 'مجموعات كبيرة؟ ادمج طاولتين بضغطة واحدة — فاتورة موحدة لكل المجموعة.' },
  { icon: BarChart3,   title: 'إحصاءات ذكية',           titleFr: 'Analytics Avancés',              desc: 'اعرف الأطباق الأكثر مبيعاً، أوقات الذروة، ومتوسط إنفاق كل طاولة.' },
  { icon: Star,        title: 'تقييمات Google',         titleFr: 'Avis Google Auto',               desc: 'نشجع زبائنك يكتبوا تقييم بعد كل طلب — مطعمك يصعد في نتائج البحث.' },
  { icon: Smartphone,  title: 'لوحة تحكم موبايل',      titleFr: 'Dashboard Mobile',               desc: 'تابع طلباتك، عدّل المنيو، وشوف الإحصاءات من هاتفك في أي مكان.' },
  { icon: Shield,      title: 'نظام الفوترة الذكي',    titleFr: 'Facturation Pay-per-Order',      desc: 'تدفع فقط على الطلبات المكتملة — لا اشتراك شهري ثابت خلال التجربة.' },
  { icon: Bell,        title: 'استدعاء النادل',         titleFr: 'Appel Serveur',                  desc: 'زر واحد يستدعي النادل — الزبون لا يحتاج يقوم أو ينادي.' },
  { icon: CreditCard,  title: 'طلب الحساب',             titleFr: 'Demande d\'Addition',            desc: 'الزبون يطلب الحساب مباشرة من هاتفه — بالكاش أو البطاقة أو أبل باي.' },
  { icon: ChefHat,     title: 'شاشة المطبخ KDS',        titleFr: 'Kitchen Display System',         desc: 'شاشة مخصصة للمطبخ تعرض الطلبات بالترتيب مع توقيت إعداد كل طبق.' },
  { icon: TrendingUp,  title: 'تسويق ذاتي بالصور',     titleFr: 'Marketing Viral',                desc: 'فلتر مبرمج على صور الطبق — الزبون يشاركها على إنستغرام وسناب ومطعمك يتسوق.' },
]

const HOW_IT_WORKS = [
  { step: '01', icon: MessageCircle, title: 'سجّل بواتساب',    titleFr: 'Inscription WhatsApp', desc: 'أدخل رقم واتساب — نرسل لك رابط الدخول فوراً. لا إيميل ولا كلمة مرور.' },
  { step: '02', icon: QrCode,        title: 'أضف منيوك',        titleFr: 'Créez votre Menu',     desc: 'أضف أصنافك بالعربية والفرنسية — أو استخدم منيونا التجريبي الجاهز.' },
  { step: '03', icon: Utensils,      title: 'اطبع QR الطاولات', titleFr: 'Imprimez les QR',      desc: 'اطبع ملصق QR لكل طاولة — كل مقعد عنده رمز خاص.' },
  { step: '04', icon: Zap,           title: 'استقبل الطلبات',   titleFr: 'Recevez les Commandes', desc: 'الزبون يمسح ويطلب — أنت تستقبل فوراً على لوحة التحكم والمطبخ.' },
]

const MARKETS = [
  {
    flag: '🇲🇦', country: 'المغرب', countryFr: 'Maroc', currency: 'MAD',
    color: 'from-emerald-700 to-emerald-900',
    pricing: [
      { range: 'أقل من 20 درهم', fee: '1 درهم' },
      { range: '20 — 50 درهم',   fee: '3 دراهم' },
      { range: '50 — 100 درهم',  fee: '5-7 دراهم' },
      { range: 'أكثر من 100',    fee: '10-15 درهم' },
    ],
    cities: 'أكادير · مراكش · كازابلانكا · فاس · الرباط'
  },
  {
    flag: '🇸🇦', country: 'السعودية', countryFr: 'Arabie Saoudite', currency: 'SAR',
    color: 'from-green-700 to-green-900',
    pricing: [
      { range: 'أقل من 10 ريال',  fee: '2 ريال' },
      { range: '10 — 40 ريال',    fee: '5-8 ريال' },
      { range: '40 — 75 ريال',    fee: '10-14 ريال' },
      { range: 'أكثر من 75',      fee: '20 ريال' },
    ],
    cities: 'الرياض · جدة · مكة · الدمام · المدينة'
  },
  {
    flag: '🇦🇪', country: 'الإمارات', countryFr: 'Émirats Arabes Unis', currency: 'AED',
    color: 'from-red-700 to-red-900',
    pricing: [
      { range: 'أقل من 15 درهم',  fee: '2 درهم' },
      { range: '15 — 50 درهم',    fee: '5-8 درهم' },
      { range: '50 — 100 درهم',   fee: '10-14 درهم' },
      { range: 'أكثر من 100',     fee: '20 درهم' },
    ],
    cities: 'دبي · أبوظبي · الشارقة · عجمان · رأس الخيمة'
  },
]

const TESTIMONIALS = [
  { name: 'محمد الإدريسي', role: 'صاحب مطعم ببراهيم، مراكش', rating: 5, text: 'قبل SmartMenu كنت نخسر وقت كبير في الطلبات الغلوطة. دابا المطبخ كيقرا كل شيء واضح — والزبائن راضيين بزاف عن التجربة الرقمية.' },
  { name: 'فاطمة البوزيدي', role: 'مديرة كافي لاتيه، أكادير', rating: 5, text: 'إعداد سهل جداً — في أقل من ساعة كان المنيو جاهز والـ QR مطبوع على الطاولات. الزبائن الأجانب مسرورين بالمنيو بالإنجليزية.' },
  { name: 'خالد العمري', role: 'صاحب فود كورت، الرياض', rating: 5, text: 'نظام دمج الطاولات للعائلات الكبيرة حل لنا مشكلة كبيرة. الفاتورة تجي موحدة وما كاين مشاكل في التحصيل.' },
]

const FAQS = [
  { q: 'هل يحتاج الزبون لتحميل تطبيق؟', a: 'لا، المنيو يفتح مباشرة في متصفح الهاتف عند مسح QR — بدون أي تحميل أو تسجيل.' },
  { q: 'كيف يعمل نظام الفوترة؟', a: 'خلال أسبوع التجربة المجاني لا تدفع شيئاً. بعده، تُحسب عمولة صغيرة على كل طلب مكتمل فقط — بدون اشتراك شهري ثابت.' },
  { q: 'هل يمكنني تعديل المنيو في أي وقت؟', a: 'نعم، من لوحة التحكم على هاتفك أو الكمبيوتر يمكنك إضافة/حذف/تعديل الأصناف فوراً.' },
  { q: 'ماذا يحدث لو انقطع الإنترنت؟', a: 'الزبائن لا يستطيعون الطلب، لكن المنيو يبقى مرئياً من الكاش المحفوظ. ننصح بوضع علامة backup للطوارئ.' },
  { q: 'هل يدعم النظام عدة فروع؟', a: 'نعم، كل فرع عنده حسابه ومنيوه الخاص مع لوحة تحكم منفصلة. باقة المؤسسات تتيح إدارة كل الفروع من حساب واحد.' },
  { q: 'هل الدعم متاح بالعربية؟', a: 'بالتأكيد — فريق الدعم يتواصل بالعربية، الفرنسية، والإنجليزية عبر واتساب وإيميل.' },
]

const MENU_PREVIEW = {
  morocco: {
    label: '🇲🇦 مغربي', color: 'from-emerald-700 to-amber-800', currency: 'MAD',
    items: [
      { name: 'طاجين كفتة وبيض', price: '90', tag: '🔥' },
      { name: 'كسكس بالخضر',     price: '110', tag: '⭐' },
      { name: 'أتاي مغربي',      price: '22', tag: '' },
      { name: 'بسطيلة بالدجاج',  price: '85', tag: '🆕' },
    ]
  },
  saudi: {
    label: '🇸🇦 سعودي', color: 'from-green-800 to-green-600', currency: 'SAR',
    items: [
      { name: 'كبسة لحم غنم',   price: '75', tag: '🔥' },
      { name: 'مندي دجاج',      price: '65', tag: '⭐' },
      { name: 'قهوة عربية',     price: '15', tag: '' },
      { name: 'لقيمات بالديبس', price: '22', tag: '🆕' },
    ]
  },
  uae: {
    label: '🇦🇪 إماراتي', color: 'from-red-800 to-red-600', currency: 'AED',
    items: [
      { name: 'هريس الخروف',    price: '55', tag: '🔥' },
      { name: 'مجبوس ربيان',   price: '85', tag: '⭐' },
      { name: 'قهوة بيضاء',    price: '18', tag: '' },
      { name: 'كنافة نابلسية', price: '35', tag: '🆕' },
    ]
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState('')
  const [activeMenu, setActiveMenu] = useState<'morocco' | 'saudi' | 'uae'>('morocco')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  async function handleWhatsAppRegister(e: React.FormEvent) {
    e.preventDefault()
    setWaError('')
    setWaLoading(true)
    try {
      const res = await fetch('/api/auth/quick-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, country: 'MA' })
      })
      const data = await res.json()
      if (!res.ok) { setWaError(data.error || 'حدث خطأ'); return }
      router.push('/whatsapp-sent')
    } catch {
      setWaError('تعذّر الاتصال بالخادم')
    } finally {
      setWaLoading(false)
    }
  }

  const preview = MENU_PREVIEW[activeMenu]

  return (
    <main className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">

      {/* ── Top info bar ── */}
      <div className="bg-gray-900 text-gray-300 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> +212 6 00 00 00 00</span>
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> contact@smartmenu.ma</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-green-400 font-medium">🟢 جميع الأنظمة تعمل</span>
            <span className="text-gray-500">|</span>
            <span>AR · FR · EN · SAR · MAD · AED</span>
          </div>
        </div>
      </div>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">SM</span>
            </div>
            <div>
              <span className="font-extrabold text-lg text-gray-900 tracking-tight">SmartMenu</span>
              <span className="hidden sm:inline text-xs text-emerald-600 font-medium ml-1">Pro</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-7 text-sm text-gray-600 font-medium">
            <a href="#industries" className="hover:text-emerald-700 transition-colors">الصناعات</a>
            <a href="#features"   className="hover:text-emerald-700 transition-colors">المميزات</a>
            <a href="#demo"       className="hover:text-emerald-700 transition-colors">Demo</a>
            <a href="#pricing"    className="hover:text-emerald-700 transition-colors">الأسعار</a>
            <a href="#contact"    className="hover:text-emerald-700 transition-colors">تواصل معنا</a>
            <Link href="/login" className="hover:text-emerald-700 transition-colors">تسجيل الدخول</Link>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login" className="border border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              Connexion
            </Link>
            <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-sm">
              ابدأ مجاناً ←
            </Link>
          </div>

          <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
            {['#industries:الصناعات', '#features:المميزات', '#demo:Demo', '#pricing:الأسعار', '#contact:تواصل معنا'].map(item => {
              const [href, label] = item.split(':')
              return <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 font-medium py-1">{label}</a>
            })}
            <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block bg-emerald-600 text-white text-center py-3 rounded-xl font-bold mt-2">ابدأ مجاناً</Link>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HERO */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-600/20 rounded-full blur-[100px]" />

        <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-24 flex flex-col lg:flex-row items-center gap-16">

          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-right" dir="rtl">
            <div className="inline-flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/50 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              النظام الرقمي رقم 1 للمطاعم في المغرب والخليج
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] text-white">
              منيو QR
              <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">بدون تطبيق</span>
              <span className="text-3xl sm:text-4xl font-bold text-gray-300 mt-2 block">طلبات فورية · إحصاءات ذكية</span>
            </h1>

            <p className="mt-6 text-lg text-gray-400 leading-relaxed max-w-xl">
              حوّل مطعمك أو مقهاك لتجربة رقمية كاملة — الزبون يمسح QR ويطلب مباشرة،
              المطبخ يستقبل فوراً، وأنت تتابع كل شيء من هاتفك.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/signup" className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-emerald-900/40 transition-all text-lg">
                ابدأ مجاناً 7 أيام
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#demo" className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-4 rounded-2xl transition-all text-lg">
                <Play className="w-5 h-5 fill-white" />
                شاهد كيف يعمل
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-3 justify-center lg:justify-start">
              {['بدون عقد', 'إعداد 5 دقائق', 'دعم عربي 24/7', 'لا بطاقة بنكية'].map(t => (
                <span key={t} className="flex items-center gap-1.5 bg-white/10 text-gray-300 border border-white/10 px-3 py-1.5 rounded-full text-sm">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Interactive Phone Mockup */}
          <div className="flex-1 flex flex-col items-center gap-4">
            {/* Market selector */}
            <div className="flex gap-2 bg-white/10 rounded-2xl p-1">
              {(Object.keys(MENU_PREVIEW) as Array<keyof typeof MENU_PREVIEW>).map(key => (
                <button key={key} onClick={() => setActiveMenu(key)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeMenu === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-300 hover:text-white'}`}>
                  {MENU_PREVIEW[key].label}
                </button>
              ))}
            </div>

            {/* Phone */}
            <div className="relative">
              <div className="absolute -inset-6 rounded-[3.5rem] bg-gradient-to-br from-emerald-500/20 to-teal-500/10 blur-2xl" />
              <div className="relative w-72 bg-gray-800 rounded-[2.8rem] p-3 shadow-2xl border border-white/10">
                <div className="bg-white rounded-[2.2rem] overflow-hidden">
                  {/* Header */}
                  <div className={`bg-gradient-to-br ${preview.color} px-5 py-6`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/70 text-xs">SmartMenu</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                        <div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    </div>
                    <p className="text-white font-bold text-lg" dir="rtl">قائمة الطعام</p>
                    <p className="text-white/60 text-xs mt-0.5" dir="rtl">طاولة 4 · مقعد 2</p>
                  </div>
                  {/* Items */}
                  <div className="px-3 py-3 space-y-2 bg-gray-50">
                    {preview.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-2xl px-3 py-2.5 shadow-sm">
                        <div className="flex items-center gap-2">
                          {item.tag && <span className="text-base">{item.tag}</span>}
                          <span className="text-xs font-semibold text-gray-900" dir="rtl">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600 font-bold text-xs">{item.price}</span>
                          <span className="text-gray-400 text-[10px]">{preview.currency}</span>
                          <button className="w-6 h-6 bg-gray-900 rounded-full text-white text-base font-bold flex items-center justify-center leading-none">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* CTA */}
                  <div className="px-3 pb-4 pt-2 bg-gray-50">
                    <div className="bg-gray-900 text-white text-xs text-center py-3 rounded-2xl font-bold">
                      🛒 أضف للطلب (2 صنف)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* STATS BAR */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-emerald-700 py-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map(s => (
              <div key={s.value}>
                <div className="text-4xl font-extrabold text-white">{s.value}</div>
                <div className="text-emerald-200 text-sm mt-1 font-medium" dir="rtl">{s.label}</div>
                <div className="text-emerald-400 text-xs">{s.labelFr}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* INDUSTRIES */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="industries" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14" dir="rtl">
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">الصناعات المدعومة</span>
            <h2 className="text-4xl font-extrabold text-gray-900">حلول مخصصة لكل قطاع</h2>
            <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">من المطاعم الصغيرة إلى سلاسل الفنادق — SmartMenu يتكيف مع احتياجاتك</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {INDUSTRIES.map(ind => {
              const Icon = ind.icon
              return (
                <div key={ind.title} className={`border-2 rounded-2xl p-6 transition-all cursor-pointer group ${ind.color}`}>
                  <div className={`w-14 h-14 rounded-2xl ${ind.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-7 h-7 ${ind.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-1" dir="rtl">{ind.title}</h3>
                  <p className="text-xs text-gray-500 font-medium mb-3">{ind.titleFr}</p>
                  <p className="text-sm text-gray-600 leading-relaxed" dir="rtl">{ind.desc}</p>
                  <div className={`mt-4 flex items-center gap-1 text-sm font-semibold ${ind.iconColor}`} dir="rtl">
                    اعرف أكثر <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="demo" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16" dir="rtl">
            <span className="inline-block bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">كيف يعمل</span>
            <h2 className="text-4xl font-extrabold text-gray-900">جاهز في 4 خطوات فقط</h2>
            <p className="mt-3 text-gray-500 text-lg">من التسجيل إلى أول طلب في أقل من 30 دقيقة</p>
          </div>

          <div className="relative">
            {/* Connector line (desktop) */}
            <div className="hidden lg:block absolute top-12 left-1/2 -translate-x-1/2 w-[75%] h-0.5 bg-gradient-to-r from-emerald-200 via-emerald-400 to-emerald-200" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = step.icon
                return (
                  <div key={i} className="flex flex-col items-center text-center" dir="rtl">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-3xl bg-emerald-600 text-white flex flex-col items-center justify-center shadow-xl shadow-emerald-200 mb-5">
                        <Icon className="w-8 h-8" />
                        <span className="text-xs font-bold opacity-70 mt-1">{step.step}</span>
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">{step.title}</h3>
                    <p className="text-xs text-emerald-600 font-medium mb-2">{step.titleFr}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FEATURES */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16" dir="rtl">
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">المميزات</span>
            <h2 className="text-4xl font-extrabold text-gray-900">كل ما تحتاجه في منصة واحدة</h2>
            <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">12 ميزة احترافية مصممة خصيصاً لبيئة العمل في مطاعم المغرب والخليج</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                  <div className="w-11 h-11 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center mb-4 transition-colors">
                    <Icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm mb-0.5" dir="rtl">{f.title}</h4>
                  <p className="text-emerald-600 text-xs font-medium mb-2">{f.titleFr}</p>
                  <p className="text-xs text-gray-500 leading-relaxed" dir="rtl">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MARKETS / PRICING */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16" dir="rtl">
            <span className="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">الأسواق والأسعار</span>
            <h2 className="text-4xl font-extrabold text-gray-900">تدفع فقط على الطلبات المكتملة</h2>
            <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">لا اشتراك شهري · لا رسوم ثابتة · عمولة رمزية تُحسب تلقائياً حسب قيمة الطلب</p>
          </div>

          {/* Trial banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-8 mb-10 text-center text-white">
            <div className="text-5xl font-extrabold mb-2">7 أيام مجاناً</div>
            <div className="text-emerald-200 text-lg mb-4">ابدأ التجربة — لا بطاقة بنكية، لا التزام</div>
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              {['✓ جميع المميزات مفعّلة', '✓ عدد طلبات غير محدود', '✓ دعم فوري بالعربية', '✓ QR جاهز في دقائق'].map(t => (
                <span key={t} className="bg-white/20 px-4 py-1.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>

          {/* Market cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MARKETS.map(m => (
              <div key={m.country} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className={`bg-gradient-to-br ${m.color} px-6 py-5`}>
                  <div className="text-4xl mb-2">{m.flag}</div>
                  <h3 className="text-white font-extrabold text-xl" dir="rtl">{m.country}</h3>
                  <p className="text-white/70 text-sm">{m.countryFr} · {m.currency}</p>
                  <p className="text-white/60 text-xs mt-2">{m.cities}</p>
                </div>
                <div className="px-6 py-5 bg-white">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">العمولة حسب قيمة الطلب</p>
                  <div className="space-y-2">
                    {m.pricing.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500" dir="rtl">{p.range}</span>
                        <span className="font-bold text-emerald-600">{p.fee}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/signup" className="mt-5 block text-center bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-bold text-sm transition-colors">
                    ابدأ مجاناً في {m.country}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise */}
          <div className="mt-6 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <Building2 className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="font-bold text-xl text-gray-900 mb-2" dir="rtl">باقة المؤسسات والسلاسل</h3>
            <p className="text-gray-500 max-w-xl mx-auto mb-5" dir="rtl">عدة فروع، علامة تجارية خاصة، SLA مضمون، تدريب ودعم VIP، تكامل مع أنظمة POS الموجودة</p>
            <a href="#contact" className="inline-flex items-center gap-2 border-2 border-gray-900 text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-gray-900 hover:text-white transition-all">
              تواصل معنا للتسعير المخصص <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TESTIMONIALS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14" dir="rtl">
            <span className="inline-block bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">آراء العملاء</span>
            <h2 className="text-4xl font-extrabold text-gray-900">مطاعم تثق في SmartMenu</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5" dir="rtl">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm" dir="rtl">{t.name}</p>
                    <p className="text-gray-400 text-xs" dir="rtl">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* WHATSAPP CTA */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-green-900/50 border border-green-700/50 text-green-300 px-5 py-2 rounded-full text-sm mb-8">
            <MessageCircle className="w-4 h-4 text-green-400 fill-green-400" />
            تفعيل فوري عبر واتساب — بدون إيميل ولا كلمة مرور
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4" dir="rtl">
            ابدأ أسبوعك المجاني<br />
            <span className="text-green-400">بضغطة واحدة</span>
          </h2>
          <p className="text-gray-400 mb-10 text-lg" dir="rtl">أدخل رقم واتساب وسنرسل لك رابط الدخول الفوري — جاهز خلال ثوانٍ.</p>

          <form onSubmit={handleWhatsAppRegister} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono select-none" dir="ltr">+212</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="6 12 34 56 78" required dir="ltr"
                  className="w-full pr-16 pl-4 py-4 rounded-2xl text-gray-900 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-gray-400 bg-white" />
              </div>
              <button type="submit" disabled={waLoading}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-600 text-white font-bold px-6 py-4 rounded-2xl transition-all shadow-xl shadow-green-900/40 whitespace-nowrap">
                {waLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                {waLoading ? '...' : 'أرسل لي الرابط'}
              </button>
            </div>
            {waError && <p className="mt-3 text-red-400 text-sm">{waError}</p>}
            <p className="mt-5 text-gray-500 text-xs" dir="rtl">
              ✓ مجاني 7 أيام كاملة &nbsp;·&nbsp; ✓ لا يلزم بطاقة بنكية &nbsp;·&nbsp; ✓ إلغاء في أي وقت
            </p>
          </form>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FAQ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-14" dir="rtl">
            <span className="inline-block bg-gray-100 text-gray-600 px-4 py-1 rounded-full text-sm font-semibold mb-4">الأسئلة الشائعة</span>
            <h2 className="text-4xl font-extrabold text-gray-900">لديك سؤال؟</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className={`border rounded-2xl overflow-hidden transition-all ${openFaq === i ? 'border-emerald-300 shadow-sm' : 'border-gray-200'}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left gap-4">
                  <span className="font-semibold text-gray-900 text-sm text-right flex-1" dir="rtl">{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="w-5 h-5 text-emerald-600 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3" dir="rtl">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CONTACT */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="contact" className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14" dir="rtl">
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">تواصل معنا</span>
            <h2 className="text-4xl font-extrabold text-gray-900">نحن هنا لمساعدتك</h2>
            <p className="mt-3 text-gray-500">فريق الدعم متاح 7 أيام في الأسبوع بالعربية والفرنسية والإنجليزية</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: MessageCircle, label: 'واتساب', value: '+212 6 00 00 00 00', sub: 'رد خلال دقائق', color: 'text-green-600', bg: 'bg-green-50' },
              { icon: Mail,          label: 'البريد الإلكتروني', value: 'contact@smartmenu.ma', sub: 'رد خلال ساعة', color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: MapPin,        label: 'المقر الرئيسي', value: 'الدار البيضاء، المغرب', sub: 'نخدم MA · SA · AE', color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((c, i) => {
              const Icon = c.icon
              return (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                  <div className={`w-14 h-14 ${c.bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                    <Icon className={`w-7 h-7 ${c.color}`} />
                  </div>
                  <p className="font-bold text-gray-900 mb-1">{c.label}</p>
                  <p className={`font-semibold text-sm ${c.color} mb-1`}>{c.value}</p>
                  <p className="text-gray-400 text-xs">{c.sub}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FINAL CTA */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-emerald-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4" dir="rtl">جاهز تحوّل مطعمك؟</h2>
          <p className="text-emerald-200 text-xl mb-10">انضم لأكثر من 500 مطعم ومقهى يستخدم SmartMenu يومياً</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white hover:bg-gray-100 text-emerald-800 font-extrabold px-10 py-4 rounded-2xl text-lg transition-all shadow-xl">
              ابدأ 7 أيام مجاناً ←
            </Link>
            <a href="#contact" className="border-2 border-white/50 hover:border-white text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all">
              تحدث مع فريقنا
            </a>
          </div>
          <p className="mt-6 text-emerald-300 text-sm">لا بطاقة بنكية · لا عقد · إلغاء في أي وقت</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <footer className="bg-gray-950 text-gray-400 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SM</span>
                </div>
                <span className="text-white font-extrabold text-lg">SmartMenu</span>
              </div>
              <p className="text-sm leading-relaxed mb-4" dir="rtl">منصة رقمية متكاملة لإدارة طلبات المطاعم والمقاهي في المغرب والخليج.</p>
              <div className="flex gap-3">
                {['🇲🇦', '🇸🇦', '🇦🇪'].map(f => <span key={f} className="text-xl">{f}</span>)}
              </div>
            </div>
            {/* Product */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">المنتج</h4>
              <ul className="space-y-2 text-sm">
                {['المميزات', 'الأسعار', 'Demo', 'لوحة التحكم', 'شاشة المطبخ KDS'].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            {/* Company */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">الشركة</h4>
              <ul className="space-y-2 text-sm">
                {['من نحن', 'تواصل معنا', 'الدعم الفني', 'سياسة الخصوصية', 'شروط الاستخدام'].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            {/* Contact */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">تواصل معنا</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-500" /> +212 6 00 00 00 00</li>
                <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-500" /> contact@smartmenu.ma</li>
                <li className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-500" /> واتساب (دعم فوري)</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <span>© {new Date().getFullYear()} SmartMenu — جميع الحقوق محفوظة</span>
            <span className="text-gray-600">مصنوع بـ ❤️ للمطاعم العربية · AR · FR · EN</span>
          </div>
        </div>
      </footer>

    </main>
  )
}
