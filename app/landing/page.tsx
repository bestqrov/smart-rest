"use client"

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Zap, BarChart3, Globe, Star, CheckCircle, Menu, X, MessageCircle, ArrowRight, Loader2 } from 'lucide-react'

const RESTAURANTS = [
  {
    name: 'Restaurant Manar du Sud',
    location: 'Ouarzazate',
    cuisine: 'Spécialités Marocaines',
    color: 'from-amber-800 to-amber-600',
    badge: 'bg-amber-100 text-amber-800',
    items: [
      { name: 'Tajine Agneau', nameAr: 'طاجين الحمل', price: '85' },
      { name: 'Couscous Royal', nameAr: 'كسكس ملكي', price: '95' },
      { name: 'Pastilla au Pigeon', nameAr: 'بسطيلة الحمام', price: '75' },
    ]
  },
  {
    name: 'Café Bab Dokkala',
    location: 'Marrakech',
    cuisine: 'Café & Pâtisserie',
    color: 'from-rose-700 to-rose-500',
    badge: 'bg-rose-100 text-rose-800',
    items: [
      { name: 'Thé à la Menthe', nameAr: 'أتاي بالنعناع', price: '15' },
      { name: 'Msemen au Miel', nameAr: 'مسمن بالعسل', price: '25' },
      { name: 'Harira du Jour', nameAr: 'حريرة اليوم', price: '20' },
    ]
  },
  {
    name: 'Plage Café Agadir',
    location: 'Agadir',
    cuisine: 'Snacks & Boissons',
    color: 'from-sky-700 to-sky-500',
    badge: 'bg-sky-100 text-sky-800',
    items: [
      { name: 'Jus Avocat', nameAr: 'عصير الأفوكا', price: '30' },
      { name: 'Club Sandwich', nameAr: 'كلوب ساندويتش', price: '55' },
      { name: 'Iced Latte', nameAr: 'قهوة مثلجة', price: '35' },
    ]
  }
]

