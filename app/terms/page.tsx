'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Lang = 'en' | 'fr' | 'ar'

const T = {
  ar: {
    back: '← العودة إلى الصفحة الرئيسية',
    title: 'شروط الاستخدام',
    subtitle: 'Terms of Service — Conditions d\'Utilisation',
    updated: 'آخر تحديث: 29 مايو 2026',
    dir: 'rtl' as const,
    intro: 'باستخدامك لمنصة SmartRestau (smartrestau.digima.cloud)، فأنت توافق على الشروط والأحكام التالية. يرجى قراءتها بعناية قبل التسجيل أو استخدام أي من خدماتنا. هذه الشروط مُبرمة بينك وبين TinjDidDev / SmartRestau.',
    sections: [
      {
        title: '1. وصف الخدمة',
        type: 'text' as const,
        paragraphs: [
          'SmartRestau هي منصة SaaS (برمجيات كخدمة) متخصصة في إدارة المطاعم والمقاهي. تشمل الخدمات: منيو QR رقمي، استقبال الطلبات في الوقت الفعلي، شاشة المطبخ KDS، إدارة الموظفين والطاولات، الفواتير، الإحصاءات، ونظام التقييمات.',
        ],
      },
      {
        title: '2. مسؤولية الحساب',
        type: 'list' as const,
        bullet: '!', bulletColor: 'text-amber-500',
        items: [
          'أنت مسؤول عن الحفاظ على سرية بيانات الدخول الخاصة بك.',
          'يُحظر مشاركة الحساب مع أطراف غير مصرح لها.',
          'أنت مسؤول عن جميع الأنشطة التي تتم باستخدام حسابك.',
          'في حالة الاشتباه في اختراق الحساب، يجب إخطارنا فوراً.',
        ],
      },
      {
        title: '3. الفوترة والأسعار',
        type: 'billing' as const,
        trialTitle: '7 أيام مجاناً — Essai Gratuit 7 Jours',
        trialDesc: 'جميع المميزات مفعّلة · بدون بطاقة بنكية · بدون التزام.',
        paragraphs: [
          'بعد انتهاء فترة التجربة، تُطبَّق عمولة رمزية على كل طلب مكتمل فقط. لا يوجد اشتراك شهري ثابت ولا رسوم إعداد.',
          'مقدار العمولة يتوقف على قيمة الطلب ومنطقتك الجغرافية (المغرب، السعودية، الإمارات، أفريقيا). راجع صفحة الأسعار للتفاصيل.',
        ],
      },
      {
        title: '4. الاستخدام المقبول',
        type: 'list' as const,
        bullet: '✗', bulletColor: 'text-red-500',
        preText: 'يُحظر استخدام المنصة في:',
        items: [
          'نشر محتوى مضلل، مسيء، أو غير قانوني',
          'محاولة اختراق النظام أو استغلال الثغرات الأمنية',
          'إنشاء طلبات وهمية أو احتيالية',
          'انتحال صفة مطعم أو جهة أخرى',
          'إعاقة استخدام المنصة من قِبل مستخدمين آخرين',
        ],
      },
      {
        title: '5. إنهاء الخدمة',
        type: 'text' as const,
        paragraphs: [
          'يمكنك إلغاء حسابك في أي وقت من لوحة التحكم أو بالتواصل معنا عبر البريد الإلكتروني.',
          'يحق لـ SmartRestau تعليق أو إنهاء حساب أي مستخدم يخالف هذه الشروط، مع إشعار مسبق حيثما أمكن.',
        ],
      },
      {
        title: '6. تعديل الشروط',
        type: 'text' as const,
        paragraphs: [
          'تحتفظ SmartRestau بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة. استمرارك في استخدام المنصة بعد الإخطار يُعدّ قبولاً للشروط المحدّثة.',
        ],
      },
      {
        title: '7. القانون الحاكم',
        type: 'text' as const,
        paragraphs: [
          'تخضع هذه الشروط وتُفسَّر وفقاً للقانون المغربي. في حالة أي نزاع ينشأ عن هذه الشروط أو المنصة، تكون محاكم المملكة المغربية صاحبة الاختصاص الحصري.',
        ],
      },
    ],
    contact: { title: '8. التواصل', text: 'لأي استفسار بخصوص هذه الشروط، يمكنك التواصل معنا على:' },
    footer: `© ${new Date().getFullYear()} SmartRestau — TinjDidDev · جميع الحقوق محفوظة`,
  },
  fr: {
    back: '← Retour à la page d\'accueil',
    title: 'Conditions d\'Utilisation',
    subtitle: 'Terms of Service — شروط الاستخدام',
    updated: 'Dernière mise à jour : 29 mai 2026',
    dir: 'ltr' as const,
    intro: 'En utilisant la plateforme SmartRestau (smartrestau.digima.cloud), vous acceptez les conditions générales suivantes. Veuillez les lire attentivement avant de vous inscrire ou d\'utiliser nos services. Ces conditions sont conclues entre vous et TinjDidDev / SmartRestau.',
    sections: [
      {
        title: '1. Description du service',
        type: 'text' as const,
        paragraphs: [
          'SmartRestau est une plateforme SaaS (logiciel en tant que service) spécialisée dans la gestion des restaurants et cafés. Les services comprennent : menu QR numérique, réception des commandes en temps réel, écran cuisine KDS, gestion du personnel et des tables, facturation, statistiques et système d\'avis.',
        ],
      },
      {
        title: '2. Responsabilité du compte',
        type: 'list' as const,
        bullet: '!', bulletColor: 'text-amber-500',
        items: [
          'Vous êtes responsable de la confidentialité de vos identifiants de connexion.',
          'Il est interdit de partager votre compte avec des tiers non autorisés.',
          'Vous êtes responsable de toutes les activités effectuées avec votre compte.',
          'En cas de suspicion de compromission du compte, vous devez nous en informer immédiatement.',
        ],
      },
      {
        title: '3. Facturation et tarifs',
        type: 'billing' as const,
        trialTitle: 'Essai Gratuit 7 Jours — 7 أيام مجاناً',
        trialDesc: 'Toutes les fonctionnalités incluses · Sans carte bancaire · Sans engagement.',
        paragraphs: [
          'Après la période d\'essai, une petite commission par commande complétée s\'applique uniquement. Pas d\'abonnement mensuel ni de frais d\'installation.',
          'Le montant de la commission dépend de la valeur de la commande et de votre région (Maroc, Arabie Saoudite, Émirats, Afrique). Voir la page tarifs pour les détails.',
        ],
      },
      {
        title: '4. Utilisation acceptable',
        type: 'list' as const,
        bullet: '✗', bulletColor: 'text-red-500',
        preText: 'Il est interdit d\'utiliser la plateforme pour :',
        items: [
          'Publier du contenu trompeur, abusif ou illégal',
          'Tenter de pirater le système ou d\'exploiter des failles de sécurité',
          'Créer des commandes fictives ou frauduleuses',
          'Usurper l\'identité d\'un restaurant ou d\'une autre entité',
          'Gêner l\'utilisation de la plateforme par d\'autres utilisateurs',
        ],
      },
      {
        title: '5. Résiliation',
        type: 'text' as const,
        paragraphs: [
          'Vous pouvez résilier votre compte à tout moment depuis votre tableau de bord ou en nous contactant par e-mail.',
          'SmartRestau se réserve le droit de suspendre ou de résilier le compte de tout utilisateur qui enfreint ces conditions, avec un préavis dans la mesure du possible.',
        ],
      },
      {
        title: '6. Modifications des conditions',
        type: 'text' as const,
        paragraphs: [
          'SmartRestau se réserve le droit de modifier ces conditions à tout moment. Vous serez notifié de tout changement substantiel par e-mail ou via la plateforme. La poursuite de l\'utilisation de la plateforme après notification vaut acceptation des conditions mises à jour.',
        ],
      },
      {
        title: '7. Droit applicable',
        type: 'text' as const,
        paragraphs: [
          'Les présentes conditions sont régies et interprétées conformément au droit marocain. En cas de litige découlant de ces conditions ou de la plateforme, les tribunaux du Royaume du Maroc auront compétence exclusive.',
        ],
      },
    ],
    contact: { title: '8. Contact', text: 'Pour toute question concernant ces conditions, contactez-nous à :' },
    footer: `© ${new Date().getFullYear()} SmartRestau — TinjDidDev · Tous droits réservés`,
  },
  en: {
    back: '← Back to Homepage',
    title: 'Terms of Service',
    subtitle: 'Conditions d\'Utilisation — شروط الاستخدام',
    updated: 'Last updated: May 29, 2026',
    dir: 'ltr' as const,
    intro: 'By using the SmartRestau platform (smartrestau.digima.cloud), you agree to the following terms and conditions. Please read them carefully before registering or using any of our services. These terms are entered into between you and TinjDidDev / SmartRestau.',
    sections: [
      {
        title: '1. Service Description',
        type: 'text' as const,
        paragraphs: [
          'SmartRestau is a SaaS (Software as a Service) platform specialising in restaurant and café management. Services include: digital QR menu, real-time order reception, kitchen display screen (KDS), staff and table management, invoicing, analytics, and a review system.',
        ],
      },
      {
        title: '2. Account Responsibility',
        type: 'list' as const,
        bullet: '!', bulletColor: 'text-amber-500',
        items: [
          'You are responsible for maintaining the confidentiality of your login credentials.',
          'Sharing your account with unauthorised third parties is prohibited.',
          'You are responsible for all activities carried out using your account.',
          'If you suspect your account has been compromised, you must notify us immediately.',
        ],
      },
      {
        title: '3. Billing and Pricing',
        type: 'billing' as const,
        trialTitle: '7-Day Free Trial — Essai Gratuit 7 Jours',
        trialDesc: 'All features included · No credit card required · No commitment.',
        paragraphs: [
          'After the trial period, a small commission per completed order only applies. No monthly subscription or setup fees.',
          'The commission amount depends on the order value and your region (Morocco, Saudi Arabia, UAE, Africa). See the pricing page for details.',
        ],
      },
      {
        title: '4. Acceptable Use',
        type: 'list' as const,
        bullet: '✗', bulletColor: 'text-red-500',
        preText: 'You may not use the platform to:',
        items: [
          'Publish misleading, abusive, or illegal content',
          'Attempt to hack the system or exploit security vulnerabilities',
          'Create fake or fraudulent orders',
          'Impersonate a restaurant or other entity',
          'Interfere with other users\' use of the platform',
        ],
      },
      {
        title: '5. Termination',
        type: 'text' as const,
        paragraphs: [
          'You may cancel your account at any time from your dashboard or by contacting us by email.',
          'SmartRestau reserves the right to suspend or terminate any account that violates these terms, with prior notice where possible.',
        ],
      },
      {
        title: '6. Modifications to Terms',
        type: 'text' as const,
        paragraphs: [
          'SmartRestau reserves the right to modify these terms at any time. You will be notified of any material changes by email or via the platform. Continued use of the platform after notification constitutes acceptance of the updated terms.',
        ],
      },
      {
        title: '7. Governing Law',
        type: 'text' as const,
        paragraphs: [
          'These terms are governed by and construed in accordance with Moroccan law. Any dispute arising from these terms or the platform shall be subject to the exclusive jurisdiction of the courts of the Kingdom of Morocco.',
        ],
      },
    ],
    contact: { title: '8. Contact', text: 'For any questions regarding these terms, contact us at:' },
    footer: `© ${new Date().getFullYear()} SmartRestau — TinjDidDev · All rights reserved`,
  },
}

const LANGS: { code: Lang; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
]

export default function TermsPage() {
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

          {/* All sections */}
          {t.sections.map(s => (
            <section key={s.title}>
              <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">{s.title}</h2>

              {s.type === 'text' && (
                <div className="space-y-2 text-gray-700 text-sm leading-relaxed">
                  {s.paragraphs!.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}

              {s.type === 'list' && (
                <>
                  {s.preText && <p className="text-gray-700 text-sm leading-relaxed mb-3">{s.preText}</p>}
                  <ul className="space-y-2 text-gray-700 text-sm leading-relaxed list-none">
                    {s.items!.map(item => (
                      <li key={item} className={`flex items-start gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <span className={`${s.bulletColor} mt-0.5 shrink-0`}>{s.bullet}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {s.type === 'billing' && (
                <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <p className="font-bold text-emerald-800 mb-1">{s.trialTitle}</p>
                    <p className="text-emerald-700 text-xs">{s.trialDesc}</p>
                  </div>
                  {s.paragraphs!.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}
            </section>
          ))}

          {/* Contact */}
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
