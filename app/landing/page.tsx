"use client"

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  QrCode, Zap, BarChart3, Star, CheckCircle, Menu, X,
  MessageCircle, ArrowRight, Loader2, ChefHat,
  CreditCard, Bell, Languages, Layers, TrendingUp,
  Shield, Phone, Mail, MapPin, ChevronDown, ChevronUp,
  Utensils, Coffee, Building2, ShoppingBag, Package,
  ThumbsUp, AlertTriangle, Wallet, Globe2, UserCircle, Share2,
} from 'lucide-react'

// ─── Types & i18n ──────────────────────────────────────────────────────────────

type Lang = 'en' | 'fr' | 'ar'

const T: Record<Lang, Record<string, string | string[]>> = {
  en: {
    tagline: '#1 Management Platform for Restaurants & Cafés',
    h1a: 'Run Your Restaurant', h1b: 'From One Platform',
    h1c: 'QR Menu · Live Orders · Smart Kitchen · Staff & Finance',
    desc: 'More than a QR menu — a complete system to manage your restaurant or café. Handle orders, kitchen, staff, tables, billing and analytics all in one place. Your guest scans, orders instantly, the kitchen gets it in seconds, you control everything from your phone.',
    cta1: 'Start Free 7-Day Trial', cta2: 'See How It Works',
    badges: ['No contract', '5-min setup', 'Support 24/7', 'No credit card'],
    whoLabel: 'Who Is It For', whoTitle: 'Built For Every F&B Business',
    whoSub: 'From solo cafés to hotel chains — SmartMenu adapts to your scale',
    howLabel: 'How It Works', howTitle: 'Live in 5 Steps',
    howSub: 'From signup to first order in under 30 minutes',
    featLabel: 'Features', featTitle: 'Everything in One Platform',
    featSub: '15 professional features built for MENA & Africa markets',
    pricingLabel: 'Pricing', pricingTitle: 'Pay Only Per Completed Order',
    pricingSub: 'No monthly fee · No fixed costs · Tiny auto-calculated commission per order',
    trialBig: '7-Day Free Trial', trialSub: 'Start today — no credit card, no commitment',
    trialBadges: ['✓ All features included', '✓ Unlimited orders', '✓ Live support', '✓ QR ready in minutes'],
    testimonialLabel: 'Reviews', testimonialTitle: 'Restaurants Trust SmartMenu',
    faqLabel: 'FAQ', faqTitle: 'Have a Question?',
    contactLabel: 'Contact', contactTitle: "We're Here to Help",
    contactSub: 'Support team available 7 days/week in Arabic, French & English',
    finalTitle: 'Ready to Transform Your Restaurant?',
    finalSub: 'Join 500+ restaurants & cafés using SmartMenu every day',
    finalCta1: 'Start Free Trial →', finalCta2: 'Talk to Our Team',
    finalNote: 'No credit card · No contract · Cancel anytime',
    cookie: 'We use cookies to improve your experience and analytics. See our',
    cookieLink: 'Privacy Policy', cookieAccept: 'Accept', cookieDecline: 'Decline',
    navLogin: 'Login', navSignup: 'Start Free',
    systemOk: '🟢 All systems operational',
    privacy: 'Privacy Policy', terms: 'Terms of Service', legal: 'Legal Notice',
    allRights: 'All rights reserved',
    madeWith: 'Made with ❤️ for MENA & Africa restaurants',
    enterpriseTitle: 'Enterprise & Chain Plans',
    enterpriseDesc: 'Multiple branches, custom branding, SLA guarantee, VIP support, POS integration',
    enterpriseCta: 'Contact Us for Custom Pricing',
    statsLabel: 'Trusted globally',
  },
  fr: {
    tagline: 'La plateforme de gestion #1 pour les restaurants',
    h1a: 'Gérez Votre Restaurant', h1b: 'En Un Seul Endroit',
    h1c: 'Menu QR · Commandes Live · Cuisine Smart · Staff & Finance',
    desc: "Plus qu'un menu QR — un système complet pour gérer votre restaurant ou café. Commandes, cuisine, personnel, tables, facturation et analytics dans une seule plateforme. Le client scanne, commande instantanément, la cuisine reçoit en quelques secondes.",
    cta1: 'Essai Gratuit 7 Jours', cta2: 'Voir Comment Ça Marche',
    badges: ['Sans engagement', 'Config 5 min', 'Support 24/7', 'Sans carte bancaire'],
    whoLabel: 'Pour Qui', whoTitle: 'Conçu pour Chaque Business F&B',
    whoSub: "Du café solo aux chaînes hôtelières — SmartMenu s'adapte à votre échelle",
    howLabel: 'Comment Ça Marche', howTitle: 'Opérationnel en 5 Étapes',
    howSub: "De l'inscription à la première commande en moins de 30 minutes",
    featLabel: 'Fonctionnalités', featTitle: 'Tout en Une Plateforme',
    featSub: '15 fonctionnalités pro pour les marchés MENA & Afrique',
    pricingLabel: 'Tarifs', pricingTitle: 'Payez Uniquement par Commande Complétée',
    pricingSub: "Pas d'abonnement · Pas de frais fixes · Petite commission auto-calculée",
    trialBig: '7 Jours Gratuits', trialSub: "Commencez aujourd'hui — sans carte bancaire",
    trialBadges: ['✓ Toutes les fonctionnalités', '✓ Commandes illimitées', '✓ Support en direct', '✓ QR prêt en minutes'],
    testimonialLabel: 'Avis Clients', testimonialTitle: 'Des Restaurants Font Confiance à SmartMenu',
    faqLabel: 'FAQ', faqTitle: 'Une Question ?',
    contactLabel: 'Contact', contactTitle: 'Nous Sommes Là pour Vous',
    contactSub: "Équipe disponible 7j/7 en arabe, français et anglais",
    finalTitle: 'Prêt à Transformer votre Restaurant ?',
    finalSub: "Rejoignez 500+ restaurants qui utilisent SmartMenu chaque jour",
    finalCta1: 'Commencer Gratuitement →', finalCta2: 'Parler à Notre Équipe',
    finalNote: 'Sans carte · Sans contrat · Annulation à tout moment',
    cookie: 'Nous utilisons des cookies pour améliorer votre expérience. Voir notre',
    cookieLink: 'Politique de Confidentialité', cookieAccept: 'Accepter', cookieDecline: 'Refuser',
    navLogin: 'Connexion', navSignup: 'Essai Gratuit',
    systemOk: '🟢 Tous les systèmes opérationnels',
    privacy: 'Politique de Confidentialité', terms: "Conditions d'Utilisation", legal: 'Mentions Légales',
    allRights: 'Tous droits réservés',
    madeWith: 'Fait avec ❤️ pour les restaurants MENA & Afrique',
    enterpriseTitle: 'Plans Entreprise & Chaînes',
    enterpriseDesc: 'Plusieurs branches, marque personnalisée, SLA garanti, support VIP, intégration POS',
    enterpriseCta: 'Nous Contacter pour un Devis Personnalisé',
    statsLabel: 'Reconnu mondialement',
  },
  ar: {
    tagline: 'منصة إدارة المطاعم والمقاهي #1',
    h1a: 'أدِر مطعمك بالكامل', h1b: 'من مكان واحد',
    h1c: 'منيو QR · طلبات مباشرة · مطبخ ذكي · موظفين وحسابات',
    desc: 'أكثر من مجرد منيو رقمي — نظام متكامل لإدارة مطعمك أو مقهاك. طلبات، مطبخ، موظفين، طاولات، فواتير وإحصاءات، كل شيء في منصة واحدة. الزبون يمسح QR ويطلب فوراً، المطبخ يستقبل في الثانية، وأنت تتحكم في كل شيء من هاتفك.',
    cta1: 'ابدأ مجاناً 7 أيام', cta2: 'شاهد كيف يعمل',
    badges: ['بدون عقد', 'إعداد 5 دقائق', 'دعم 24/7', 'لا بطاقة بنكية'],
    whoLabel: 'الاستهداف', whoTitle: 'مصمم لكل قطاع F&B',
    whoSub: 'من المقاهي الصغيرة إلى سلاسل الفنادق — SmartMenu يتكيف مع احتياجاتك',
    howLabel: 'كيف يعمل', howTitle: 'جاهز في 5 خطوات',
    howSub: 'من التسجيل إلى أول طلب في أقل من 30 دقيقة',
    featLabel: 'المميزات', featTitle: 'كل ما تحتاجه في منصة واحدة',
    featSub: '15 ميزة احترافية للسوق العربي والأفريقي',
    pricingLabel: 'الأسعار', pricingTitle: 'تدفع فقط على الطلبات المكتملة',
    pricingSub: 'لا اشتراك شهري · لا رسوم ثابتة · عمولة رمزية تُحسب تلقائياً',
    trialBig: '7 أيام مجاناً', trialSub: 'ابدأ اليوم — لا بطاقة بنكية، لا التزام',
    trialBadges: ['✓ جميع المميزات مفعّلة', '✓ طلبات غير محدودة', '✓ دعم فوري', '✓ QR جاهز في دقائق'],
    testimonialLabel: 'آراء العملاء', testimonialTitle: 'مطاعم تثق في SmartMenu',
    faqLabel: 'الأسئلة الشائعة', faqTitle: 'لديك سؤال؟',
    contactLabel: 'تواصل معنا', contactTitle: 'نحن هنا لمساعدتك',
    contactSub: 'فريق الدعم متاح 7 أيام بالعربية والفرنسية والإنجليزية',
    finalTitle: 'جاهز تحوّل مطعمك؟',
    finalSub: 'انضم لأكثر من 500 مطعم ومقهى يستخدم SmartMenu يومياً',
    finalCta1: 'ابدأ 7 أيام مجاناً ←', finalCta2: 'تحدث مع فريقنا',
    finalNote: 'لا بطاقة بنكية · لا عقد · إلغاء في أي وقت',
    cookie: 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك. راجع',
    cookieLink: 'سياسة الخصوصية', cookieAccept: 'قبول', cookieDecline: 'رفض',
    navLogin: 'تسجيل الدخول', navSignup: 'ابدأ مجاناً',
    systemOk: '🟢 جميع الأنظمة تعمل',
    privacy: 'سياسة الخصوصية', terms: 'شروط الاستخدام', legal: 'الإشعار القانوني',
    allRights: 'جميع الحقوق محفوظة',
    madeWith: 'مصنوع بـ ❤️ للمطاعم العربية والأفريقية',
    enterpriseTitle: 'باقة المؤسسات والسلاسل',
    enterpriseDesc: 'عدة فروع، علامة تجارية خاصة، SLA مضمون، دعم VIP، تكامل مع POS',
    enterpriseCta: 'تواصل معنا للتسعير المخصص',
    statsLabel: 'موثوق عالمياً',
  },
}

