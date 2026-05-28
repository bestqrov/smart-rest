import Link from 'next/link'

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto">

        <Link href="/landing" className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium mb-8 transition-colors">
          ← العودة إلى الصفحة الرئيسية
        </Link>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2 text-right" dir="rtl">
          الإشعار القانوني
        </h1>
        <p className="text-sm text-gray-400 mb-10 text-right" dir="rtl">
          Legal Notice — Mentions Légales
        </p>
        <p className="text-xs text-gray-400 mb-10 text-right" dir="rtl">
          آخر تحديث: 29 مايو 2026
        </p>

        <div className="space-y-10 text-right" dir="rtl">

          {/* Publisher info */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              1. معلومات الناشر — Éditeur
            </h2>
            <div className="space-y-1 text-gray-700 text-sm leading-relaxed">
              <p><span className="font-semibold">الاسم التجاري / Nom commercial :</span> Smart Resto</p>
              <p><span className="font-semibold">المطور / Développeur :</span> TinjDidDev</p>
              <p><span className="font-semibold">المنصة / Plateforme :</span> SmartMenu</p>
              <p><span className="font-semibold">الموقع / Site web :</span>{' '}
                <a href="https://smartrestau.digima.cloud" className="text-emerald-600 hover:underline" dir="ltr">
                  smartrestau.digima.cloud
                </a>
              </p>
              <p><span className="font-semibold">البريد الإلكتروني / Email :</span>{' '}
                <a href="mailto:advicermano@gmail.com" className="text-emerald-600 hover:underline" dir="ltr">
                  advicermano@gmail.com
                </a>
              </p>
              <p><span className="font-semibold">الدولة / Pays :</span> المملكة المغربية — Royaume du Maroc</p>
            </div>
          </section>

          {/* Hosting */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              2. الاستضافة — Hébergement
            </h2>
            <div className="space-y-1 text-gray-700 text-sm leading-relaxed">
              <p>يتم استضافة هذه المنصة باستخدام حل الاستضافة الذاتية <strong>Coolify</strong>.</p>
              <p>
                Cette plateforme est hébergée via la solution auto-hébergée <strong>Coolify</strong>.
              </p>
              <p className="text-gray-500 text-xs mt-2">
                جميع البيانات مخزنة على خوادم خاصة مؤمّنة ومتحكم فيها بالكامل من طرف TinjDidDev.
              </p>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              3. الملكية الفكرية — Propriété Intellectuelle
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              جميع عناصر هذه المنصة — بما فيها الكود المصدري، التصميم، الشعار، والمحتوى — هي ملكية حصرية لـ TinjDidDev / Smart Resto.
              يُحظر نسخها أو تعديلها أو توزيعها دون إذن كتابي مسبق.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              Tous les éléments de cette plateforme (code source, design, logo, contenu) sont la propriété exclusive de TinjDidDev / Smart Resto.
              Toute reproduction ou distribution sans autorisation écrite préalable est interdite.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              4. تحديد المسؤولية — Limitation de Responsabilité
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              تبذل Smart Resto قصارى جهدها لضمان دقة المعلومات المقدمة على المنصة، غير أنها لا تضمن خلوها من الأخطاء أو الانقطاعات.
              لا تتحمل الشركة أي مسؤولية عن الأضرار الناتجة عن استخدام المنصة أو توقفها المؤقت.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              Smart Resto ne saurait être tenue responsable des dommages résultant de l'utilisation de la plateforme ou de toute interruption de service.
            </p>
          </section>

          {/* Jurisdiction */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              5. الاختصاص القضائي — Juridiction
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              يخضع هذا الإشعار القانوني للقانون المغربي. في حالة النزاع، تكون محاكم المغرب هي المختصة.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              Les présentes mentions légales sont soumises au droit marocain. En cas de litige, les tribunaux marocains seront seuls compétents.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} SmartMenu — TinjDidDev · Tous droits réservés</p>
        </div>
      </div>
    </main>
  )
}