const FEATURES = [
  {
    icon: QrCode,
    title: 'QR Menu بدون تطبيق',
    titleFr: 'Menu QR Sans Application',
    desc: 'يمسح الزبون الكود ويطلب مباشرة — بالعربية، الفرنسية، أو الإنجليزية.'
  },
  {
    icon: Zap,
    title: 'طلبات فورية',
    titleFr: 'Commandes en Temps Réel',
    desc: 'يصل الطلب للمطبخ في الحين — مع صوت تنبيه وإشعار فوري.'
  },
  {
    icon: Star,
    title: 'تقييمات Google',
    titleFr: 'Avis Google & TripAdvisor',
    desc: 'بعد كل طلب، نشجع زبوناتك يكتبوا تقييم — المطعم يصعد في النتائج.'
  },
  {
    icon: BarChart3,
    title: 'إحصاءات ذكية',
    titleFr: 'Statistiques Intelligentes',
    desc: 'اعرف أكثر الأطباق مبيعاً وأوقات الذروة لتحسين منيوك.'
  },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState('')

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

  return (
    <main className="min-h-screen bg-[#FFFBF3] text-gray-900 font-sans overflow-x-hidden">

      {/* ─── Decorative Moroccan pattern strip ─── */}
      <div className="h-2 w-full" style={{
        background: 'repeating-linear-gradient(90deg, #059669 0px, #059669 20px, #D97706 20px, #D97706 40px, #B45309 40px, #B45309 60px, #059669 60px)'
      }} />

      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-40 bg-[#FFFBF3]/95 backdrop-blur border-b border-amber-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SM</span>
            </div>
            <span className="font-bold text-lg text-gray-900">SmartMenu</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-emerald-700 transition-colors">المميزات</a>
            <a href="#demo" className="hover:text-emerald-700 transition-colors">Demo</a>
            <a href="#pricing" className="hover:text-emerald-700 transition-colors">Tarifs</a>
            <Link href="/admin/dashboard" className="hover:text-emerald-700 transition-colors">Connexion</Link>
            <Link
              href="/signup"
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Commencer Gratuitement
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden px-4 pb-4 flex flex-col gap-3 text-sm border-t border-amber-100 bg-[#FFFBF3] pt-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-gray-700">المميزات</a>
            <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="text-gray-700">Demo</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-gray-700">Tarifs</a>
            <Link href="/admin/dashboard" className="text-gray-700">Connexion</Link>
            <Link href="/signup" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-center font-medium">
              Commencer Gratuitement
            </Link>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Moroccan geometric background */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath d='M40 0 L80 40 L40 80 L0 40Z' fill='%23059669'/%3E%3Cpath d='M0 0 L20 20 L0 40Z M80 0 L60 20 L80 40Z M0 80 L20 60 L0 40Z M80 80 L60 60 L80 40Z' fill='%23D97706'/%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px'
        }} />

        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-20 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-right" dir="rtl">
            {/* Arabic headline */}
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium mb-6">
              <Globe className="w-4 h-4" />
              <span>مخصص للمطاعم المغربية في المناطق السياحية</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-gray-900">
              حوّل مطعمك إلى
              <span className="block text-emerald-600">تجربة رقمية</span>
            </h1>

            <p className="mt-5 text-lg text-gray-600 max-w-lg mx-auto lg:mx-0">
              قائمة QR بالعربية والفرنسية والإنجليزية، طلبات فورية، وإحصاءات ذكية — كل شيء بدون تطبيق.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <Link
                href="/signup"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-emerald-200 transition-all text-center text-lg"
              >
                ابدأ مجاناً الآن
              </Link>
              <a
                href="#demo"
                className="w-full sm:w-auto border-2 border-amber-400 text-amber-700 font-semibold px-8 py-4 rounded-xl hover:bg-amber-50 transition-all text-center"
              >
                شاهد العرض التجريبي
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-10 flex flex-wrap gap-4 justify-center lg:justify-start">
              <Badge text="بدون عقد" />
              <Badge text="إعداد في 5 دقائق" />
              <Badge text="دعم باللغة العربية" />
            </div>
          </div>

          {/* Phone mockup */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <PhoneMockup restaurant={RESTAURANTS[0]} />
          </div>
        </div>
      </section>

      {/* ─── Restaurant Demo Showcase ─── */}
      <section id="demo" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">مطاعم تثق في SmartMenu</h2>
            <p className="mt-3 text-gray-500 text-lg">من ورزازات إلى أكادير — مطاعم حقيقية، تجربة استثنائية</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RESTAURANTS.map((r) => (
              <RestaurantCard key={r.name} restaurant={r} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── WhatsApp 1-Click Onboarding ─── */}
      <section className="py-16 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0 L60 30 L30 60 L0 30Z' fill='white'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-emerald-100 px-4 py-2 rounded-full text-sm mb-6">
            <MessageCircle className="w-4 h-4 text-green-400" />
            <span>تفعيل فوري عبر واتساب — بدون إيميل ولا كلمة مرور</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3" dir="rtl">
            ابدأ أسبوعك المجاني<br />
            <span className="text-green-400">بضغطة واحدة</span>
          </h2>
          <p className="text-emerald-200 mb-8 text-lg" dir="rtl">
            أدخل رقم واتساب وسنرسل لك رابط الدخول الفوري — جاهز خلال ثوانٍ.
          </p>

          <form onSubmit={handleWhatsAppRegister} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono select-none" dir="ltr">+212</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="6 12 34 56 78"
                  required
                  dir="ltr"
                  className="w-full pr-16 pl-4 py-4 rounded-xl text-gray-900 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-gray-400"
                />
              </div>
              <button
                type="submit"
                disabled={waLoading}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-400 text-white font-bold px-6 py-4 rounded-xl transition-all shadow-lg shadow-green-900/40 whitespace-nowrap"
              >
                {waLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                {waLoading ? 'جاري الإرسال...' : 'أرسل لي الرابط'}
              </button>
            </div>
            {waError && <p className="mt-3 text-red-300 text-sm">{waError}</p>}
            <p className="mt-4 text-emerald-400/70 text-xs" dir="rtl">
              ✓ مجاني 7 أيام كاملة &nbsp;·&nbsp; ✓ لا يلزم بطاقة بنكية &nbsp;·&nbsp; ✓ إلغاء في أي وقت
            </p>
          </form>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20" style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #FFFBF3 50%, #fffbeb 100%)'
      }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12" dir="rtl">
            <h2 className="text-3xl font-bold">كل ما تحتاجه لخدمة زبونيك بشكل أفضل</h2>
            <p className="mt-3 text-gray-500 text-lg">أدوات قوية مصممة خصيصاً للمطاعم والمقاهي المغربية</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-2" dir="rtl">كيف يعمل SmartMenu؟</h2>
          <p className="text-gray-500 mb-12">ثلاث خطوات فقط وتكون جاهزاً</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Step number="١" title="أنشئ حسابك" desc="سجّل مطعمك في أقل من 5 دقائق وأضف منيوك بالصور والأسعار." />
            <Step number="٢" title="اطبع رمز QR" desc="كل طاولة عندها رمز QR خاص — اطبعه وضعه على الطاولة." />
            <Step number="٣" title="استقبل الطلبات" desc="الزبون يمسح ويطلب، أنت تستقبل الطلب فوراً على لوحة التحكم." />
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold" dir="rtl">أسعار واضحة بدون مفاجآت</h2>
            <p className="text-gray-500 mt-2">ابدأ مجاناً واترقَّ عندما تكبر</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PricingCard
              name="مجاني"
              nameFr="Gratuit"
              price="0"
              features={['قائمة QR واحدة', '1 مطعم', 'دعم عبر البريد الإلكتروني']}
              cta="ابدأ مجاناً"
              href="/signup"
            />
            <PricingCard
              name="احترافي"
              nameFr="Pro"
              price="299"
              currency="درهم/شهر"
              features={['طلبات فورية', 'إحصاءات متقدمة', 'تكامل Google Reviews', 'دعم ذو أولوية']}
              cta="ابدأ النسخة الاحترافية"
              href="/signup"
              highlight
            />
            <PricingCard
              name="مؤسسات"
              nameFr="Enterprise"
              price="مخصص"
              features={['عدة فروع', 'علامة تجارية خاصة', 'SLA مضمون', 'تدريب ودعم VIP']}
              cta="تواصل معنا"
              href="mailto:contact@smartmenu.ma"
            />
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-20 bg-emerald-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0 L60 30 L30 60 L0 30Z' fill='white'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
        <div className="relative max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold" dir="rtl">جاهز تحوّل مطعمك؟</h2>
          <p className="mt-4 text-emerald-100 text-lg">انضم إلى المطاعم التي اختارت SmartMenu وشوف الفرق بنفسك.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold px-8 py-4 rounded-xl transition-all shadow-lg text-lg"
            >
              ابدأ مجاناً — بدون بطاقة بنكية
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">SM</span>
            </div>
            <span className="text-white font-semibold">SmartMenu</span>
            <span className="text-gray-600">·</span>
            <span className="text-sm">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6 text-sm">
            <span>مصنوع بـ ❤️ للمطاعم المغربية</span>
            <span className="text-gray-600">AR · FR · EN</span>
          </div>
        </div>
      </footer>

    </main>
  )
}

// ─── Sub-components ───

function Badge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white border border-emerald-100 rounded-full px-3 py-1.5 text-sm text-gray-700 shadow-sm">
      <CheckCircle className="w-4 h-4 text-emerald-500" />
      {text}
    </div>
  )
}

