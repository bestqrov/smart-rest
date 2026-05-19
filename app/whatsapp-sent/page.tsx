'use client'

import Link from 'next/link'
import { MessageCircle, CheckCircle, Clock, ArrowLeft } from 'lucide-react'

export default function WhatsAppSentPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #052e16 100%)' }}
      dir="rtl"
    >
      {/* Animated WhatsApp bubble */}
      <div className="relative mb-8">
        <div className="w-28 h-28 rounded-full bg-green-500 flex items-center justify-center shadow-2xl shadow-green-900">
          <MessageCircle className="w-14 h-14 text-white" />
        </div>
        {/* Pulse rings */}
        <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-30" />
        <div className="absolute -inset-2 rounded-full border-2 border-green-600 animate-pulse opacity-20" />
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
        تحقق من واتساب! 📱
      </h1>
      <p className="text-emerald-200 text-lg max-w-md leading-relaxed mb-8">
        أرسلنا لك رابط الدخول الفوري عبر واتساب.<br />
        اضغط عليه وستدخل للوحة التحكم مباشرة — <strong className="text-white">بدون كلمة مرور</strong>.
      </p>

      {/* Steps */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 mb-8 text-right">
        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">الخطوات التالية</h3>
        <div className="space-y-4">
          {[
            { icon: MessageCircle, text: 'افتح واتساب على هاتفك', done: true },
            { icon: CheckCircle, text: 'اضغط على الرابط المرسل من SmartMenu', done: false },
            { icon: Clock, text: 'الرابط صالح لمدة 15 دقيقة فقط', done: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-500' : 'bg-white/20'}`}>
                <step.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-emerald-100 text-sm">{step.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resend + back */}
      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-emerald-300 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 rotate-180" />
          تغيير رقم الهاتف
        </button>
        <p className="text-emerald-500 text-xs">لم تستلم؟ تحقق من رقمك أو انتظر دقيقة.</p>
      </div>

      {/* Already have token? */}
      <div className="mt-10 text-emerald-600 text-xs">
        لديك حساب؟{' '}
        <Link href="/admin/dashboard" className="underline text-emerald-400 hover:text-white transition-colors">
          دخول مباشر
        </Link>
      </div>
    </div>
  )
}
