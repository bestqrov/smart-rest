import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto">

        <Link href="/landing" className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium mb-8 transition-colors">
          ← العودة إلى الصفحة الرئيسية
        </Link>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2 text-right" dir="rtl">
          سياسة الخصوصية
        </h1>
        <p className="text-sm text-gray-400 mb-2 text-right" dir="rtl">
          Privacy Policy — Politique de Confidentialité
        </p>
        <p className="text-xs text-gray-400 mb-10 text-right" dir="rtl">
          آخر تحديث: 29 مايو 2026
        </p>

        <div className="space-y-10 text-right" dir="rtl">

          {/* Intro */}
          <section>
            <p className="text-gray-700 text-sm leading-relaxed">
              تلتزم منصة SmartMenu (TinjDidDev) بحماية خصوصية مستخدميها وفق أعلى المعايير الدولية،
              بما يتوافق مع اللائحة الأوروبية العامة لحماية البيانات <strong>GDPR</strong>.
              تصف هذه الوثيقة ما نجمعه، وكيف نستخدمه، وحقوقك.
            </p>
          </section>

          {/* Data collected */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              1. البيانات التي نجمعها
            </h2>
            <ul className="space-y-2 text-gray-700 text-sm leading-relaxed list-none">
              {[
                'البريد الإلكتروني — Email (عند التسجيل)',
                'اسم المطعم أو المقهى',
                'بيانات الطلبات (الأصناف، الكميات، الطاولات، الأسعار)',
                'إحصاءات الاستخدام — Usage analytics (صفحات مُزارة، أوقات النشاط)',
                'عنوان IP (لأغراض الأمن ومكافحة الاحتيال)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 flex-row-reverse">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-500 text-xs mt-3">
              لا نجمع بيانات دفع مباشرة — المدفوعات تتم عبر مزودين خارجيين معتمدين (Stripe، Wave، إلخ).
            </p>
          </section>

          {/* Purpose */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              2. الغرض من معالجة البيانات
            </h2>
            <ul className="space-y-2 text-gray-700 text-sm leading-relaxed">
              {[
                'إدارة الحسابات وعمليات تسجيل الدخول',
                'معالجة الطلبات وإرسالها إلى المطبخ',
                'تحسين الخدمة وتطوير المنصة',
                'إرسال تنبيهات النظام (بريد التحقق، إعادة تعيين كلمة المرور)',
                'الامتثال للالتزامات القانونية',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 flex-row-reverse">
                  <span className="text-blue-500 mt-0.5 shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Storage */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              3. تخزين البيانات وأمنها
            </h2>
            <div className="space-y-2 text-gray-700 text-sm leading-relaxed">
              <p>
                تُخزّن البيانات في قاعدة بيانات <strong>MongoDB</strong> على خوادم خاصة مستضافة ذاتياً عبر Coolify.
              </p>
              <p>نستخدم HTTPS/TLS لتشفير كل الاتصالات.</p>
              <p>يتم الوصول إلى البيانات الحساسة بكلمات مرور مُجزّأة (bcrypt) فقط.</p>
              <p>لا يتم بيع البيانات أو مشاركتها مع أطراف ثالثة إلا في الحالات التي يقتضيها القانون.</p>
            </div>
          </section>

          {/* User rights */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              4. حقوقك — Vos Droits (GDPR)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { title: 'حق الوصول', desc: 'يمكنك طلب نسخة من بياناتك المخزنة في أي وقت.' },
                { title: 'حق الحذف', desc: 'يمكنك طلب حذف حسابك وجميع بياناتك نهائياً.' },
                { title: 'حق التصحيح', desc: 'يمكنك تصحيح أي معلومات خاطئة عبر لوحة التحكم.' },
              ].map(({ title, desc }) => (
                <div key={title} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="font-bold text-gray-900 text-sm mb-1">{title}</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-3">
              لممارسة حقوقك، تواصل معنا على:{' '}
              <a href="mailto:advicermano@gmail.com" className="text-emerald-600 hover:underline" dir="ltr">
                advicermano@gmail.com
              </a>
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              5. ملفات تعريف الارتباط — Cookies
            </h2>
            <div className="space-y-2 text-gray-700 text-sm leading-relaxed">
              <p>نستخدم نوعين من ملفات الارتباط فقط:</p>
              <ul className="space-y-1 mr-4">
                <li className="flex items-start gap-2 flex-row-reverse">
                  <span className="text-emerald-500 shrink-0">✓</span>
                  <span><strong>ملفات الجلسة (Session cookies)</strong> — ضرورية لتسجيل الدخول والحفاظ على جلستك.</span>
                </li>
                <li className="flex items-start gap-2 flex-row-reverse">
                  <span className="text-emerald-500 shrink-0">✓</span>
                  <span><strong>ملفات الإحصاءات (Analytics)</strong> — لفهم كيف تُستخدم المنصة وتحسينها.</span>
                </li>
              </ul>
              <p className="text-gray-500 text-xs">لا نستخدم ملفات ارتباط إعلانية أو تتبع خارجي.</p>
            </div>
          </section>

          {/* GDPR */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              6. الامتثال لـ GDPR
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              منصة SmartMenu متوافقة مع اللائحة الأوروبية العامة لحماية البيانات (GDPR).
              نطبق مبدأ الحد الأدنى من البيانات ولا نحتفظ بها أكثر مما هو ضروري.
              نوفر بانر موافقة ملفات الارتباط عند الزيارة الأولى.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              SmartMenu est conforme au Règlement Général sur la Protection des Données (RGPD).
              Nous appliquons le principe de minimisation des données et ne conservons que le strict nécessaire.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
              7. التواصل بخصوص الخصوصية
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              لأي استفسار يتعلق بخصوصيتك أو طلب ممارسة حقوقك، يرجى التواصل معنا على:
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