function tl<T>(item: { en: T; fr: T; ar: T }, lang: Lang): T {
  return item[lang]
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '500+', en: 'Restaurants', fr: 'Restaurants', ar: 'مطعم ومقهى' },
  { value: '8+',   en: 'Countries',   fr: 'Pays',        ar: 'دول مخدومة' },
  { value: '50K+', en: 'Daily Orders',fr: 'Cmd/jour',    ar: 'طلب يومياً' },
  { value: '4.9★', en: 'Avg Rating',  fr: 'Note moy.',   ar: 'تقييم متوسط' },
]

const PERSONAS = [
  {
    icon: Utensils,
    en:  { title: 'Independent Restaurant', pain: 'Paper orders & costly errors',       gain: 'QR menu live in 5 min, zero mistakes' },
    fr:  { title: 'Restaurant Indépendant', pain: 'Commandes papier et erreurs coûteuses', gain: 'Menu QR en 5 min, zéro erreur' },
    ar:  { title: 'مطعم مستقل',            pain: 'طلبات ورقية وأخطاء مكلفة',           gain: 'منيو QR في 5 دقائق، صفر أخطاء' },
    border: 'border-emerald-200 hover:border-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', gainColor: 'text-emerald-700',
  },
  {
    icon: Coffee,
    en:  { title: 'Café & Snack Bar',      pain: 'Slow service at peak hours',          gain: 'Table QR + waiter call, 2× faster' },
    fr:  { title: 'Café & Snack',          pain: 'Service lent aux heures de pointe',   gain: 'QR table + bouton serveur, 2× plus vite' },
    ar:  { title: 'مقهى وسناك',            pain: 'خدمة بطيئة في أوقات الذروة',         gain: 'QR + زر نادل، سرعة مضاعفة' },
    border: 'border-amber-200 hover:border-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', gainColor: 'text-amber-700',
  },
  {
    icon: Building2,
    en:  { title: 'Hotel & Resort',        pain: 'Room service coordination chaos',     gain: 'Mobile menu per room, auto billing' },
    fr:  { title: 'Hôtel & Resort',        pain: 'Chaos du service en chambre',         gain: 'Menu mobile par chambre, facturation auto' },
    ar:  { title: 'فندق ومنتجع',           pain: 'فوضى في خدمة الغرف',                 gain: 'منيو موبايل لكل غرفة، فوترة تلقائية' },
    border: 'border-sky-200 hover:border-sky-500', iconBg: 'bg-sky-50', iconColor: 'text-sky-600', gainColor: 'text-sky-700',
  },
  {
    icon: ShoppingBag,
    en:  { title: 'Chain & Food Court',    pain: 'Managing multiple outlets is hard',   gain: 'Central dashboard, per-branch analytics' },
    fr:  { title: 'Chaîne & Food Court',   pain: 'Gérer plusieurs points de vente',     gain: 'Dashboard central, analytics par branche' },
    ar:  { title: 'سلسلة وفود كورت',       pain: 'إدارة فروع متعددة صعبة',             gain: 'لوحة تحكم مركزية، إحصاءات لكل فرع' },
    border: 'border-rose-200 hover:border-rose-500', iconBg: 'bg-rose-50', iconColor: 'text-rose-600', gainColor: 'text-rose-700',
  },
]

