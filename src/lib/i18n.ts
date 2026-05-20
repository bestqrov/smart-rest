/**
 * i18n — Four-language dictionary for Smart Resto registration flow.
 * Languages: Arabic (ar · RTL), French (fr), English (en), Spanish (es).
 *
 * Usage (backend):  import { t, isRTL } from '../lib/i18n'
 * Usage (frontend): import { t, isRTL } from '../../src/lib/i18n'  (or copy the dict)
 */

export type Lang = 'ar' | 'fr' | 'en' | 'es'

export const SUPPORTED_LANGS: Lang[] = ['ar', 'fr', 'en', 'es']

export function isRTL(lang: Lang): boolean {
  return lang === 'ar'
}

export function resolveLang(raw?: string | null): Lang {
  if (raw && SUPPORTED_LANGS.includes(raw as Lang)) return raw as Lang
  return 'ar'
}

// ─── Full dictionary ──────────────────────────────────────────────────────────

const dict = {
  // ── Page meta ────────────────────────────────────────────────────────────
  page_title: {
    ar: 'أنشئ حسابك مجاناً — Smart Resto',
    fr: 'Créer votre compte gratuitement — Smart Resto',
    en: 'Create your free account — Smart Resto',
    es: 'Crea tu cuenta gratis — Smart Resto'
  },
  page_subtitle: {
    ar: 'جاهز خلال دقيقتين، بدون بطاقة بنكية',
    fr: 'Prêt en 2 minutes, sans carte bancaire',
    en: 'Ready in 2 minutes, no credit card needed',
    es: 'Listo en 2 minutos, sin tarjeta de crédito'
  },
  // ── Nav / brand ───────────────────────────────────────────────────────────
  brand_tagline: {
    ar: 'قائمة طعام ذكية لمطعمك',
    fr: 'Menu numérique intelligent pour votre restaurant',
    en: 'Smart digital menu for your restaurant',
    es: 'Menú digital inteligente para tu restaurante'
  },
  // ── Form labels ───────────────────────────────────────────────────────────
  label_cafe_name: {
    ar: 'اسم المطعم أو المقهى',
    fr: 'Nom du restaurant ou café',
    en: 'Restaurant or café name',
    es: 'Nombre del restaurante o café'
  },
  label_subdomain: {
    ar: 'رابط المطعم (subdomain)',
    fr: 'Adresse web (sous-domaine)',
    en: 'Web address (subdomain)',
    es: 'Dirección web (subdominio)'
  },
  label_email: {
    ar: 'البريد الإلكتروني',
    fr: 'Adresse e-mail',
    en: 'E-mail address',
    es: 'Dirección de correo'
  },
  label_country: {
    ar: 'الدولة',
    fr: 'Pays',
    en: 'Country',
    es: 'País'
  },
  label_lang: {
    ar: 'اللغة',
    fr: 'Langue',
    en: 'Language',
    es: 'Idioma'
  },
  // ── Placeholders ──────────────────────────────────────────────────────────
  placeholder_cafe_name: {
    ar: 'مثال: مقهى النجمة',
    fr: 'Ex. : Café des Étoiles',
    en: 'E.g. The Golden Star Café',
    es: 'Ej. Café La Estrella'
  },
  placeholder_subdomain: {
    ar: 'my-cafe',
    fr: 'mon-cafe',
    en: 'my-cafe',
    es: 'mi-cafe'
  },
  placeholder_email: {
    ar: 'you@gmail.com',
    fr: 'vous@gmail.com',
    en: 'you@gmail.com',
    es: 'tu@gmail.com'
  },
  // ── Subdomain hint ────────────────────────────────────────────────────────
  subdomain_preview: {
    ar: 'سيكون رابطك:',
    fr: 'Votre adresse sera :',
    en: 'Your link will be:',
    es: 'Tu enlace será:'
  },
  // ── Buttons ───────────────────────────────────────────────────────────────
  btn_send_link: {
    ar: 'إرسال رابط التفعيل',
    fr: 'Envoyer le lien magique',
    en: 'Send magic link',
    es: 'Enviar enlace mágico'
  },
  btn_sending: {
    ar: 'جارٍ الإرسال…',
    fr: 'Envoi en cours…',
    en: 'Sending…',
    es: 'Enviando…'
  },
  // ── Success state ─────────────────────────────────────────────────────────
  success_title: {
    ar: 'تحقق من بريدك الإلكتروني ✉️',
    fr: 'Vérifiez votre boîte mail ✉️',
    en: 'Check your inbox ✉️',
    es: 'Revisa tu correo ✉️'
  },
  success_body: {
    ar: 'أرسلنا إليك رابطاً سحرياً على عنوان {email}. صالح لمدة 15 دقيقة.',
    fr: 'Nous avons envoyé un lien magique à {email}. Valide 15 minutes.',
    en: 'We sent a magic link to {email}. Valid for 15 minutes.',
    es: 'Enviamos un enlace mágico a {email}. Válido por 15 minutos.'
  },
  success_spam: {
    ar: 'إذا لم يصلك الرابط تحقق من مجلد السبام.',
    fr: 'Vérifiez aussi votre dossier spam.',
    en: 'If not received, check your spam folder.',
    es: 'Si no lo recibes, revisa tu carpeta de spam.'
  },
  // ── Verify page ───────────────────────────────────────────────────────────
  verify_loading: {
    ar: 'جارٍ التحقق من الرابط…',
    fr: 'Vérification du lien en cours…',
    en: 'Verifying your link…',
    es: 'Verificando tu enlace…'
  },
  verify_success_title: {
    ar: 'تم التفعيل بنجاح 🎉',
    fr: 'Compte activé avec succès 🎉',
    en: 'Account activated! 🎉',
    es: '¡Cuenta activada! 🎉'
  },
  verify_success_body: {
    ar: 'مرحباً بك في Smart Resto. جارٍ توجيهك للوحة التحكم…',
    fr: 'Bienvenue sur Smart Resto. Redirection vers le tableau de bord…',
    en: 'Welcome to Smart Resto. Redirecting to your dashboard…',
    es: 'Bienvenido a Smart Resto. Redirigiendo al panel…'
  },
  verify_trial_note: {
    ar: 'بدأ أسبوعك التجريبي الآن — استمتع بجميع الميزات مجاناً لمدة 7 أيام.',
    fr: 'Votre semaine d\'essai commence maintenant — 7 jours de fonctionnalités complètes gratuites.',
    en: 'Your trial week has started — enjoy all features free for 7 days.',
    es: 'Tu semana de prueba ha comenzado — disfruta de todas las funciones gratis 7 días.'
  },
  // ── Error messages ────────────────────────────────────────────────────────
  error_fields_required: {
    ar: 'يرجى ملء جميع الحقول المطلوبة.',
    fr: 'Veuillez remplir tous les champs obligatoires.',
    en: 'Please fill in all required fields.',
    es: 'Por favor, completa todos los campos requeridos.'
  },
  error_email_format: {
    ar: 'صيغة البريد الإلكتروني غير صحيحة.',
    fr: 'Format d\'adresse e-mail invalide.',
    en: 'Invalid email address format.',
    es: 'Formato de correo electrónico inválido.'
  },
  error_email_provider: {
    ar: 'هذا المزود غير مدعوم. نقبل فقط Gmail وOutlook وHotmail وYahoo لحمايتنا من الحسابات الوهمية.',
    fr: 'Ce fournisseur n\'est pas pris en charge. Nous acceptons uniquement Gmail, Outlook, Hotmail et Yahoo pour protéger notre plateforme des comptes frauduleux.',
    en: 'This email provider is not supported. We only accept Gmail, Outlook, Hotmail, and Yahoo to protect our platform from fake accounts.',
    es: 'Este proveedor de correo no está soportado. Solo aceptamos Gmail, Outlook, Hotmail y Yahoo para proteger la plataforma de cuentas falsas.'
  },
  error_email_taken: {
    ar: 'يوجد حساب مسجل بهذا البريد الإلكتروني.',
    fr: 'Un compte existe déjà avec cette adresse e-mail.',
    en: 'An account with this email already exists.',
    es: 'Ya existe una cuenta con este correo electrónico.'
  },
  error_subdomain_taken: {
    ar: 'هذا الرابط مستخدم بالفعل، الرجاء اختيار رابط آخر.',
    fr: 'Ce sous-domaine est déjà utilisé, veuillez en choisir un autre.',
    en: 'This subdomain is already taken, please choose another.',
    es: 'Este subdominio ya está en uso, por favor elige otro.'
  },
  error_subdomain_format: {
    ar: 'الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط.',
    fr: 'Le sous-domaine ne peut contenir que des lettres minuscules, des chiffres et des tirets.',
    en: 'Subdomain may only contain lowercase letters, numbers and hyphens.',
    es: 'El subdominio solo puede contener letras minúsculas, números y guiones.'
  },
  error_token_invalid: {
    ar: 'الرابط غير صحيح أو انتهت صلاحيته.',
    fr: 'Le lien est invalide ou a expiré.',
    en: 'This link is invalid or has expired.',
    es: 'Este enlace es inválido o ha expirado.'
  },
  error_token_used: {
    ar: 'تم استخدام هذا الرابط من قبل. طلب رابطاً جديداً.',
    fr: 'Ce lien a déjà été utilisé. Demandez un nouveau lien.',
    en: 'This link has already been used. Request a new one.',
    es: 'Este enlace ya fue utilizado. Solicita uno nuevo.'
  },
  error_server: {
    ar: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.',
    fr: 'Une erreur serveur s\'est produite. Veuillez réessayer.',
    en: 'A server error occurred. Please try again.',
    es: 'Se produjo un error del servidor. Por favor, inténtalo de nuevo.'
  },
  error_network: {
    ar: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.',
    fr: 'Impossible de contacter le serveur. Vérifiez votre connexion.',
    en: 'Could not reach the server. Check your internet connection.',
    es: 'No se pudo contactar el servidor. Comprueba tu conexión.'
  },
  // ── Trust badges ──────────────────────────────────────────────────────────
  badge_no_card: {
    ar: '✓ بدون بطاقة بنكية',
    fr: '✓ Sans carte bancaire',
    en: '✓ No credit card',
    es: '✓ Sin tarjeta de crédito'
  },
  badge_free_trial: {
    ar: '✓ تجربة مجانية 7 أيام',
    fr: '✓ Essai gratuit 7 jours',
    en: '✓ 7-day free trial',
    es: '✓ Prueba gratis 7 días'
  },
  badge_cancel: {
    ar: '✓ إلغاء في أي وقت',
    fr: '✓ Annulation à tout moment',
    en: '✓ Cancel anytime',
    es: '✓ Cancela cuando quieras'
  },
  // ── Login link ────────────────────────────────────────────────────────────
  already_account: {
    ar: 'لديك حساب بالفعل؟',
    fr: 'Vous avez déjà un compte ?',
    en: 'Already have an account?',
    es: '¿Ya tienes una cuenta?'
  },
  link_login: {
    ar: 'تسجيل الدخول',
    fr: 'Se connecter',
    en: 'Sign in',
    es: 'Iniciar sesión'
  },
  link_back: {
    ar: '← العودة للصفحة الرئيسية',
    fr: '← Retour à l\'accueil',
    en: '← Back to home',
    es: '← Volver al inicio'
  },
  // ── Email template ────────────────────────────────────────────────────────
  email_subject: {
    ar: '🔑 رابط تفعيل حسابك في Smart Resto',
    fr: '🔑 Votre lien de connexion Smart Resto',
    en: '🔑 Your Smart Resto magic link',
    es: '🔑 Tu enlace mágico de Smart Resto'
  },
  email_greeting: {
    ar: 'مرحباً بك في Smart Resto!',
    fr: 'Bienvenue sur Smart Resto !',
    en: 'Welcome to Smart Resto!',
    es: '¡Bienvenido a Smart Resto!'
  },
  email_body: {
    ar: 'اضغط على الزر أدناه لتفعيل حسابك. الرابط صالح لمدة 15 دقيقة فقط.',
    fr: 'Cliquez sur le bouton ci-dessous pour activer votre compte. Le lien est valide 15 minutes.',
    en: 'Click the button below to activate your account. The link is valid for 15 minutes only.',
    es: 'Haz clic en el botón de abajo para activar tu cuenta. El enlace es válido por 15 minutos.'
  },
  email_cta: {
    ar: 'تفعيل الحساب',
    fr: 'Activer mon compte',
    en: 'Activate my account',
    es: 'Activar mi cuenta'
  },
  email_ignore: {
    ar: 'إذا لم تطلب هذا الرابط يمكنك تجاهل هذا البريد بأمان.',
    fr: 'Si vous n\'avez pas demandé ce lien, ignorez simplement cet e-mail.',
    en: 'If you did not request this link, you can safely ignore this email.',
    es: 'Si no solicitaste este enlace, ignora este correo electrónico.'
  },
  email_expire_note: {
    ar: 'هذا الرابط صالح لمرة واحدة فقط وينتهي خلال 15 دقيقة.',
    fr: 'Ce lien est à usage unique et expire dans 15 minutes.',
    en: 'This link is single-use and expires in 15 minutes.',
    es: 'Este enlace es de un solo uso y expira en 15 minutos.'
  }
} as const

type DictKey = keyof typeof dict

/**
 * Translate a key to the given language, with optional {placeholder} interpolation.
 * Falls back to English if the key is missing in the requested lang.
 */
export function t(key: DictKey, lang: Lang, vars?: Record<string, string>): string {
  const entry = dict[key]
  if (!entry) return key
  let text: string = (entry as Record<Lang, string>)[lang] ?? (entry as Record<Lang, string>).en ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v)
    }
  }
  return text
}

export default dict
