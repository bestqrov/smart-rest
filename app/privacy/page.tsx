'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Lang = 'en' | 'fr' | 'ar'

const T = {
  ar: {
    back: '← العودة إلى الصفحة الرئيسية',
    title: 'سياسة الخصوصية',
    subtitle: 'Privacy Policy — Politique de Confidentialité',
    updated: 'آخر تحديث: 29 مايو 2026',
    dir: 'rtl' as const,
    intro: 'تلتزم منصة SmartRestau (TinjDidDev) بحماية خصوصية مستخدميها وفق أعلى المعايير الدولية، بما يتوافق مع اللائحة الأوروبية العامة لحماية البيانات GDPR. تصف هذه الوثيقة ما نجمعه، وكيف نستخدمه، وحقوقك.',
    sections: [
      {
        title: '1. البيانات التي نجمعها',
        type: 'list' as const,
        bullet: '✓', bulletColor: 'text-emerald-500',
        items: [
          'البريد الإلكتروني — Email (عند التسجيل)',
          'اسم المطعم أو المقهى',
          'بيانات الطلبات (الأصناف، الكميات، الطاولات، الأسعار)',
          'إحصاءات الاستخدام (صفحات مُزارة، أوقات النشاط)',
          'عنوان IP (لأغراض الأمن ومكافحة الاحتيال)',
        ],
        note: 'لا نجمع بيانات دفع مباشرة — المدفوعات تتم عبر مزودين خارجيين معتمدين (Stripe، Wave، إلخ).',
      },
      {
        title: '2. الغرض من معالجة البيانات',
        type: 'list' as const,
        bullet: '→', bulletColor: 'text-blue-500',
        items: [
          'إدارة الحسابات وعمليات تسجيل الدخول',
          'معالجة الطلبات وإرسالها إلى المطبخ',
          'تحسين الخدمة وتطوير المنصة',
          'إرسال تنبيهات النظام (بريد التحقق، إعادة تعيين كلمة المرور)',
          'الامتثال للالتزامات القانونية',
        ],
      },
      {
        title: '3. تخزين البيانات وأمنها',
        type: 'text' as const,
        paragraphs: [
          'تُخزّن البيانات في قاعدة بيانات MongoDB على خوادم خاصة مستضافة ذاتياً عبر Coolify.',
          'نستخدم HTTPS/TLS لتشفير كل الاتصالات.',
          'يتم الوصول إلى البيانات الحساسة بكلمات مرور مُجزّأة (bcrypt) فقط.',
          'لا يتم بيع البيانات أو مشاركتها مع أطراف ثالثة إلا في الحالات التي يقتضيها القانون.',
        ],
      },
      {
        title: '5. ملفات تعريف الارتباط — Cookies',
        type: 'text' as const,
        paragraphs: [
          'نستخدم نوعين من ملفات الارتباط فقط: ملفات الجلسة (ضرورية لتسجيل الدخول) وملفات الإحصاءات (لفهم كيف تُستخدم المنصة). لا نستخدم ملفات ارتباط إعلانية أو تتبع خارجي.',
        ],
      },
      {
        title: '6. الامتثال لـ GDPR',
        type: 'text' as const,
        paragraphs: [
          'منصة SmartRestau متوافقة مع اللائحة الأوروبية العامة لحماية البيانات (GDPR). نطبق مبدأ الحد الأدنى من البيانات ولا نحتفظ بها أكثر مما هو ضروري. نوفر بانر موافقة ملفات الارتباط عند الزيارة الأولى.',
        ],
      },
    ],
    rights: {
      title: '4. حقوقك (GDPR)',
      items: [
        { title: 'حق الوصول', desc: 'يمكنك طلب نسخة من بياناتك المخزنة في أي وقت.' },
        { title: 'حق الحذف', desc: 'يمكنك طلب حذف حسابك وجميع بياناتك نهائياً.' },
        { title: 'حق التصحيح', desc: 'يمكنك تصحيح أي معلومات خاطئة عبر لوحة التحكم.' },
      ],
      note: 'لممارسة حقوقك، تواصل معنا على:',
    },
    contact: { title: '7. التواصل بخصوص الخصوصية', text: 'لأي استفسار يتعلق بخصوصيتك أو طلب ممارسة حقوقك، يرجى التواصل معنا على:' },
    footer: `© ${new Date().getFullYear()} SmartRestau — TinjDidDev · جميع الحقوق محفوظة`,
  },
  fr: {
    back: '← Retour à la page d\'accueil',
    title: 'Politique de Confidentialité',
    subtitle: 'Privacy Policy — سياسة الخصوصية',
    updated: 'Dernière mise à jour : 29 mai 2026',
    dir: 'ltr' as const,
    intro: 'SmartRestau (TinjDidDev) s\'engage à protéger la confidentialité de ses utilisateurs conformément aux plus hautes normes internationales, notamment le Règlement Général sur la Protection des Données (RGPD). Ce document décrit ce que nous collectons, comment nous l\'utilisons et vos droits.',
    sections: [
      {
        title: '1. Données collectées',
        type: 'list' as const,
        bullet: '✓', bulletColor: 'text-emerald-500',
        items: [
          'Adresse e-mail (lors de l\'inscription)',
          'Nom du restaurant ou café',
          'Données de commandes (articles, quantités, tables, prix)',
          'Statistiques d\'utilisation (pages visitées, heures d\'activité)',
          'Adresse IP (à des fins de sécurité et de lutte contre la fraude)',
        ],
        note: 'Nous ne collectons pas directement de données de paiement — les paiements sont traités par des prestataires tiers certifiés (Stripe, Wave, etc.).',
      },
      {
        title: '2. Finalités du traitement',
        type: 'list' as const,
        bullet: '→', bulletColor: 'text-blue-500',
        items: [
          'Gestion des comptes et authentification',
          'Traitement des commandes et envoi en cuisine',
          'Amélioration et développement de la plateforme',
          'Envoi de notifications système (vérification e-mail, réinitialisation du mot de passe)',
          'Conformité aux obligations légales',
        ],
      },
      {
        title: '3. Stockage et sécurité des données',
        type: 'text' as const,
        paragraphs: [
          'Les données sont stockées dans une base de données MongoDB sur des serveurs privés auto-hébergés via Coolify.',
          'Nous utilisons HTTPS/TLS pour chiffrer toutes les communications.',
          'L\'accès aux données sensibles est protégé par des mots de passe hachés (bcrypt).',
          'Aucune donnée n\'est vendue ou partagée avec des tiers, sauf obligation légale.',
        ],
      },
      {
        title: '5. Cookies',
        type: 'text' as const,
        paragraphs: [
          'Nous utilisons uniquement deux types de cookies : les cookies de session (nécessaires à la connexion) et les cookies d\'analyse (pour comprendre l\'utilisation de la plateforme). Nous n\'utilisons pas de cookies publicitaires ni de pistage externe.',
        ],
      },
      {
        title: '6. Conformité RGPD',
        type: 'text' as const,
        paragraphs: [
          'SmartRestau est conforme au Règlement Général sur la Protection des Données (RGPD). Nous appliquons le principe de minimisation des données et ne les conservons que le strict nécessaire. Une bannière de consentement aux cookies est affichée lors de la première visite.',
        ],
      },
    ],
    rights: {
      title: '4. Vos droits (RGPD)',
      items: [
        { title: 'Droit d\'accès', desc: 'Vous pouvez demander une copie de vos données stockées à tout moment.' },
        { title: 'Droit à l\'effacement', desc: 'Vous pouvez demander la suppression définitive de votre compte et de toutes vos données.' },
        { title: 'Droit de rectification', desc: 'Vous pouvez corriger toute information incorrecte via votre tableau de bord.' },
      ],
      note: 'Pour exercer vos droits, contactez-nous à :',
    },
    contact: { title: '7. Contact Confidentialité', text: 'Pour toute question relative à votre confidentialité ou pour exercer vos droits, contactez-nous à :' },
    footer: `© ${new Date().getFullYear()} SmartRestau — TinjDidDev · Tous droits réservés`,
  },
  en: {
    back: '← Back to Homepage',
    title: 'Privacy Policy',
    subtitle: 'Politique de Confidentialité — سياسة الخصوصية',
    updated: 'Last updated: May 29, 2026',
    dir: 'ltr' as const,
    intro: 'SmartRestau (TinjDidDev) is committed to protecting the privacy of its users in accordance with the highest international standards, including the General Data Protection Regulation (GDPR). This document describes what we collect, how we use it, and your rights.',
    sections: [
      {
        title: '1. Data We Collect',
        type: 'list' as const,
        bullet: '✓', bulletColor: 'text-emerald-500',
        items: [
          'Email address (upon registration)',
          'Restaurant or café name',
          'Order data (items, quantities, tables, prices)',
          'Usage analytics (pages visited, activity times)',
          'IP address (for security and anti-fraud purposes)',
        ],
        note: 'We do not directly collect payment data — payments are processed by certified third-party providers (Stripe, Wave, etc.).',
      },
      {
        title: '2. Purpose of Data Processing',
        type: 'list' as const,
        bullet: '→', bulletColor: 'text-blue-500',
        items: [
          'Account management and authentication',
          'Order processing and kitchen dispatch',
          'Platform improvement and development',
          'System notifications (email verification, password reset)',
          'Compliance with legal obligations',
        ],
      },
      {
        title: '3. Data Storage and Security',
        type: 'text' as const,
        paragraphs: [
          'Data is stored in a MongoDB database on private self-hosted servers via Coolify.',
          'We use HTTPS/TLS to encrypt all communications.',
          'Access to sensitive data is protected by hashed passwords (bcrypt).',
          'No data is sold or shared with third parties except as required by law.',
        ],
      },
      {
        title: '5. Cookies',
        type: 'text' as const,
        paragraphs: [
          'We use only two types of cookies: session cookies (necessary for login) and analytics cookies (to understand platform usage). We do not use advertising cookies or external trackers.',
        ],
      },
      {
        title: '6. GDPR Compliance',
        type: 'text' as const,
        paragraphs: [
          'SmartRestau is compliant with the General Data Protection Regulation (GDPR). We apply the principle of data minimisation and do not retain data longer than necessary. A cookie consent banner is displayed on the first visit.',
        ],
      },
    ],
    rights: {
      title: '4. Your Rights (GDPR)',
      items: [
        { title: 'Right of Access', desc: 'You can request a copy of your stored data at any time.' },
        { title: 'Right to Erasure', desc: 'You can request permanent deletion of your account and all your data.' },
        { title: 'Right to Rectification', desc: 'You can correct any incorrect information via your dashboard.' },
      ],
      note: 'To exercise your rights, contact us at:',
    },
    contact: { title: '7. Privacy Contact', text: 'For any questions regarding your privacy or to exercise your rights, please contact us at:' },
    footer: `© ${new Date().getFullYear()} SmartRestau — TinjDidDev · All rights reserved`,
  },
}