const HOW_IT_WORKS = [
  { step: '01', icon: Mail,
    en: { title: 'Sign Up with Email',     desc: 'Create your account with your email address — quick verification, no friction.' },
    fr: { title: 'Inscription par Email',  desc: 'Créez votre compte avec votre adresse email — vérification rapide, sans friction.' },
    ar: { title: 'سجّل بالإيميل',          desc: 'أنشئ حسابك بعنوان بريدك الإلكتروني — تحقق سريع، بدون تعقيد.' },
  },
  { step: '02', icon: UserCircle,
    en: { title: 'Customise Your Profile', desc: 'Add your restaurant name, logo, colours and contact info — your brand, your identity.' },
    fr: { title: 'Personnalisez votre Profil', desc: 'Ajoutez nom, logo, couleurs et contacts — votre marque, votre identité.' },
    ar: { title: 'خصّص ملفك الشخصي',       desc: 'أضف اسم مطعمك، شعارك، ألوانك ومعلومات التواصل — هويتك، علامتك.' },
  },
  { step: '03', icon: QrCode,
    en: { title: 'Build Your Menu',        desc: 'Add items in Arabic, French, English — or use our ready demo menu in seconds.' },
    fr: { title: 'Créez votre Menu',       desc: 'Ajoutez vos plats en arabe, français, anglais — ou utilisez notre menu demo.' },
    ar: { title: 'أضف منيوك',              desc: 'أضف أصنافك بالعربية والفرنسية — أو استخدم منيونا التجريبي الجاهز.' },
  },
  { step: '04', icon: Utensils,
    en: { title: 'Print Table QR Codes',   desc: 'Print a QR sticker per table — each seat gets its own unique code.' },
    fr: { title: 'Imprimez les QR',        desc: 'Imprimez une étiquette QR par table — chaque place a son propre code.' },
    ar: { title: 'اطبع QR الطاولات',       desc: 'اطبع ملصق QR لكل طاولة — كل مقعد عنده رمز خاص.' },
  },
  { step: '05', icon: Zap,
    en: { title: 'Receive Orders Instantly', desc: 'Guests scan and order — you receive in real time on dashboard & kitchen screen.' },
    fr: { title: 'Recevez les Commandes',  desc: 'Les clients scannent et commandent — vous recevez en temps réel.' },
    ar: { title: 'استقبل الطلبات',          desc: 'الزبون يمسح ويطلب — أنت تستقبل فوراً على لوحة التحكم والمطبخ.' },
  },
]

const FEATURES = [
  { icon: QrCode,
    en: { title: 'QR Menu — No App',        desc: 'Guests scan and order directly — no download, no account. Works on any phone.' },
    fr: { title: 'Menu QR — Sans App',       desc: 'Les clients scannent et commandent directement — aucun téléchargement.' },
    ar: { title: 'QR Menu بدون تطبيق',      desc: 'يمسح الزبون الكود ويطلب مباشرة — لا تحميل، لا إنشاء حساب.' },
  },
  { icon: Zap,
    en: { title: 'Instant Kitchen Orders',   desc: 'Orders hit the kitchen in milliseconds with audio alert & KDS screen.' },
    fr: { title: 'Commandes Instantanées',   desc: "Les commandes atteignent la cuisine en millisecondes avec alerte audio." },
    ar: { title: 'طلبات فورية للمطبخ',       desc: 'الطلب يصل للمطبخ في الثانية مع صوت تنبيه وشاشة KDS.' },
  },
  { icon: Languages,
    en: { title: 'Multilingual Menu',        desc: 'Arabic, French, English — tourists and locals order with ease.' },
    fr: { title: 'Menu Multi-langues',        desc: 'Arabe, français, anglais — touristes et locaux commandent facilement.' },
    ar: { title: 'متعدد اللغات',             desc: 'المنيو بالعربية، الفرنسية، الإنجليزية — الزبائن يطلبون بسهولة.' },
  },
  { icon: Layers,
    en: { title: 'Table Merging',            desc: 'Large groups? Merge two tables in one tap — single bill for everyone.' },
    fr: { title: 'Fusion de Tables',          desc: 'Grands groupes ? Fusionnez deux tables en un tap — une facture unifiée.' },
    ar: { title: 'دمج الطاولات',             desc: 'مجموعات كبيرة؟ ادمج طاولتين بضغطة — فاتورة موحدة.' },
  },
  { icon: BarChart3,
    en: { title: 'Smart Analytics',          desc: 'Know top dishes, peak hours, and average spend per table in real time.' },
    fr: { title: 'Analytics Avancés',         desc: 'Connaissez vos plats phares, heures de pointe et dépense moyenne.' },
    ar: { title: 'إحصاءات ذكية',             desc: 'اعرف الأطباق الأكثر مبيعاً، أوقات الذروة، ومتوسط إنفاق الطاولة.' },
  },
  { icon: Star,
    en: { title: 'Auto Google Reviews',      desc: 'Prompt guests to leave a Google review after every order — boost your ranking.' },
    fr: { title: 'Avis Google Auto',          desc: 'Incitez vos clients à laisser un avis Google après chaque commande.' },
    ar: { title: 'تقييمات Google تلقائية',   desc: 'نشجع زبائنك على كتابة تقييم بعد كل طلب — مطعمك يصعد في البحث.' },
  },
  { icon: Bell,
    en: { title: 'Waiter Call Button',       desc: 'One tap calls the waiter — guests never have to stand or shout.' },
    fr: { title: "Bouton d'Appel Serveur",   desc: "Un tap appelle le serveur — les clients n'ont pas besoin de se lever." },
    ar: { title: 'استدعاء النادل',            desc: 'زر واحد يستدعي النادل — الزبون لا يحتاج يقوم أو ينادي.' },
  },
  { icon: CreditCard,
    en: { title: 'Bill Request',             desc: 'Guests request the bill from their phone — cash, card or Apple Pay.' },
    fr: { title: "Demande d'Addition",        desc: 'Les clients demandent l\'addition depuis leur téléphone.' },
    ar: { title: 'طلب الحساب',               desc: 'الزبون يطلب الحساب مباشرة من هاتفه بالكاش أو البطاقة.' },
  },
  { icon: ChefHat,
    en: { title: 'Kitchen Display (KDS)',     desc: 'Dedicated kitchen screen shows orders in sequence with prep timers.' },
    fr: { title: 'Écran Cuisine (KDS)',        desc: "Écran dédié à la cuisine affichant les commandes avec minuteries." },
    ar: { title: 'شاشة المطبخ KDS',          desc: 'شاشة مخصصة للمطبخ تعرض الطلبات بالترتيب مع توقيت الإعداد.' },
  },
  { icon: TrendingUp,
    en: { title: 'Smart Costing Engine',     desc: 'Auto-calculate dish costs vs price — know your real margins instantly.' },
    fr: { title: 'Moteur de Costing Intelligent', desc: 'Calculez automatiquement le coût vs prix — connaissez vos marges réelles.' },
    ar: { title: 'محرك التكلفة الذكي',       desc: 'احسب تكلفة كل طبق مقابل سعره — اعرف هامش ربحك الحقيقي.' },
  },
  { icon: Package,
    en: { title: 'Auto Stock Deduction',     desc: 'Every order auto-deducts ingredient stock — real-time inventory tracking.' },
    fr: { title: 'Déduction Stock Auto',      desc: 'Chaque commande déduit automatiquement le stock — suivi en temps réel.' },
    ar: { title: 'خصم المخزون التلقائي',     desc: 'كل طلب يخصم مكوناته من المخزون تلقائياً — متابعة فورية.' },
  },
  { icon: ThumbsUp,
    en: { title: 'Customer Feedback System', desc: 'Collect post-order ratings & comments — identify issues before they go public.' },
    fr: { title: 'Système de Feedback Client', desc: "Collectez notes et commentaires après commande — identifiez les problèmes." },
    ar: { title: 'نظام تقييم الزبائن',       desc: 'اجمع التقييمات والتعليقات بعد كل طلب — اكتشف المشاكل قبل أن تنتشر.' },
  },
  { icon: AlertTriangle,
    en: { title: 'Anti-Fraud Engine',        desc: 'Detects duplicate orders, suspicious patterns & fake reviews automatically.' },
    fr: { title: 'Moteur Anti-Fraude',        desc: 'Détecte les doublons, les comportements suspects et faux avis automatiquement.' },
    ar: { title: 'محرك مكافحة الاحتيال',    desc: 'يكشف الطلبات المكررة والأنماط المشبوهة والتقييمات المزيفة تلقائياً.' },
  },
  { icon: Wallet,
    en: { title: 'International Payments',   desc: 'Gulf: Stripe · Africa: Mobile Money (Wave, M-Pesa) · WhatsApp zero-rating.' },
    fr: { title: 'Paiements Internationaux', desc: 'Golfe: Stripe · Afrique: Mobile Money (Wave, M-Pesa) · WhatsApp zero-rating.' },
    ar: { title: 'مدفوعات دولية',            desc: 'الخليج: Stripe · أفريقيا: Mobile Money (Wave, M-Pesa) · واتساب بدون بيانات.' },
  },
  { icon: Share2,
    en: { title: 'Visitor-Powered Marketing', desc: 'Every guest who scans your QR becomes a marketing channel — prompt them to share dishes on Instagram, tag your café, and invite friends. Turn every table into a free ad.' },
    fr: { title: 'Marketing par vos Visiteurs', desc: 'Chaque client qui scanne votre QR devient un canal marketing — incitez-les à partager des plats sur Instagram, taguer votre café et inviter des amis. Chaque table devient une pub gratuite.' },
    ar: { title: 'تسويق عبر زبائنك',         desc: 'كل زبون يمسح QR مطعمك يصبح قناة تسويقية — شجّعه على مشاركة صور الأطباق على إنستغرام وتاغ مقهاك ودعوة أصدقائه. كل طاولة إعلان مجاني.' },
  },
]

