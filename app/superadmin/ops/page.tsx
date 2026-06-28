'use client'

import Link from 'next/link'
import {
  HeartPulse, ScanSearch, ScrollText, HardDrive,
  Settings2, ShieldAlert, ArrowRight,
} from 'lucide-react'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title:    'مركز العمليات',
    subtitle: 'إدارة الصحة والتشخيص والسجلات والنسخ الاحتياطية والأمان',
    cards: [
      { href: '/superadmin/ops/health',      icon: HeartPulse,  label: 'صحة النظام',           desc: 'حالة الوحدات في الوقت الفعلي' },
      { href: '/superadmin/ops/diagnostics', icon: ScanSearch,  label: 'التشخيص',              desc: 'فحص شامل لجميع المكونات' },
      { href: '/superadmin/ops/logs',        icon: ScrollText,  label: 'السجلات الموحدة',       desc: 'تصفية وتتبع أحداث المنصة' },
      { href: '/superadmin/ops/backups',     icon: HardDrive,   label: 'مركز النسخ الاحتياطي', desc: 'نسخ يدوية وتاريخ الحفظ' },
      { href: '/superadmin/ops/runtime',     icon: Settings2,   label: 'الإعدادات الحية',       desc: 'تعديل الإعدادات دون إعادة تشغيل' },
      { href: '/superadmin/ops/security',    icon: ShieldAlert, label: 'الأمان',               desc: 'التنبيهات والجلسات والنشاط المشبوه' },
    ],
  },
  en: {
    title:    'Operations Center',
    subtitle: 'Health, diagnostics, logs, backups, runtime, and security',
    cards: [
      { href: '/superadmin/ops/health',      icon: HeartPulse,  label: 'System Health',    desc: 'Real-time module status' },
      { href: '/superadmin/ops/diagnostics', icon: ScanSearch,  label: 'Diagnostics',      desc: 'Full platform check suite' },
      { href: '/superadmin/ops/logs',        icon: ScrollText,  label: 'Unified Logs',     desc: 'Filter and trace platform events' },
      { href: '/superadmin/ops/backups',     icon: HardDrive,   label: 'Backup Center',    desc: 'Manual backups and history' },
      { href: '/superadmin/ops/runtime',     icon: Settings2,   label: 'Runtime Config',   desc: 'Edit settings without restart' },
      { href: '/superadmin/ops/security',    icon: ShieldAlert, label: 'Security',         desc: 'Alerts, sessions, and suspicious activity' },
    ],
  },
}

type Lang = keyof typeof T

export default function OpsHubPage() {
  const lang: Lang = 'ar'
  const t   = T[lang]
  const isRTL = lang === 'ar'

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <p className="text-zinc-400 mt-1 text-sm">{t.subtitle}</p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {t.cards.map(card => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href}
              className="group bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4
                         hover:border-zinc-600 hover:bg-zinc-800/60 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 bg-zinc-800 rounded-xl">
                  <Icon className="w-5 h-5 text-zinc-300" />
                </div>
                <ArrowRight className={`w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors ${isRTL ? 'rotate-180' : ''}`} />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">{card.label}</div>
                <div className="text-zinc-500 text-xs mt-0.5">{card.desc}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