function PhoneMockup({ restaurant }: { restaurant: typeof RESTAURANTS[0] }) {
  return (
    <div className="relative">
      {/* Decorative ring */}
      <div className="absolute -inset-4 rounded-[3rem] border-4 border-dashed border-amber-200 opacity-60" />

      <div className="relative w-64 bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl shadow-gray-400">
        {/* Screen */}
        <div className="bg-[#FFFBF3] rounded-[2rem] overflow-hidden">
          {/* Status bar */}
          <div className={`bg-gradient-to-r ${restaurant.color} px-4 py-5`}>
            <div className="text-white text-xs opacity-80 mb-1">{restaurant.location}</div>
            <div className="text-white font-bold text-sm leading-tight">{restaurant.name}</div>
            <div className="text-white/70 text-xs mt-1">{restaurant.cuisine}</div>
          </div>

          {/* Menu items */}
          <div className="px-3 py-3 space-y-2">
            {restaurant.items.map((item) => (
              <div key={item.name} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 shadow-sm">
                <div>
                  <div className="text-xs font-semibold text-gray-900">{item.name}</div>
                  <div className="text-[10px] text-gray-400" dir="rtl">{item.nameAr}</div>
                </div>
                <div className="text-emerald-600 font-bold text-xs">{item.price} <span className="text-gray-400 font-normal">MAD</span></div>
              </div>
            ))}
          </div>

          {/* Cart button */}
          <div className="px-3 pb-4">
            <div className="bg-emerald-600 text-white text-xs text-center py-2.5 rounded-xl font-semibold">
              🛒 إضافة للطلب
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RestaurantCard({ restaurant }: { restaurant: typeof RESTAURANTS[0] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className={`bg-gradient-to-r ${restaurant.color} p-5`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-white font-bold text-base leading-tight">{restaurant.name}</div>
            <div className="text-white/70 text-sm mt-1">📍 {restaurant.location}</div>
          </div>
          <span className={`${restaurant.badge} text-xs font-medium px-2 py-1 rounded-full`}>
            Smart Menu
          </span>
        </div>
      </div>

      {/* Menu preview */}
      <div className="p-4 space-y-2">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">{restaurant.cuisine}</p>
        {restaurant.items.map((item) => (
          <div key={item.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
              <div className="text-sm font-medium text-gray-900">{item.name}</div>
              <div className="text-xs text-gray-400" dir="rtl">{item.nameAr}</div>
            </div>
            <div className="text-emerald-600 font-bold text-sm">{item.price} MAD</div>
          </div>
        ))}
      </div>

      {/* QR indicator */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
          <QrCode className="w-5 h-5 text-gray-400" />
          <span className="text-xs text-gray-500">QR متاح على كل طاولة</span>
          <div className="ml-auto w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ feature }: { feature: typeof FEATURES[0] }) {
  const Icon = feature.icon
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-emerald-200 transition-colors group">
      <div className="w-12 h-12 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center transition-colors">
        <Icon className="w-6 h-6 text-emerald-600" />
      </div>
      <h4 className="mt-4 font-bold text-gray-900" dir="rtl">{feature.title}</h4>
      <p className="mt-2 text-xs text-amber-600 font-medium">{feature.titleFr}</p>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed" dir="rtl">{feature.desc}</p>
    </div>
  )
}

function Step({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center" dir="rtl">
      <div className="w-16 h-16 rounded-full bg-emerald-600 text-white text-2xl font-bold flex items-center justify-center shadow-lg shadow-emerald-200 mb-4">
        {number}
      </div>
      <h4 className="font-bold text-lg text-gray-900">{title}</h4>
      <p className="mt-2 text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function PricingCard({
  name, nameFr, price, currency = 'مجاناً', features, cta, href, highlight
}: {
  name: string; nameFr: string; price: string; currency?: string
  features: string[]; cta: string; href: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl p-6 ${highlight
      ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200 scale-105'
      : 'bg-white border border-gray-200 shadow-sm'
    }`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${highlight ? 'text-emerald-200' : 'text-gray-400'}`}>{nameFr}</div>
      <div className={`text-2xl font-extrabold mt-1 ${highlight ? 'text-white' : 'text-gray-900'}`} dir="rtl">
        {name}
      </div>
      <div className={`text-3xl font-bold mt-3 ${highlight ? 'text-white' : 'text-gray-900'}`}>
        {price} <span className={`text-sm font-normal ${highlight ? 'text-emerald-200' : 'text-gray-400'}`}>{price !== 'مخصص' ? currency : ''}</span>
      </div>

      <ul className="mt-5 space-y-3">
        {features.map((f) => (
          <li key={f} className={`flex items-start gap-2 text-sm ${highlight ? 'text-emerald-100' : 'text-gray-600'}`} dir="rtl">
            <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${highlight ? 'text-emerald-300' : 'text-emerald-500'}`} />
            {f}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={`mt-6 block text-center py-3 rounded-xl font-bold transition-all ${highlight
          ? 'bg-white text-emerald-700 hover:bg-emerald-50'
          : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
        dir="rtl"
      >
        {cta}
      </Link>
    </div>
  )
}