const MARKETS = [
  {
    flag: '🇲🇦', currency: 'MAD',
    en: { country: 'Morocco', cities: 'Agadir · Marrakech · Casablanca · Fes · Rabat' },
    fr: { country: 'Maroc',   cities: 'Agadir · Marrakech · Casablanca · Fès · Rabat' },
    ar: { country: 'المغرب',  cities: 'أكادير · مراكش · كازابلانكا · فاس · الرباط' },
    color: 'from-emerald-700 to-emerald-900',
    pricing: [
      { en: 'Under 20 MAD', fr: 'Moins de 20 MAD', ar: 'أقل من 20 درهم', fee: '1 MAD' },
      { en: '20 — 50 MAD',  fr: '20 — 50 MAD',     ar: '20 — 50 درهم',   fee: '3 MAD' },
      { en: '50 — 100 MAD', fr: '50 — 100 MAD',    ar: '50 — 100 درهم',  fee: '5–7 MAD' },
      { en: 'Over 100 MAD', fr: 'Plus de 100 MAD', ar: 'أكثر من 100',    fee: '10–15 MAD' },
    ],
  },
  {
    flag: '🇸🇦', currency: 'SAR',
    en: { country: 'Saudi Arabia', cities: 'Riyadh · Jeddah · Mecca · Dammam · Medina' },
    fr: { country: 'Arabie Saoudite', cities: 'Riyad · Djeddah · La Mecque · Dammam' },
    ar: { country: 'السعودية',        cities: 'الرياض · جدة · مكة · الدمام · المدينة' },
    color: 'from-green-700 to-green-900',
    pricing: [
      { en: 'Under 10 SAR', fr: 'Moins de 10 SAR', ar: 'أقل من 10 ريال', fee: '2 SAR' },
      { en: '10 — 40 SAR',  fr: '10 — 40 SAR',     ar: '10 — 40 ريال',   fee: '5–8 SAR' },
      { en: '40 — 75 SAR',  fr: '40 — 75 SAR',     ar: '40 — 75 ريال',   fee: '10–14 SAR' },
      { en: 'Over 75 SAR',  fr: 'Plus de 75 SAR',  ar: 'أكثر من 75',     fee: '20 SAR' },
    ],
  },
  {
    flag: '🇦🇪', currency: 'AED',
    en: { country: 'UAE',       cities: 'Dubai · Abu Dhabi · Sharjah · Ajman' },
    fr: { country: 'Émirats',   cities: 'Dubaï · Abu Dhabi · Sharjah · Ajman' },
    ar: { country: 'الإمارات',  cities: 'دبي · أبوظبي · الشارقة · عجمان' },
    color: 'from-red-700 to-red-900',
    pricing: [
      { en: 'Under 15 AED', fr: 'Moins de 15 AED', ar: 'أقل من 15 درهم', fee: '2 AED' },
      { en: '15 — 50 AED',  fr: '15 — 50 AED',     ar: '15 — 50 درهم',   fee: '5–8 AED' },
      { en: '50 — 100 AED', fr: '50 — 100 AED',    ar: '50 — 100 درهم',  fee: '10–14 AED' },
      { en: 'Over 100 AED', fr: 'Plus de 100 AED', ar: 'أكثر من 100',    fee: '20 AED' },
    ],
  },
  {
    flag: '🌍', currency: 'XOF/KES',
    en: { country: 'Africa',  cities: 'Senegal · Côte d\'Ivoire · Gabon · Kenya · Cameroon' },
    fr: { country: 'Afrique', cities: 'Sénégal · Côte d\'Ivoire · Gabon · Kenya · Cameroun' },
    ar: { country: 'أفريقيا', cities: 'السنغال · ساحل العاج · الغابون · كينيا · الكاميرون' },
    color: 'from-orange-700 to-orange-900',
    pricing: [
      { en: 'Mobile Money', fr: 'Mobile Money', ar: 'موبايل موني', fee: 'Wave / M-Pesa' },
      { en: 'WhatsApp Zero-Rating', fr: 'WhatsApp Gratuit', ar: 'واتساب بدون بيانات', fee: '✓' },
      { en: 'Local Currency', fr: 'Monnaie Locale', ar: 'عملة محلية', fee: 'XOF · KES · XAF' },
      { en: 'Offline Mode', fr: 'Mode Hors Ligne', ar: 'وضع بدون إنترنت', fee: '✓ PWA' },
    ],
  },
]