const LANGS: { code: Lang; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
]

export default function PrivacyPage() {
  const [lang, setLang] = useState<Lang>('ar')

  useEffect(() => {
    const saved = localStorage.getItem('landing-lang') as Lang | null
    if (saved && ['ar', 'fr', 'en'].includes(saved)) setLang(saved)
  }, [])

  const t = T[lang]
  const isRtl = lang === 'ar'

  return (
    <main className="min-h-screen bg-white py-16 px-4" dir={t.dir}>
      <div className="max-w-3xl mx-auto">

        {/* Top bar */}
        <div className={`flex items-center justify-between mb-8 flex-wrap gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Link href="/landing" className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
            {t.back}
          </Link>
          <div className="flex gap-1">
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); localStorage.setItem('landing-lang', l.code) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${lang === l.code ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{t.title}</h1>
        <p className="text-sm text-gray-400 mb-1">{t.subtitle}</p>
        <p className="text-xs text-gray-400 mb-10">{t.updated}</p>

        <div className="space-y-10">

          {/* Intro */}
          <section>
            <p className="text-gray-700 text-sm leading-relaxed">{t.intro}</p>
          </section>

          {/* Sections 1–3 */}
          {t.sections.slice(0, 3).map(s => (
            <section key={s.title}>
              <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">{s.title}</h2>
              {s.type === 'list' ? (
                <>
                  <ul className="space-y-2 text-gray-700 text-sm leading-relaxed list-none">
                    {s.items!.map(item => (
                      <li key={item} className={`flex items-start gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <span className={`${s.bulletColor} mt-0.5 shrink-0`}>{s.bullet}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {s.note && <p className="text-gray-500 text-xs mt-3">{s.note}</p>}
                </>
              ) : (
                <div className="space-y-2 text-gray-700 text-sm leading-relaxed">
                  {s.paragraphs!.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}
            </section>
          ))}

          {/* Rights — section 4 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">{t.rights.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {t.rights.items.map(r => (
                <div key={r.title} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="font-bold text-gray-900 text-sm mb-1">{r.title}</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-3">
              {t.rights.note}{' '}
              <a href="mailto:SmartRestau@gmail.com" className="text-emerald-600 hover:underline" dir="ltr">
                SmartRestau@gmail.com
              </a>
            </p>
          </section>

          {/* Sections 5–6 */}
          {t.sections.slice(3).map(s => (
            <section key={s.title}>
              <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">{s.title}</h2>
              <div className="space-y-2 text-gray-700 text-sm leading-relaxed">
                {s.paragraphs!.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>
          ))}

          {/* Contact — section 7 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">{t.contact.title}</h2>
            <p className="text-gray-700 text-sm leading-relaxed">{t.contact.text}</p>
            <div className={`flex flex-col gap-2 mt-3 ${isRtl ? 'items-end' : 'items-start'}`}>
              <a href="mailto:SmartRestau@gmail.com" className="text-emerald-600 hover:underline font-semibold text-sm" dir="ltr">
                SmartRestau@gmail.com
              </a>
              <a href="https://wa.me/34664546849" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline font-semibold text-sm" dir="ltr">
                WhatsApp: +34 664 546 849
              </a>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">{t.footer}</p>
        </div>
      </div>
    </main>
  )
}
