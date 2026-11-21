'use client'

import Link from 'next/link'
import { CreditCard, FileText, Landmark } from 'lucide-react'

// Only working destinations are shown. Subscriptions / Invoices hubs were
// "coming soon" dead ends and are hidden until they exist.

export default function BillingPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-blue-400" />
          الفوترة
        </h1>
        <p className="text-zinc-400 text-sm mt-1">إدارة منظومة الفوترة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/superadmin/billing/plans"
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:bg-zinc-800 transition flex flex-col gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-900/50 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">الخطط</h2>
            <p className="text-sm text-zinc-400 mt-1">إدارة خطط الاشتراك والأسعار</p>
          </div>
        </Link>
        <Link href="/superadmin/billing/invoices"
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:bg-zinc-800 transition flex flex-col gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-900/50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">فواتير الاشتراكات</h2>
            <p className="text-sm text-zinc-400 mt-1">الفواتير الشهرية، تأكيد التحويلات، ودورة الفوترة</p>
          </div>
        </Link>
        <Link href="/superadmin/billing/payment-settings"
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:bg-zinc-800 transition flex flex-col gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-900/50 flex items-center justify-center">
            <Landmark className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">إعدادات الدفع</h2>
            <p className="text-sm text-zinc-400 mt-1">الحساب البنكي ومفتاح Tap للدفع بالبطاقة</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