const TESTIMONIALS: LandingConfig['testimonials'] = [
  {
    name: 'Mohammed Idrissi', avatarUrl: undefined,
    role: { en: 'Owner, Brahim Restaurant — Marrakech', fr: 'Propriétaire, Restaurant Brahim — Marrakech', ar: 'صاحب مطعم ببراهيم، مراكش' },
    rating: 5,
    text: { en: 'Before SmartMenu we lost so much time on wrong orders. Now the kitchen reads everything clearly — and guests love the digital experience.', fr: 'Avant SmartMenu, nous perdions beaucoup de temps sur les erreurs. Maintenant la cuisine reçoit tout clairement.', ar: 'قبل SmartMenu كنت نخسر وقت كبير في الطلبات الغلوطة. دابا المطبخ كيقرا كل شيء واضح.' },
  },
  {
    name: 'Fatima Bouzidi', avatarUrl: undefined,
    role: { en: 'Manager, Café Latte — Agadir', fr: 'Directrice, Café Latte — Agadir', ar: 'مديرة كافي لاتيه، أكادير' },
    rating: 5,
    text: { en: 'Setup was incredibly easy — in under an hour the menu was live and QR stickers printed on tables. Foreign guests love the English menu.', fr: "Configuration incroyablement facile — en moins d'une heure le menu était en ligne. Les clients étrangers adorent le menu en anglais.", ar: 'إعداد سهل جداً — في أقل من ساعة كان المنيو جاهز. الزبائن الأجانب مسرورين بالمنيو بالإنجليزية.' },
  },
  {
    name: 'Khalid Al-Omari', avatarUrl: undefined,
    role: { en: 'Owner, Food Court — Riyadh', fr: 'Propriétaire, Food Court — Riyad', ar: 'صاحب فود كورت، الرياض' },
    rating: 5,
    text: { en: 'The table merge feature solved a huge problem for large families. One unified bill, no collection issues at all.', fr: 'La fusion de tables a résolu un énorme problème pour les grandes familles. Une facture unifiée, zéro problème de caisse.', ar: 'نظام دمج الطاولات للعائلات الكبيرة حل لنا مشكلة كبيرة. الفاتورة تجي موحدة وما كاين مشاكل.' },
  },
]

const FAQS = [
  {
    en: { q: 'Do guests need to download an app?', a: 'No. The menu opens directly in the phone browser when scanning the QR — no download, no account.' },
    fr: { q: "Les clients doivent-ils télécharger une app ?", a: "Non. Le menu s'ouvre directement dans le navigateur après scan du QR — aucun téléchargement." },
    ar: { q: 'هل يحتاج الزبون لتحميل تطبيق؟', a: 'لا، المنيو يفتح مباشرة في متصفح الهاتف عند مسح QR — بدون أي تحميل أو تسجيل.' },
  },
  {
    en: { q: 'How does billing work?', a: 'Free for 7 days. After that, a small commission per completed order only — no fixed monthly fee.' },
    fr: { q: 'Comment fonctionne la facturation ?', a: "Gratuit pendant 7 jours. Ensuite, une petite commission par commande complétée uniquement." },
    ar: { q: 'كيف يعمل نظام الفوترة؟', a: 'أسبوع التجربة مجاناً. بعده، عمولة صغيرة على كل طلب مكتمل فقط — بدون اشتراك شهري ثابت.' },
  },
  {
    en: { q: 'Can I update the menu anytime?', a: 'Yes, from your phone or computer you can add/remove/edit items instantly from anywhere.' },
    fr: { q: 'Puis-je modifier le menu à tout moment ?', a: 'Oui, depuis votre téléphone ou ordinateur vous pouvez ajouter/supprimer/modifier instantanément.' },
    ar: { q: 'هل يمكنني تعديل المنيو في أي وقت؟', a: 'نعم، من لوحة التحكم على هاتفك يمكنك إضافة وحذف وتعديل الأصناف فوراً.' },
  },
  {
    en: { q: 'Does it support multiple branches?', a: 'Yes. Each branch has its own account and menu with a separate dashboard. Enterprise plans allow managing all branches from one account.' },
    fr: { q: 'Supporte-t-il plusieurs agences ?', a: 'Oui. Chaque agence a son propre compte et menu. Les plans Enterprise permettent de tout gérer depuis un seul compte.' },
    ar: { q: 'هل يدعم النظام عدة فروع؟', a: 'نعم، كل فرع عنده حسابه ومنيوه الخاص. باقة المؤسسات تتيح إدارة كل الفروع من حساب واحد.' },
  },
  {
    en: { q: 'Is support available in Arabic?', a: 'Absolutely — our support team communicates in Arabic, French, and English via WhatsApp and email.' },
    fr: { q: 'Le support est-il disponible en français ?', a: "Absolument — notre équipe communique en arabe, français et anglais via WhatsApp et email." },
    ar: { q: 'هل الدعم متاح بالعربية؟', a: 'بالتأكيد — فريق الدعم يتواصل بالعربية، الفرنسية، والإنجليزية عبر واتساب وإيميل.' },
  },
  {
    en: { q: 'What about GDPR compliance?', a: 'SmartMenu is GDPR-compliant. We store minimal data, offer cookie consent, and never sell user data. See our Privacy Policy for details.' },
    fr: { q: 'Quid de la conformité RGPD ?', a: 'SmartMenu est conforme au RGPD. Nous stockons un minimum de données et ne vendons jamais les données. Consultez notre Politique de Confidentialité.' },
    ar: { q: 'هل المنصة متوافقة مع GDPR؟', a: 'نعم، SmartMenu متوافق مع GDPR. نحن نحفظ أقل البيانات ولا نبيعها أبداً. راجع سياسة الخصوصية للتفاصيل.' },
  },
]

// ─── Landing config (loaded from DB, overrides static defaults) ───────────────

type LandingConfig = {
  stats?: { value: string; en: string; fr: string; ar: string }[]
  testimonials?: { name: string; role: { en: string; fr: string; ar: string }; rating: number; text: { en: string; fr: string; ar: string }; avatarUrl?: string }[]
  contact?: { whatsapp?: string; email?: string; location?: { en: string; fr: string; ar: string } }
  heroImageUrl?: string
  platformImageUrl?: string
  logoImageUrl?: string
  text?: {
    ar?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; featTitle?: string; featSub?: string }
    en?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; featTitle?: string; featSub?: string }
    fr?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; featTitle?: string; featSub?: string }
  }
  faqs?: { en: { q: string; a: string }; fr: { q: string; a: string }; ar: { q: string; a: string } }[]
}

// ─── Cookie Banner ─────────────────────────────────────────────────────────────

