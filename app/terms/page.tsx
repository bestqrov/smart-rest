import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto">

        <Link href="/landing" className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium mb-8 transition-colors">
          ← العودة إلى الصفحة الرئيسية
        </Link>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2 text-right" dir="rtl">
          شروط الاستخدام
        </h1>
        <p className="text-sm text-gray-400 mb-2 text-right" dir="rtl">
          Terms of Service — Conditions d'Utilisation
        </p>
        <p className="text-xs text-gray-400 mb-10 text-right" dir="rtl">
          آخر تحديث: 29 مايو 2026
        </p>

        <div className="space-y-10 text-right" dir="rtl">

          {/* Intro */}
          <section>
            <p className="text-gray-700 text-sm leading-relaxed">
              باستخدامك لمنصة SmartMenu (smartrestau.digima.cloud)، فأنت توافق على الشروط والأحكام التالية.
              يرجى قراءتها بعناية قبل التسجيل أو استخدام أي من خدماتنا.
              هذه الشروط مُبرمة بينك وبين TinjDidDev / Smart Resto.
            </p>
          </section>

          {/* Service description */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              1. وصف الخدمة
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              SmartMenu هي منصة SaaS (برمجيات كخدمة) متخصصة في إدارة المطاعم والمقاهي.
              تشمل الخدمات: منيو QR رقمي، استقبال الطلبات في الوقت الفعلي، شاشة المطبخ KDS،
              إدارة الموظفين والطاولات، الفواتير، الإحصاءات، ونظام التقييمات.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              SmartMenu est une plateforme SaaS spécialisée dans la gestion des restaurants et cafés,
              incluant menu QR, commandes en temps réel, KDS, gestion du personnel, facturation et analytics.
            </p>
          </section>

          {/* Account responsibility */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              2. مسؤولية الحساب
            </h2>
            <ul className="space-y-2 text-gray-700 text-sm leading-relaxed">
              {[
                'أنت مسؤول عن الحفاظ على سرية بيانات الدخول الخاصة بك.',
                'يُحظر مشاركة الحساب مع أطراف غير مصرح لها.',
                'أنت مسؤول عن جميع الأنشطة التي تتم باستخدام حسابك.',
                'في حالة الاشتباه في اختراق الحساب، يجب إخطارنا فوراً.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 flex-row-reverse">
                  <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Billing */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              3. الفوترة والأسعار — Facturation
            </h2>
            <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <p className="font-bold text-emerald-800 mb-1">7 أيام مجاناً — Essai Gratuit 7 Jours</p>
                <p className="text-emerald-700 text-xs">
                  جميع المميزات مفعّلة · بدون بطاقة بنكية · بدون التزام.
                  Toutes les fonctionnalités incluses · Sans carte bancaire · Sans engagement.
                </p>
              </div>
              <p>
                بعد انتهاء فترة التجربة، تُطبَّق <strong>عمولة رمزية على كل طلب مكتمل فقط</strong>.
                لا يوجد اشتراك شهري ثابت ولا رسوم إعداد.
              </p>
              <p>
                مقدار العمولة يتوقف على قيمة الطلب ومنطقتك الجغرافية (المغرب، السعودية، الإمارات، أفريقيا).
                راجع صفحة الأسعار للتفاصيل.
              </p>
              <p className="text-gray-600">
                Après la période d'essai, une petite commission par commande complétée s'applique uniquement.
                Pas d'abonnement mensuel ni de frais d'installation.
              </p>
            </div>
          </section>

          {/* Acceptable use */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              4. الاستخدام المقبول
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              يُحظر استخدام المنصة في:
            </p>
            <ul className="space-y-2 text-gray-700 text-sm leading-relaxed">
              {[
                'نشر محتوى مضلل، مسيء، أو غير قانوني',
                'محاولة اختراق النظام أو استغلال الثغرات الأمنية',
                'إنشاء طلبات وهمية أو احتيالية',
                'انتحال صفة مطعم أو جهة أخرى',
                'إعاقة استخدام المنصة من قِبل مستخدمين آخرين',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 flex-row-reverse">
                  <span className="text-red-500 mt-0.5 shrink-0">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              5. إنهاء الخدمة — Résiliation
            </h2>
            <div className="space-y-2 text-gray-700 text-sm leading-relaxed">
              <p>يمكنك إلغاء حسابك في أي وقت من لوحة التحكم أو بالتواصل معنا عبر البريد الإلكتروني.</p>
              <p>
                يحق لـ SmartMenu تعليق أو إنهاء حساب أي مستخدم يخالف هذه الشروط، مع إشعار مسبق حيثما أمكن.
              </p>
              <p className="text-gray-600">
                Vous pouvez résilier votre compte à tout moment. SmartMenu se réserve le droit de suspendre tout compte
                en cas de violation des présentes conditions.
              </p>
            </div>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              6. تعديل الشروط — Modifications
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              تحتفظ Smart Resto بالحق في تعديل هذه الشروط في أي وقت.
              سيتم إخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة.
              استمرارك في استخدام المنصة بعد الإخطار يُعدّ قبولاً للشروط المحدّثة.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              Smart Resto se réserve le droit de modifier ces conditions à tout moment.
              Vous serez notifié par email ou via la plateforme de toute modification substantielle.
            </p>
          </section>

          {/* Governing law */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              7. القانون الحاكم — Droit Applicable
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              تخضع هذه الشروط وتُفسَّر وفقاً للقانون المغربي.
              في حالة أي نزاع ينشأ عن هذه الشروط أو المنصة، تكون محاكم المملكة المغربية صاحبة الاختصاص الحصري.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              Les présentes conditions sont régies par le droit marocain.
              Tout litige relatif à ces conditions ou à la plateforme sera soumis à la compétence exclusive des tribunaux du Royaume du Maroc.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              8. التواصل
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              لأي استفسار بخصوص هذه الشروط، يمكنك التواصل معنا على:
            </p>
            <a href="mailto:advicermano@gmail.com"
              className="inline-block mt-2 text-emerald-600 hover:underline font-semibold text-sm" dir="ltr">
              advicermano@gmail.com
            </a>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} SmartMenu — TinjDidDev · Tous droits réservés</p>
        </div>
      </div>
    </main>
  )
}
