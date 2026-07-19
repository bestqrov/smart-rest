"use client"

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  QrCode, BarChart3, ChefHat, Smartphone, Zap, Star,
  CheckCircle2, ArrowRight, Loader2, X, Phone, Mail,
  Building2, MapPin, Users, Clock, Shield, Globe,
  Utensils, Coffee, Package, Calendar, TrendingUp,
  Bell, Wifi, CreditCard, FileText, ChevronRight,
  Sparkles, Play,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type BusinessType = { value: string; icon: string; label: string; desc: string }
type Stage = 'idle' | 'submitting' | 'done' | 'error'

const BUSINESS_TYPES: BusinessType[] = [
  { value: 'RESTAURANT', icon: '🍽️', label: 'مطعم',      desc: 'أكل يومي' },
  { value: 'CAFE',       icon: '☕', label: 'مقهى',       desc: 'مشروبات' },
  { value: 'TRAITEUR',   icon: '🎂', label: 'تريتور',     desc: 'فعاليات' },
  { value: 'PASTRY',     icon: '🧁', label: 'حلويات',     desc: 'مخبزة' },
  { value: 'FOOD_TRUCK', icon: '🚚', label: 'فود تراك',   desc: 'متنقل' },
  { value: 'HOTEL',      icon: '🏨', label: 'فندق',       desc: 'إقامة' },
]

// ─── Feature cards data ───────────────────────────────────────────────────────

const FEATURES = [
  { icon: QrCode,      color: 'emerald', title: 'قائمة QR ذكية',        desc: 'قائمة رقمية متعددة اللغات — يطلب الزبون بنفسه بدون نادل' },
  { icon: ChefHat,     color: 'orange',  title: 'شاشة المطبخ',          desc: 'الطلبات تصل للمطبخ فورياً — صفر أخطاء صفر ورق' },
  { icon: BarChart3,   color: 'blue',    title: 'تحليلات ذكية',         desc: 'أرباحك وأكثر الأطباق مبيعاً في لحظة' },
  { icon: Smartphone,  color: 'purple',  title: 'POS متكامل',           desc: 'صندوق الدفع، الوردية، الطباعة — كلشي من موبايل' },
  { icon: Calendar,    color: 'pink',    title: 'نظام الحجوزات',        desc: 'حجز طاولات مع تأكيد واتساب أوتوماتيكي' },
  { icon: Sparkles,    color: 'amber',   title: 'تسويق بالذكاء الاصطناعي', desc: 'محتوى سوشيال ميديا يُنتج أوتوماتيكياً يومياً' },
  { icon: Package,     color: 'teal',    title: 'إدارة المخزون',        desc: 'تتبع المواد وتنبيه النقص وطلبات الموردين تلقائياً' },
  { icon: Users,       icon2: Shield,    color: 'rose', title: 'التريتور',  desc: 'لوحة فعاليات كاملة — عروض، عقود، لوائح أطباق' },
]

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '< 5 دقائق', label: 'وقت الإعداد' },
  { value: '7 أيام',    label: 'تجربة مجانية' },
  { value: '24/7',      label: 'دعم تقني' },
  { value: 'صفر MAD',   label: 'بدون اشتراك شهري' },
]

// ─── Animated counter ─────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

// ─── Demo Request Modal ───────────────────────────────────────────────────────

function DemoModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    ownerName: '', businessName: '', businessType: '',
    phone: '', email: '', city: '', country: 'MA', notes: '',
  })
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.businessType) { setError('اختر نوع المنشأة'); return }
    if (!form.ownerName.trim() || !form.businessName.trim() || !form.phone.trim() || !form.email.trim() || !form.city.trim()) {
      setError('يرجى ملء جميع الحقول'); return
    }

    setStage('submitting')
    try {
      const res = await fetch('/api/public/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); setStage('error'); return }
      setStage('done')
    } catch {
      setError('خطأ في الشبكة — حاول مجدداً')
      setStage('error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 22 }}
        className="relative w-full sm:max-w-lg bg-zinc-900 border border-zinc-700 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[95dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">طلب تجربة مجانية 7 أيام</h2>
            <p className="text-zinc-400 text-xs mt-0.5">سنتواصل معك خلال ساعات</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {stage === 'done' ? (
          <div className="flex flex-col items-center gap-5 px-6 py-12 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
              <CheckCircle2 className="w-20 h-20 text-emerald-400" />
            </motion.div>
            <div className="space-y-2">
              <h3 className="text-white text-xl font-bold">تم استلام طلبك 🎉</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                سيتواصل معك فريق Smart Resto خلال ساعات لتفعيل الحساب التجريبي.
              </p>
              <p className="text-emerald-400 text-sm font-medium">7 أيام مجانية — كل الميزات — بدون بطاقة بنكية</p>
            </div>
            <a
              href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '212600000000').replace(/\D/g, '')}?text=مرحباً، طلبت تجربة Smart Resto`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              <Phone className="w-4 h-4" /> تواصل عبر واتساب
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 pb-8 pt-5 space-y-4" dir="rtl">

            {/* Business type */}
            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-2">نوع المنشأة *</label>
              <div className="grid grid-cols-3 gap-2">
                {BUSINESS_TYPES.map(bt => (
                  <button
                    key={bt.value}
                    type="button"
                    onClick={() => set('businessType', bt.value)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-center ${
                      form.businessType === bt.value
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800'
                    }`}
                  >
                    <span className="text-xl">{bt.icon}</span>
                    <span className={`text-xs font-bold ${form.businessType === bt.value ? 'text-emerald-400' : 'text-zinc-300'}`}>{bt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'ownerName',    label: 'اسمك الكامل *',    placeholder: 'محمد العمراني',    col: 1 },
                { key: 'businessName', label: 'اسم المنشأة *',     placeholder: 'مطعم الأصيل',      col: 1 },
                { key: 'phone',        label: 'رقم الواتساب *',    placeholder: '06xxxxxxxx',        col: 1 },
                { key: 'email',        label: 'البريد الإلكتروني *',placeholder: 'you@gmail.com',    col: 1 },
                { key: 'city',         label: 'المدينة *',          placeholder: 'الدار البيضاء',    col: 1 },
              ].map(f => (
                <div key={f.key} className="col-span-2 sm:col-span-1 last:col-span-2">
                  <label className="text-zinc-400 text-xs mb-1 block">{f.label}</label>
                  <input
                    type={f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'}
                    value={(form as any)[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    dir={f.key === 'email' || f.key === 'phone' ? 'ltr' : 'rtl'}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">ملاحظات إضافية (اختياري)</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="أي معلومة إضافية تودّ مشاركتها..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <X className="w-4 h-4" /> {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={stage === 'submitting'}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-base"
            >
              {stage === 'submitting' ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> جاري الإرسال...</>
              ) : (
                <>ابدأ تجربتي المجانية <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <p className="text-center text-zinc-600 text-xs">
              ✅ بدون بطاقة بنكية · ✅ لا يوجد عقد · ✅ إلغاء في أي وقت
            </p>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [showModal, setShowModal] = useState(false)
  const [logoUrl, setLogoUrl]    = useState('/assets/logo.png')

  useEffect(() => {
    fetch('/api/public/landing-config')
      .then(r => r.ok ? r.json() : {})
      .then((d: any) => { if (d?.logoImageUrl) setLogoUrl(d.logoImageUrl) })
      .catch(() => {})
  }, [])

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    orange:  'bg-orange-500/10  text-orange-400  border-orange-500/20',
    blue:    'bg-blue-500/10    text-blue-400    border-blue-500/20',
    purple:  'bg-purple-500/10  text-purple-400  border-purple-500/20',
    pink:    'bg-pink-500/10    text-pink-400    border-pink-500/20',
    amber:   'bg-amber-500/10   text-amber-400   border-amber-500/20',
    teal:    'bg-teal-500/10    text-teal-400    border-teal-500/20',
    rose:    'bg-rose-500/10    text-rose-400    border-rose-500/20',
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden" dir="rtl">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2">
            <Image src={logoUrl} alt="Smart Resto" width={36} height={36} className="rounded-xl" unoptimized />
            <span className="font-black text-white text-lg">Smart Resto</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-zinc-400 hover:text-white text-sm transition-colors hidden sm:block">
              تسجيل الدخول
            </Link>
            <button
              onClick={() => setShowModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              جرّب مجاناً
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 px-4 text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 max-w-3xl mx-auto space-y-6"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium px-4 py-1.5 rounded-full">
            <Sparkles className="w-4 h-4" />
            نظام تشغيل ذكي للمطاعم والمقاهي
          </div>

          <h1 className="text-4xl sm:text-6xl font-black leading-tight">
            أدر مطعمك كاملاً{' '}
            <span className="bg-gradient-to-l from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              من شاشة واحدة
            </span>
          </h1>

          <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed max-w-xl mx-auto">
            قائمة QR · مطبخ رقمي · POS · حجوزات · مخزون · تسويق بالذكاء الاصطناعي
            <br />
            <span className="text-white font-semibold">كل شيء. منصة واحدة. بدون اشتراك شهري.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg px-8 py-4 rounded-2xl transition-all hover:scale-105 shadow-lg shadow-emerald-900/40"
            >
              ابدأ تجربتي المجانية 7 أيام
              <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              href="/landing"
              className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              <Play className="w-4 h-4" /> شاهد المنصة
            </Link>
          </div>

          <p className="text-zinc-600 text-sm">✅ بدون بطاقة بنكية · ✅ إعداد خلال 5 دقائق · ✅ دعم 24/7 بالعربية</p>
        </motion.div>

        {/* Platform preview image */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative z-10 mt-14 max-w-5xl mx-auto"
        >
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl shadow-black/50 bg-zinc-900">
            <Image
              src="/assets/smartrest.png"
              alt="Smart Resto Dashboard"
              width={1200}
              height={680}
              className="w-full object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent" />
          </div>
          {/* Floating badges */}
          <div className="absolute -right-3 top-8 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg hidden sm:block">
            ✅ طلب جديد — طاولة 5
          </div>
          <div className="absolute -left-3 top-20 bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg hidden sm:block">
            📊 مبيعات اليوم: 2,840 د.م
          </div>
        </motion.div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <section className="py-10 border-y border-zinc-800 bg-zinc-900/40">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map((s, i) => (
            <FadeUp key={i} delay={i * 0.1}>
              <div className="space-y-1">
                <p className="text-2xl font-black text-emerald-400">{s.value}</p>
                <p className="text-zinc-500 text-sm">{s.label}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-14 space-y-3">
              <p className="text-emerald-400 text-sm font-bold tracking-widest uppercase">الميزات</p>
              <h2 className="text-3xl sm:text-4xl font-black">كل ما يحتاجه مطعمك</h2>
              <p className="text-zinc-500 text-lg">15+ وحدة ذكية — تعمل معاً بسلاسة</p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon as any
              const cls  = colorMap[f.color] ?? colorMap.emerald
              return (
                <FadeUp key={i} delay={i * 0.07}>
                  <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 space-y-3 transition-all hover:-translate-y-1 group">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${cls}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-bold text-base">{f.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </FadeUp>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-zinc-900/40 border-y border-zinc-800">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-center mb-12 space-y-2">
              <p className="text-emerald-400 text-sm font-bold tracking-widest uppercase">كيف يعمل</p>
              <h2 className="text-3xl font-black">شغّال في 3 خطوات فقط</h2>
            </div>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { n: '01', title: 'طلب التجربة',      desc: 'سجّل بياناتك وسنتواصل معك خلال ساعات لإنشاء حسابك',   icon: FileText },
              { n: '02', title: 'إعداد لحظي',        desc: 'ضع قائمة مطعمك، طباعة QR، وابدأ تلقّي الطلبات فوراً',    icon: Zap },
              { n: '03', title: 'انمُ وتوسّع',       desc: 'تحليلات يومية، تسويق تلقائي، ومطعمك يشتغل بذكاء',      icon: TrendingUp },
            ].map((step, i) => {
              const Icon = step.icon
              return (
                <FadeUp key={i} delay={i * 0.15}>
                  <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div className="text-5xl font-black text-zinc-800 absolute top-4 left-5 select-none">{step.n}</div>
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center relative z-10">
                      <Icon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-bold text-lg relative z-10">{step.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed relative z-10">{step.desc}</p>
                  </div>
                </FadeUp>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing pill ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <FadeUp>
          <div className="max-w-2xl mx-auto bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-3xl p-8 text-center space-y-4">
            <p className="text-emerald-400 font-bold text-sm uppercase tracking-widest">التسعير</p>
            <h2 className="text-3xl font-black">لا اشتراك شهري — صفر</h2>
            <p className="text-zinc-400 leading-relaxed">
              تدفع فقط عمولة صغيرة على كل طلب مكتمل.
              كلما زادت طلباتك، كلما اشتغل النظام أكثر لصالحك.
            </p>
            <div className="flex flex-wrap gap-3 justify-center text-sm">
              {['✅ تجربة 7 أيام مجانية', '✅ كل الميزات متاحة', '✅ بدون بطاقة', '✅ إلغاء حر'].map(b => (
                <span key={b} className="bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full">{b}</span>
              ))}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-4 rounded-2xl transition-all hover:scale-105"
            >
              ابدأ تجربتي المجانية <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </FadeUp>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 text-center bg-gradient-to-b from-zinc-950 to-emerald-950/20">
        <FadeUp>
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-4xl sm:text-5xl font-black">
              مطعمك يستحق<br />
              <span className="text-emerald-400">نظام تشغيل حقيقي</span>
            </h2>
            <p className="text-zinc-400 text-lg">انضم اليوم — التجربة مجانية 7 أيام — لا رسوم مخفية</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-l from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xl px-10 py-5 rounded-2xl transition-all hover:scale-105 shadow-2xl shadow-emerald-900/50"
            >
              اطلب تجربتي المجانية الآن
              <Sparkles className="w-5 h-5" />
            </button>
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8 px-4 text-center space-y-2">
        <p className="text-zinc-600 text-sm">
          © {new Date().getFullYear()} Smart Resto — مبني للمطاعم في أفريقيا والخليج والمغرب العربي
        </p>
        <div className="flex justify-center gap-4 text-xs text-zinc-700">
          <Link href="/privacy" className="hover:text-zinc-400 transition-colors">سياسة الخصوصية</Link>
          <Link href="/terms"   className="hover:text-zinc-400 transition-colors">شروط الاستخدام</Link>
          <Link href="/login"   className="hover:text-zinc-400 transition-colors">تسجيل الدخول</Link>
        </div>
      </footer>

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && <DemoModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>

      {/* Sticky CTA (mobile) */}
      <div className="fixed bottom-0 inset-x-0 z-30 sm:hidden bg-zinc-950/95 border-t border-zinc-800 px-4 py-3">
        <button
          onClick={() => setShowModal(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors"
        >
          اطلب تجربة مجانية 7 أيام 🚀
        </button>
      </div>
    </div>
  )
}