function CookieBanner({ lang, t }: { lang: Lang; t: (k: string) => string }) {
  const [visible, setVisible] = useState(false)
  const isRtl = lang === 'ar'

  useEffect(() => {
    if (!localStorage.getItem('sm_cookie_consent')) setVisible(true)
  }, [])

  function accept() { localStorage.setItem('sm_cookie_consent', 'accepted'); setVisible(false) }
  function decline() { localStorage.setItem('sm_cookie_consent', 'declined'); setVisible(false) }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-4">
      <div className={`max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4 justify-between ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
        <p className={`text-gray-300 text-sm flex-1 ${isRtl ? 'text-right' : ''}`}>
          {t('cookie')}{' '}
          <a href="/privacy" className="text-emerald-400 underline hover:text-emerald-300">{t('cookieLink')}</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={decline} className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors">{t('cookieDecline')}</button>
          <button onClick={accept} className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors">{t('cookieAccept')}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('en')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [ctaLoading, setCtaLoading] = useState(false)
  const [ctaError, setCtaError] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [cfg, setCfg] = useState<LandingConfig>({})

  useEffect(() => {
    fetch('/api/public/landing-config')
      .then(r => r.ok ? r.json() : {})
      .then(d => setCfg(d ?? {}))
      .catch(() => {})
  }, [])

  const stats           = cfg.stats        ?? STATS
  const testimonials    = cfg.testimonials ?? TESTIMONIALS
  const heroImageUrl    = cfg.heroImageUrl    ?? '/assets/mobile.png'
  const platformImageUrl = cfg.platformImageUrl ?? ''
  const logoImageUrl     = cfg.logoImageUrl     ?? '/assets/logo.png'
  const contactPhone = cfg.contact?.whatsapp ?? '+212 6 00 00 00 00'
  const contactEmail = cfg.contact?.email    ?? 'contact@smartmenu.ma'

  const isRtl = lang === 'ar'

  function t(key: string): string {
    const override = (cfg.text as any)?.[lang]?.[key]
    if (override) return override
    const val = T[lang][key]
    return Array.isArray(val) ? val.join(', ') : val ?? key
  }
  function ta(key: string): string[] {
    const val = T[lang][key]
    return Array.isArray(val) ? val : [String(val)]
  }

  function handleEmailCta(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    router.push(`/signup?email=${encodeURIComponent(email.trim())}`)
  }

  const LANGS: { code: Lang; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
    { code: 'ar', label: 'AR' },
  ]

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">

      <CookieBanner lang={lang} t={t} />

      {/* ── Top bar ── */}
      <div className="bg-gray-900 text-gray-400 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contactPhone}</span>
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contactEmail}</span>
            <span className="hidden sm:inline"><Globe2 className="w-3 h-3 inline mr-1" />MA · SA · AE · SN · CI · GA · KE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-green-400 font-medium">{t('systemOk')}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-500">SSL · GDPR · PCI DSS</span>
          </div>
        </div>
      </div>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Image src={logoImageUrl} alt="SmartMenu" width={38} height={38} className="rounded-xl shadow-sm object-contain" unoptimized={!logoImageUrl.startsWith('/') || logoImageUrl.startsWith('/uploads/')} />
            <div className="leading-tight">
              <span className="font-extrabold text-lg text-gray-900 tracking-tight">SmartMenu</span>
              <span className="hidden sm:block text-[10px] text-emerald-600 font-semibold leading-none">SCAN · ORDER · MANAGE</span>
            </div>
          </div>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-6 text-sm text-gray-600 font-medium">
            <a href="#who"      className="hover:text-emerald-700 transition-colors">{t('whoLabel')}</a>
            <a href="#features" className="hover:text-emerald-700 transition-colors">{t('featLabel')}</a>
            <a href="#how"      className="hover:text-emerald-700 transition-colors">{t('howLabel')}</a>
            <a href="#pricing"  className="hover:text-emerald-700 transition-colors">{t('pricingLabel')}</a>
            <a href="#contact"  className="hover:text-emerald-700 transition-colors">{t('contactLabel')}</a>
          </div>

          {/* Right: lang switcher + CTAs */}
          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-bold">
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setLang(l.code)}
                  className={`px-2.5 py-1.5 rounded-md transition-all ${lang === l.code ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/login" className="text-sm text-gray-600 hover:text-emerald-700 font-medium px-3 py-2 transition-colors">{t('navLogin')}</Link>
              <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm">{t('navSignup')}</Link>
            </div>
            <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
            {[['#who', t('whoLabel')], ['#features', t('featLabel')], ['#how', t('howLabel')], ['#pricing', t('pricingLabel')], ['#contact', t('contactLabel')]].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 font-medium py-1.5">{label}</a>
            ))}
            <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block bg-emerald-600 text-white text-center py-3 rounded-xl font-bold mt-2">{t('navSignup')}</Link>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HERO */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-600/15 rounded-full blur-[120px]" />

        <div className={`relative max-w-7xl mx-auto px-4 pt-16 pb-20 flex flex-col ${isRtl ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16`}>

          {/* Text */}
          <div className={`flex-1 ${isRtl ? 'text-right' : 'text-left'} text-center lg:text-inherit`}>
            <div className={`inline-flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/40 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium mb-7`}>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {t('tagline')}
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] text-white">
              {t('h1a')}
              <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{t('h1b')}</span>
              <span className="block text-2xl sm:text-3xl font-semibold text-gray-400 mt-3">{t('h1c')}</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-gray-400 leading-relaxed max-w-lg">{t('desc')}</p>

            <div className={`mt-8 flex flex-col sm:flex-row gap-3 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              <Link href="/signup" className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-7 py-3.5 rounded-xl shadow-xl shadow-emerald-900/40 transition-all text-base">
                {t('cta1')} <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how" className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold px-7 py-3.5 rounded-xl transition-all text-base">
                {t('cta2')}
              </a>
            </div>

            <div className={`mt-7 flex flex-wrap gap-2 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              {ta('badges').map(b => (
                <span key={b} className="flex items-center gap-1.5 bg-white/8 text-gray-300 border border-white/10 px-3 py-1.5 rounded-full text-xs font-medium">
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" /> {b}
                </span>
              ))}
            </div>
          </div>

          {/* Hero image — mobile.png */}
          <div className="flex-1 flex items-center justify-center mt-6 lg:mt-0">
            <div className="relative w-full max-w-xs sm:max-w-sm lg:max-w-lg xl:max-w-xl">
              {/* Glow rings */}
              <div className="absolute -inset-6 rounded-full bg-emerald-500/20 blur-3xl" />
              <div className="absolute -inset-12 rounded-full bg-teal-500/10 blur-[60px]" />
              <Image
                src={heroImageUrl}
                alt="SmartMenu — Digital Menu on Mobile"
                width={1213}
                height={1297}
                className="relative w-full h-auto object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
                priority
                unoptimized={!heroImageUrl.startsWith('/') || heroImageUrl.startsWith('/uploads/')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STATS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-emerald-700 py-10">
        <div className="max-w-5xl mx-auto px-4">
          <p className={`text-emerald-200 text-xs font-semibold uppercase tracking-widest text-center mb-6`}>{t('statsLabel')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map(s => (
              <div key={s.value}>
                <div className="text-4xl font-extrabold text-white">{s.value}</div>
                <div className="text-emerald-200 text-sm mt-1 font-medium">{tl(s, lang)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* WHO IS IT FOR — PERSONAS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="who" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className={`mb-14 ${isRtl ? 'text-right' : 'text-left'} text-center`}>
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('whoLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('whoTitle')}</h2>
            <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">{t('whoSub')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PERSONAS.map((p, i) => {
              const Icon = p.icon
              const d = tl(p, lang)
              return (
                <div key={i} className={`border-2 rounded-2xl p-6 transition-all cursor-pointer group bg-white ${p.border}`}>
                  <div className={`w-12 h-12 rounded-xl ${p.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 ${p.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-4">{d.title}</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm text-gray-500">
                      <span className="shrink-0 mt-0.5 text-red-400 font-bold">✗</span>
                      <span>{d.pain}</span>
                    </div>
                    <div className={`flex items-start gap-2 text-sm font-semibold ${p.gainColor}`}>
                      <span className="shrink-0 mt-0.5">✓</span>
                      <span>{d.gain}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="how" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className={`mb-16 text-center`}>
            <span className="inline-block bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('howLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('howTitle')}</h2>
            <p className="mt-3 text-gray-500 text-lg">{t('howSub')}</p>
          </div>
          <div className="relative">
            <div className="hidden lg:block absolute top-11 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-emerald-100 via-emerald-400 to-emerald-100" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = step.icon
                const d = tl(step, lang)
                return (
                  <div key={i} className="flex flex-col items-center text-center">
                    <div className="w-22 h-22 relative mb-5">
                      <div className="w-20 h-20 rounded-2xl bg-emerald-600 text-white flex flex-col items-center justify-center shadow-lg shadow-emerald-200 mx-auto">
                        <Icon className="w-7 h-7" />
                        <span className="text-[10px] font-bold opacity-60 mt-1">{step.step}</span>
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 text-base mb-2">{d.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{d.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FEATURES */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className={`mb-16 text-center`}>
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('featLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('featTitle')}</h2>
            <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">{t('featSub')}</p>
            {platformImageUrl && (
              <div className="mt-10 flex justify-center">
                <Image
                  src={platformImageUrl}
                  alt="Platform overview"
                  width={900}
                  height={500}
                  className="w-full max-w-3xl h-auto rounded-2xl shadow-lg object-contain"
                  unoptimized={!platformImageUrl.startsWith('/') || platformImageUrl.startsWith('/uploads/')}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              const d = tl(f, lang)
              return (
                <div key={i} className={`rounded-2xl p-5 border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group bg-white ${isRtl ? 'text-right' : ''}`}>
                  <div className="w-10 h-10 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center mb-4 transition-colors">
                    <Icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm mb-1">{d.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{d.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PRICING / MARKETS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('pricingLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('pricingTitle')}</h2>
            <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">{t('pricingSub')}</p>
          </div>

          {/* Trial banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-8 mb-10 text-center text-white">
            <div className="text-5xl font-extrabold mb-2">{t('trialBig')}</div>
            <div className="text-emerald-100 text-lg mb-5">{t('trialSub')}</div>
            <div className="flex flex-wrap gap-3 justify-center text-sm">
              {ta('trialBadges').map(b => (
                <span key={b} className="bg-white/20 px-4 py-1.5 rounded-full">{b}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {MARKETS.map((m, idx) => {
              const d = tl(m, lang)
              return (
                <div key={idx} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
                  <div className={`bg-gradient-to-br ${m.color} px-6 py-5`}>
                    <div className="text-3xl mb-2">{m.flag}</div>
                    <h3 className="text-white font-extrabold text-lg">{d.country}</h3>
                    <p className="text-white/60 text-xs mt-1">{d.cities}</p>
                  </div>
                  <div className="px-5 py-4">
                    <div className="space-y-2 mb-4">
                      {m.pricing.map((p, pi) => (
                        <div key={pi} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{tl(p, lang)}</span>
                          <span className="font-bold text-emerald-600 text-xs">{p.fee}</span>
                        </div>
                      ))}
                    </div>
                    <Link href="/signup" className="block text-center bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">
                      {lang === 'ar' ? `ابدأ في ${d.country}` : lang === 'fr' ? `Démarrer au ${d.country}` : `Start in ${d.country}`}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Enterprise */}
          <div className="mt-6 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-white">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-xl text-gray-900 mb-2">{t('enterpriseTitle')}</h3>
            <p className="text-gray-500 max-w-xl mx-auto mb-5 text-sm">{t('enterpriseDesc')}</p>
            <a href="#contact" className="inline-flex items-center gap-2 border-2 border-gray-900 text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-gray-900 hover:text-white transition-all text-sm">
              {t('enterpriseCta')} <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TESTIMONIALS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('testimonialLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('testimonialTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((tm, i) => (
              <div key={i} className={`bg-gray-50 rounded-2xl p-6 border border-gray-100 ${isRtl ? 'text-right' : ''}`}>
                <div className={`flex gap-1 mb-4 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                  {Array.from({ length: tm.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">"{tl(tm.text, lang)}"</p>
                <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {tm.avatarUrl
                    ? <img src={tm.avatarUrl} alt={tm.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    : <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">{tm.name[0]}</div>
                  }
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{tm.name}</p>
                    <p className="text-gray-400 text-xs">{tl(tm.role, lang)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* EMAIL CTA */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative max-w-2xl mx-auto px-4 text-center">

          <div className="inline-flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/50 text-emerald-300 px-5 py-2 rounded-full text-sm mb-8">
            <Mail className="w-4 h-4" />
            {lang === 'ar' ? 'تسجيل سريع بالإيميل — بدون بطاقة بنكية'
              : lang === 'fr' ? 'Inscription rapide par email — sans carte bancaire'
              : 'Quick email signup — no credit card required'}
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            {t('finalTitle')}<br />
            <span className="text-emerald-400">
              {lang === 'ar' ? 'بإيميلك فقط' : lang === 'fr' ? 'Avec votre Email' : 'With Your Email'}
            </span>
          </h2>

          <p className="text-gray-400 mb-10 text-lg">
            {lang === 'ar' ? 'أدخل إيميلك وابدأ تجربتك المجانية فوراً — خصّص ملفك وأضف منيوك في دقائق.'
              : lang === 'fr' ? "Entrez votre email et démarrez votre essai gratuit — personnalisez votre profil et créez votre menu en minutes."
              : 'Enter your email and start your free trial instantly — customise your profile and build your menu in minutes.'}
          </p>

          <form onSubmit={handleEmailCta} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Mail className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={lang === 'ar' ? 'your@email.com' : lang === 'fr' ? 'votre@email.com' : 'your@email.com'}
                  required
                  dir="ltr"
                  className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-4 rounded-2xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white`}
                />
              </div>
              <button type="submit" disabled={ctaLoading}
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-600 text-white font-bold px-6 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-900/40 whitespace-nowrap">
                {ctaLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {ctaLoading ? '...'
                  : lang === 'ar' ? 'ابدأ مجاناً'
                  : lang === 'fr' ? 'Commencer'
                  : 'Get Started'}
              </button>
            </div>
            {ctaError && <p className="mt-3 text-red-400 text-sm">{ctaError}</p>}
            <p className="mt-4 text-gray-500 text-xs">{t('finalNote')}</p>
          </form>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FAQ */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block bg-gray-100 text-gray-600 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('faqLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('faqTitle')}</h2>
          </div>
          <div className="space-y-3">
            {(cfg.faqs && cfg.faqs.length > 0 ? cfg.faqs : FAQS).map((faq, i) => {
              const d = tl(faq, lang)
              return (
                <div key={i} className={`border rounded-2xl overflow-hidden transition-all ${openFaq === i ? 'border-emerald-300 shadow-sm' : 'border-gray-200'}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className={`w-full flex items-center justify-between px-6 py-4 gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className={`font-semibold text-gray-900 text-sm flex-1 ${isRtl ? 'text-right' : 'text-left'}`}>{d.q}</span>
                    {openFaq === i ? <ChevronUp className="w-5 h-5 text-emerald-600 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
                  </button>
                  {openFaq === i && (
                    <div className={`px-6 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3 ${isRtl ? 'text-right' : ''}`}>
                      {d.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CONTACT */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="contact" className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('contactLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('contactTitle')}</h2>
            <p className="mt-3 text-gray-500">{t('contactSub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: MessageCircle, label: 'WhatsApp', value: contactPhone, sub: lang === 'ar' ? 'رد خلال دقائق' : lang === 'fr' ? 'Réponse en minutes' : 'Response in minutes', color: 'text-green-600', bg: 'bg-green-50' },
              { icon: Mail, label: lang === 'ar' ? 'البريد الإلكتروني' : 'Email', value: contactEmail, sub: lang === 'ar' ? 'رد خلال ساعة' : lang === 'fr' ? 'Réponse en 1h' : 'Reply within 1 hour', color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: MapPin, label: lang === 'ar' ? 'المقر الرئيسي' : lang === 'fr' ? 'Siège Social' : 'Headquarters', value: lang === 'ar' ? 'الدار البيضاء، المغرب' : 'Casablanca, Morocco', sub: 'MA · SA · AE · SN · CI · KE', color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((c, i) => {
              const Icon = c.icon
              return (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                  <div className={`w-13 h-13 ${c.bg} rounded-2xl flex items-center justify-center mx-auto mb-4 w-14 h-14`}>
                    <Icon className={`w-6 h-6 ${c.color}`} />
                  </div>
                  <p className="font-bold text-gray-900 mb-1 text-sm">{c.label}</p>
                  <p className={`font-semibold text-sm ${c.color} mb-1`}>{c.value}</p>
                  <p className="text-gray-400 text-xs">{c.sub}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FINAL CTA */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-emerald-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">{t('finalTitle')}</h2>
          <p className="text-emerald-200 text-xl mb-10">{t('finalSub')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white hover:bg-gray-50 text-emerald-800 font-extrabold px-10 py-4 rounded-2xl text-base transition-all shadow-xl">{t('finalCta1')}</Link>
            <a href="#contact" className="border-2 border-white/50 hover:border-white text-white font-bold px-10 py-4 rounded-2xl text-base transition-all">{t('finalCta2')}</a>
          </div>
          <p className="mt-6 text-emerald-300 text-sm">{t('finalNote')}</p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-gray-950 text-gray-400 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-10 mb-12 ${isRtl ? 'text-right' : ''}`}>
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className={`flex items-center gap-2 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <Image src={logoImageUrl} alt="SmartMenu" width={36} height={36} className="rounded-xl object-contain" unoptimized={!logoImageUrl.startsWith('/') || logoImageUrl.startsWith('/uploads/')} />
                <span className="text-white font-extrabold text-lg">SmartMenu</span>
              </div>
              <p className="text-sm leading-relaxed mb-4">{t('madeWith')}</p>
              <div className={`flex gap-2 flex-wrap ${isRtl ? 'justify-end' : ''}`}>
                {['🇲🇦', '🇸🇦', '🇦🇪', '🇸🇳', '🇨🇮', '🇰🇪'].map(f => <span key={f} className="text-lg">{f}</span>)}
              </div>
              {/* Compliance badges */}
              <div className={`flex gap-2 mt-4 flex-wrap ${isRtl ? 'justify-end' : ''}`}>
                {['SSL', 'GDPR', 'PCI DSS'].map(b => (
                  <span key={b} className="text-[10px] font-bold border border-gray-700 text-gray-500 px-2 py-0.5 rounded flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" /> {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">{t('featLabel')}</h4>
              <ul className="space-y-2 text-sm">
                {(lang === 'ar'
                  ? ['المميزات', 'الأسعار', 'لوحة التحكم', 'شاشة المطبخ KDS', 'المنيو QR']
                  : lang === 'fr'
                  ? ['Fonctionnalités', 'Tarifs', 'Dashboard', 'Écran Cuisine', 'Menu QR']
                  : ['Features', 'Pricing', 'Dashboard', 'Kitchen Screen', 'QR Menu']
                ).map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">{lang === 'ar' ? 'الشركة' : lang === 'fr' ? 'Société' : 'Company'}</h4>
              <ul className="space-y-2 text-sm">
                {(lang === 'ar'
                  ? ['من نحن', 'تواصل معنا', 'الدعم الفني', t('privacy'), t('terms'), t('legal')]
                  : lang === 'fr'
                  ? ['À propos', 'Contact', 'Support', t('privacy'), t('terms'), t('legal')]
                  : ['About Us', 'Contact', 'Support', t('privacy'), t('terms'), t('legal')]
                ).map(l => <li key={l}><a href={l === t('privacy') ? '/privacy' : l === t('terms') ? '/terms' : l === t('legal') ? '/legal' : '#'} className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">{t('contactLabel')}</h4>
              <ul className="space-y-3 text-sm">
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Phone className="w-4 h-4 text-emerald-500 shrink-0" /> +212 6 00 00 00 00</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Mail className="w-4 h-4 text-emerald-500 shrink-0" /> contact@smartmenu.ma</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><MessageCircle className="w-4 h-4 text-green-500 shrink-0" /> WhatsApp</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Globe2 className="w-4 h-4 text-blue-500 shrink-0" /> AR · FR · EN</li>
              </ul>
            </div>
          </div>

          <div className={`border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
            <span>© {new Date().getFullYear()} SmartMenu — {t('allRights')}</span>
            <div className="flex items-center gap-4 text-gray-600">
              <a href="/privacy" className="hover:text-gray-400 transition-colors">{t('privacy')}</a>
              <span>·</span>
              <a href="/terms" className="hover:text-gray-400 transition-colors">{t('terms')}</a>
              <span>·</span>
              <a href="/legal" className="hover:text-gray-400 transition-colors">{t('legal')}</a>
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}
