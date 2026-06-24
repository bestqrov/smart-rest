"use client"

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, type ElementType } from 'react'
import { useRouter } from 'next/navigation'
import {
  QrCode, Zap, BarChart3, Star, CheckCircle, Menu, X,
  MessageCircle, ArrowRight, Loader2, ChefHat,
  CreditCard, Bell, Languages, Layers, TrendingUp,
  Shield, Phone, Mail, MapPin, ChevronDown, ChevronUp,
  Utensils, Coffee, Building2, ShoppingBag, Package,
  ThumbsUp, AlertTriangle, Wallet, Globe2, UserCircle, Share2,
  Clock, Calendar, Film,
  Upload, Brain, FileText, Send, ChevronRight,
} from 'lucide-react'

// ─── Types & i18n ──────────────────────────────────────────────────────────────

type Lang = 'en' | 'fr' | 'ar'

const T: Record<Lang, Record<string, string | string[]>> = {
  en: {
    tagline: 'The AI Operating System for Restaurants',
    h1a: 'The AI Operating System', h1b: 'for Restaurants',
    h1c: '',
    desc: 'Run your entire restaurant from one intelligent platform.\n\nManage menus, orders, POS, reservations, employees, attendance, marketing, social media and AI automation from a single dashboard.',
    cta1: 'Start Free Trial', cta2: 'Book a Demo',
    trustBar: 'Trusted by restaurants across Africa, GCC and Europe.',
    badges: ['No contract', '5-min setup', 'Support 24/7', 'No credit card'],
    whoLabel: 'Who Is It For', whoTitle: 'Built For Every F&B Business',
    whoSub: 'From solo cafés to hotel chains — SmartRestau scales with your ambition',
    howLabel: 'How It Works', howTitle: 'Operational in 5 Steps',
    howSub: 'From signup to a fully running restaurant OS in under 30 minutes',
    featLabel: 'Modules', featTitle: 'One OS. Every Module You Need.',
    featSub: '15+ AI-powered modules built for MENA & Africa markets',
    pricingLabel: 'Pricing', pricingTitle: 'Pay Only Per Completed Order',
    pricingSub: 'No monthly fee · No fixed costs · Tiny auto-calculated commission per order',
    trialBig: '7-Day Free Trial', trialSub: 'Launch your restaurant OS today — no credit card, no commitment',
    trialBadges: ['✓ All modules included', '✓ Unlimited orders', '✓ Live support', '✓ AI insights from day 1'],
    testimonialLabel: 'Success Stories', testimonialTitle: 'Restaurants Growing With SmartRestau',
    faqLabel: 'FAQ', faqTitle: 'Have a Question?',
    contactLabel: 'Contact', contactTitle: "We're Here to Help",
    contactSub: 'Support team available 7 days/week in Arabic, French & English',
    finalTitle: 'Your Restaurant OS Is Ready.',
    finalSub: 'Join 500+ restaurants & cafés already running on SmartRestau',
    finalCta1: 'Launch My Restaurant OS →', finalCta2: 'Talk to Our Team',
    finalNote: 'No credit card · No contract · Cancel anytime',
    cookie: 'We use cookies to improve your experience and analytics. See our',
    cookieLink: 'Privacy Policy', cookieAccept: 'Accept', cookieDecline: 'Decline',
    navLogin: 'Login', navSignup: 'Start Free',
    systemOk: '🟢 All systems operational',
    privacy: 'Privacy Policy', terms: 'Terms of Service', legal: 'Legal Notice',
    allRights: 'All rights reserved',
    madeWith: 'Built for MENA & Africa restaurants — AI-powered, locally tuned',
    enterpriseTitle: 'Enterprise & Chain Plans',
    enterpriseDesc: 'Multiple branches, custom branding, SLA guarantee, VIP support, POS integration',
    enterpriseCta: 'Contact Us for Custom Pricing',
    architectureLabel: 'Platform Architecture',
    architectureTitle: 'One Platform. Every Restaurant Operation.',
    architectureSub: 'Ten AI-powered modules. One unified OS. Your entire restaurant runs from a single dashboard.',
    marketingEngineLabel: 'AI Food Marketing Engine',
    marketingEngineTitle: 'Turn Every Dish Into a Marketing Campaign',
    marketingEngineSub: 'One photo. Infinite marketing content. Fully automated.',
    marketingEngineResultTitle: '0 Designers. 0 Videographers. 0 Social Media Managers.',
    marketingEngineResult: 'Restaurants generate daily marketing content — video ads, reels, captions and posts — fully automated by AI. No agency. No freelancers. No manual work.',
    marketingEngineCta: 'See It in Action →',
    statsLabel: 'Trusted globally',
  },
  fr: {
    tagline: "Le Système d'Exploitation IA pour les Restaurants",
    h1a: "Le Système d'Exploitation IA", h1b: 'pour les Restaurants',
    h1c: '',
    desc: "Pilotez l'intégralité de votre restaurant depuis une plateforme intelligente unique.\n\nGérez menus, commandes, POS, réservations, employés, présence, marketing, réseaux sociaux et automatisation IA depuis un seul tableau de bord.",
    cta1: 'Essai Gratuit', cta2: 'Réserver une Démo',
    trustBar: 'Utilisé par des restaurants en Afrique, GCC et Europe.',
    badges: ['Sans engagement', 'Config 5 min', 'Support 24/7', 'Sans carte bancaire'],
    whoLabel: 'Pour Qui', whoTitle: 'Conçu pour Chaque Business F&B',
    whoSub: "Du café solo aux chaînes hôtelières — SmartRestau évolue avec votre ambition",
    howLabel: 'Comment Ça Marche', howTitle: 'Opérationnel en 5 Étapes',
    howSub: "De l'inscription à un OS restaurant complet en moins de 30 minutes",
    featLabel: 'Modules', featTitle: 'Un OS. Tous les Modules Nécessaires.',
    featSub: '15+ modules IA pour les marchés MENA & Afrique',
    pricingLabel: 'Tarifs', pricingTitle: 'Payez Uniquement par Commande Complétée',
    pricingSub: "Pas d'abonnement · Pas de frais fixes · Petite commission auto-calculée",
    trialBig: '7 Jours Gratuits', trialSub: "Lancez votre OS restaurant aujourd'hui — sans carte bancaire",
    trialBadges: ['✓ Tous les modules inclus', '✓ Commandes illimitées', '✓ Support en direct', '✓ Insights IA dès le 1er jour'],
    testimonialLabel: 'Success Stories', testimonialTitle: 'Des Restaurants qui Grandissent avec SmartRestau',
    faqLabel: 'FAQ', faqTitle: 'Une Question ?',
    contactLabel: 'Contact', contactTitle: 'Nous Sommes Là pour Vous',
    contactSub: "Équipe disponible 7j/7 en arabe, français et anglais",
    finalTitle: 'Votre OS Restaurant est Prêt.',
    finalSub: "Rejoignez 500+ restaurants qui tournent déjà sur SmartRestau",
    finalCta1: 'Lancer Mon OS Restaurant →', finalCta2: 'Parler à Notre Équipe',
    finalNote: 'Sans carte · Sans contrat · Annulation à tout moment',
    cookie: 'Nous utilisons des cookies pour améliorer votre expérience. Voir notre',
    cookieLink: 'Politique de Confidentialité', cookieAccept: 'Accepter', cookieDecline: 'Refuser',
    navLogin: 'Connexion', navSignup: 'Essai Gratuit',
    systemOk: '🟢 Tous les systèmes opérationnels',
    privacy: 'Politique de Confidentialité', terms: "Conditions d'Utilisation", legal: 'Mentions Légales',
    allRights: 'Tous droits réservés',
    madeWith: 'Conçu pour les restaurants MENA & Afrique — IA embarquée, ancrage local',
    enterpriseTitle: 'Plans Entreprise & Chaînes',
    enterpriseDesc: 'Plusieurs branches, marque personnalisée, SLA garanti, support VIP, intégration POS',
    enterpriseCta: 'Nous Contacter pour un Devis Personnalisé',
    architectureLabel: 'Architecture Plateforme',
    architectureTitle: 'Une Plateforme. Toutes les Opérations Restaurant.',
    architectureSub: 'Dix modules IA. Un OS unifié. Tout votre restaurant depuis un seul tableau de bord.',
    marketingEngineLabel: 'Moteur Marketing IA Alimentaire',
    marketingEngineTitle: 'Transformez Chaque Plat en Campagne Marketing',
    marketingEngineSub: 'Une photo. Un contenu marketing infini. Entièrement automatisé.',
    marketingEngineResultTitle: '0 Designer. 0 Vidéaste. 0 Community Manager.',
    marketingEngineResult: "Les restaurants génèrent du contenu marketing quotidien — vidéos, reels, légendes et posts — entièrement automatisé par IA. Zéro agence. Zéro freelance. Zéro travail manuel.",
    marketingEngineCta: 'Voir en Action →',
    statsLabel: 'Reconnu mondialement',
  },
  ar: {
    tagline: 'نظام التشغيل الذكي للمطاعم',
    h1a: 'نظام التشغيل الذكي', h1b: 'للمطاعم',
    h1c: '',
    desc: 'أدِر مطعمك بالكامل من منصة ذكية واحدة.\n\nأدر قوائمك، طلباتك، POS، الحجوزات، الموظفين، الحضور، التسويق، السوشيال ميديا والأتمتة الذكية من لوحة تحكم واحدة.',
    cta1: 'ابدأ مجاناً', cta2: 'احجز عرضاً',
    trustBar: 'موثوق به من مطاعم في أفريقيا والخليج وأوروبا.',
    badges: ['بدون عقد', 'إعداد 5 دقائق', 'دعم 24/7', 'لا بطاقة بنكية'],
    whoLabel: 'الاستهداف', whoTitle: 'مصمم لكل قطاع F&B',
    whoSub: 'من المقاهي الصغيرة إلى سلاسل الفنادق — SmartRestau يتوسع مع طموحاتك',
    howLabel: 'كيف يعمل', howTitle: 'جاهز في 5 خطوات',
    howSub: 'من التسجيل إلى نظام تشغيل مطعم كامل في أقل من 30 دقيقة',
    featLabel: 'الوحدات', featTitle: 'نظام تشغيل واحد. كل الوحدات التي تحتاجها.',
    featSub: '15+ وحدة مدعومة بالذكاء الاصطناعي للسوق العربي والأفريقي',
    pricingLabel: 'الأسعار', pricingTitle: 'تدفع فقط على الطلبات المكتملة',
    pricingSub: 'لا اشتراك شهري · لا رسوم ثابتة · عمولة رمزية تُحسب تلقائياً',
    trialBig: '7 أيام مجاناً', trialSub: 'شغّل نظام مطعمك اليوم — لا بطاقة بنكية، لا التزام',
    trialBadges: ['✓ جميع الوحدات مفعّلة', '✓ طلبات غير محدودة', '✓ دعم فوري', '✓ تحليلات ذكية من اليوم الأول'],
    testimonialLabel: 'قصص نجاح', testimonialTitle: 'مطاعم تنمو مع SmartRestau',
    faqLabel: 'الأسئلة الشائعة', faqTitle: 'لديك سؤال؟',
    contactLabel: 'تواصل معنا', contactTitle: 'نحن هنا لمساعدتك',
    contactSub: 'فريق الدعم متاح 7 أيام بالعربية والفرنسية والإنجليزية',
    finalTitle: 'نظام تشغيل مطعمك جاهز.',
    finalSub: 'انضم لأكثر من 500 مطعم ومقهى يشتغل على SmartRestau يومياً',
    finalCta1: 'شغّل نظام مطعمي الآن ←', finalCta2: 'تحدث مع فريقنا',
    finalNote: 'لا بطاقة بنكية · لا عقد · إلغاء في أي وقت',
    cookie: 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك. راجع',
    cookieLink: 'سياسة الخصوصية', cookieAccept: 'قبول', cookieDecline: 'رفض',
    navLogin: 'تسجيل الدخول', navSignup: 'ابدأ مجاناً',
    systemOk: '🟢 جميع الأنظمة تعمل',
    privacy: 'سياسة الخصوصية', terms: 'شروط الاستخدام', legal: 'الإشعار القانوني',
    allRights: 'جميع الحقوق محفوظة',
    madeWith: 'مبني للمطاعم العربية والأفريقية — ذكاء اصطناعي، جذور محلية',
    enterpriseTitle: 'باقة المؤسسات والسلاسل',
    enterpriseDesc: 'عدة فروع، علامة تجارية خاصة، SLA مضمون، دعم VIP، تكامل مع POS',
    enterpriseCta: 'تواصل معنا للتسعير المخصص',
    architectureLabel: 'معمارية المنصة',
    architectureTitle: 'منصة واحدة. كل عمليات مطعمك.',
    architectureSub: 'عشر وحدات مدعومة بالذكاء الاصطناعي. نظام تشغيل موحد. مطعمك بالكامل من لوحة تحكم واحدة.',
    marketingEngineLabel: 'محرك التسويق الغذائي بالذكاء الاصطناعي',
    marketingEngineTitle: 'حوّل كل طبق إلى حملة تسويقية',
    marketingEngineSub: 'صورة واحدة. محتوى تسويقي لا نهائي. أتمتة كاملة.',
    marketingEngineResultTitle: '0 مصمم. 0 مصوّر. 0 مدير سوشيال ميديا.',
    marketingEngineResult: 'المطاعم تولّد محتوى تسويقياً يومياً — فيديوهات، ريلز، تعليقات ومنشورات — بشكل تلقائي بالذكاء الاصطناعي. لا وكالات. لا مستقلين. لا عمل يدوي.',
    marketingEngineCta: 'شاهده مباشرة ←',
    statsLabel: 'موثوق عالمياً',
  },
}

function tl<T>(item: { en: T; fr: T; ar: T }, lang: Lang): T {
  return item[lang]
}

function getEmbedUrl(url: string): string {
  if (!url) return ''
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1&color=white`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?color=10b981&title=0&byline=0`
  return url
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
    en:  { title: 'Independent Restaurant', pain: 'Lost revenue from errors & slow ops', gain: 'AI-powered OS live in 5 min — more revenue, zero errors' },
    fr:  { title: 'Restaurant Indépendant', pain: 'Revenus perdus à cause des erreurs et lenteurs', gain: 'OS IA en 5 min — plus de revenus, zéro erreur' },
    ar:  { title: 'مطعم مستقل',            pain: 'إيرادات ضائعة بسبب الأخطاء والبطء',  gain: 'نظام ذكي في 5 دقائق — إيرادات أكثر، أخطاء أقل' },
    border: 'border-emerald-200 hover:border-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', gainColor: 'text-emerald-700',
  },
  {
    icon: Coffee,
    en:  { title: 'Café & Snack Bar',      pain: 'Slow service kills retention & tips', gain: 'AI-assisted orders, 2× faster service & higher average ticket' },
    fr:  { title: 'Café & Snack',          pain: 'La lenteur tue la fidélisation et le ticket', gain: 'Commandes IA, service 2× plus rapide, ticket moyen plus élevé' },
    ar:  { title: 'مقهى وسناك',            pain: 'الخدمة البطيئة تضر بالولاء والإيراد',  gain: 'طلبات ذكية، خدمة مضاعفة السرعة، متوسط فاتورة أعلى' },
    border: 'border-amber-200 hover:border-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', gainColor: 'text-amber-700',
  },
  {
    icon: Building2,
    en:  { title: 'Hotel & Resort',        pain: 'Room service chaos & billing errors', gain: 'Automated operations, real-time analytics, zero revenue leakage' },
    fr:  { title: 'Hôtel & Resort',        pain: 'Chaos du service en chambre et erreurs de facturation', gain: 'Opérations automatisées, analytics temps réel, zéro perte' },
    ar:  { title: 'فندق ومنتجع',           pain: 'فوضى الغرف وأخطاء الفواتير',          gain: 'عمليات مؤتمتة، تحليلات فورية، صفر تسرب إيرادات' },
    border: 'border-sky-200 hover:border-sky-500', iconBg: 'bg-sky-50', iconColor: 'text-sky-600', gainColor: 'text-sky-700',
  },
  {
    icon: ShoppingBag,
    en:  { title: 'Chain & Food Court',    pain: 'Managing multiple outlets is hard',   gain: 'AI command center — all branches, one dashboard, full control' },
    fr:  { title: 'Chaîne & Food Court',   pain: 'Gérer plusieurs points de vente',     gain: 'Poste de commande IA — toutes les branches, un seul tableau de bord' },
    ar:  { title: 'سلسلة وفود كورت',       pain: 'إدارة فروع متعددة صعبة ومرهقة',      gain: 'مركز قيادة ذكي — كل الفروع من لوحة تحكم واحدة' },
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
    en: { title: 'Configure Your OS',      desc: 'Add your menu, set staff roles, link kitchen stations — your full operation in one setup.' },
    fr: { title: 'Configurez votre OS',    desc: 'Ajoutez votre menu, définissez les rôles staff et liez les stations cuisine — tout en une config.' },
    ar: { title: 'هيّئ نظام تشغيلك',       desc: 'أضف منيوك، عيّن أدوار الموظفين، اربط محطات المطبخ — كل عملياتك في إعداد واحد.' },
  },
  { step: '04', icon: Utensils,
    en: { title: 'Activate Your Tables',   desc: 'Print a QR sticker per table — customers scan to order and your OS manages everything.' },
    fr: { title: 'Activez vos Tables',     desc: 'Imprimez un QR par table — les clients scannent et votre OS gère tout le reste.' },
    ar: { title: 'فعّل طاولاتك',            desc: 'اطبع QR لكل طاولة — الزبون يمسح ويطلب، ونظامك يدير كل شيء.' },
  },
  { step: '05', icon: Zap,
    en: { title: 'Watch Your Business Run', desc: 'Orders, kitchen, staff and analytics — all live on your dashboard. Your OS handles the rest.' },
    fr: { title: 'Regardez votre Business Tourner', desc: 'Commandes, cuisine, staff et analytics — tout en direct. Votre OS gère le reste.' },
    ar: { title: 'شاهد مطعمك يعمل',         desc: 'طلبات، مطبخ، موظفين وإحصاءات — كل شيء مباشر على لوحتك. نظامك يتولى الباقي.' },
  },
]

const FEATURES = [
  { icon: BarChart3,
    en: { title: 'AI Revenue Analytics',     desc: 'Know top dishes, peak hours, and real margin per table — live data that drives decisions.' },
    fr: { title: 'Analytics IA des Revenus', desc: 'Identifiez vos plats phares, heures de pointe et marge réelle par table — données live.' },
    ar: { title: 'تحليلات الإيرادات الذكية', desc: 'اعرف الأطباق الأكثر مبيعاً، أوقات الذروة، والهامش الحقيقي لكل طاولة — بيانات فورية.' },
  },
  { icon: TrendingUp,
    en: { title: 'Smart Costing Engine',     desc: 'Auto-calculate dish costs vs price — know your real margins and stop bleeding money.' },
    fr: { title: 'Moteur de Costing Intelligent', desc: 'Calculez automatiquement le coût vs prix — connaissez vos vraies marges.' },
    ar: { title: 'محرك التكلفة الذكي',       desc: 'احسب تكلفة كل طبق مقابل سعره تلقائياً — اعرف هامش ربحك الحقيقي.' },
  },
  { icon: Package,
    en: { title: 'Auto Stock Deduction',     desc: 'Every order auto-deducts ingredient stock — real-time inventory, zero manual counting.' },
    fr: { title: 'Déduction Stock Auto',      desc: 'Chaque commande déduit le stock automatiquement — inventaire en temps réel.' },
    ar: { title: 'خصم المخزون التلقائي',     desc: 'كل طلب يخصم مكوناته من المخزون تلقائياً — متابعة فورية، لا جرد يدوي.' },
  },
  { icon: Zap,
    en: { title: 'Instant Kitchen Orders',   desc: 'Orders hit the kitchen in milliseconds with audio alert & KDS screen — zero delays.' },
    fr: { title: 'Commandes Cuisine Instantanées', desc: "Les commandes atteignent la cuisine en millisecondes — alerte audio et écran KDS." },
    ar: { title: 'طلبات فورية للمطبخ',       desc: 'الطلب يصل للمطبخ في الثانية مع صوت تنبيه وشاشة KDS — صفر تأخير.' },
  },
  { icon: ChefHat,
    en: { title: 'Kitchen Display (KDS)',     desc: 'Dedicated kitchen screen shows orders in sequence with prep timers — full operational control.' },
    fr: { title: 'Écran Cuisine (KDS)',        desc: "Écran dédié à la cuisine affichant les commandes en séquence avec minuteries." },
    ar: { title: 'شاشة المطبخ KDS',          desc: 'شاشة مخصصة للمطبخ تعرض الطلبات بالترتيب مع توقيت الإعداد — تحكم كامل.' },
  },
  { icon: Star,
    en: { title: 'Auto Google Reviews',      desc: 'Prompt guests to leave a Google review after every order — higher ranking, more customers.' },
    fr: { title: 'Avis Google Auto',          desc: 'Incitez les clients à laisser un avis Google après chaque commande — meilleur classement.' },
    ar: { title: 'تقييمات Google تلقائية',   desc: 'نشجع زبائنك على كتابة تقييم بعد كل طلب — ترتيب أعلى، زبائن أكثر.' },
  },
  { icon: Share2,
    en: { title: 'Automated Marketing Engine', desc: 'Turn every guest into a marketing channel — auto-prompt shares on Instagram, friend invites, and viral reach. Free ads at every table.' },
    fr: { title: 'Moteur Marketing Automatisé', desc: 'Transformez chaque client en canal marketing — partages Instagram automatiques, invitations, portée virale. Pub gratuite à chaque table.' },
    ar: { title: 'محرك تسويق آلي',           desc: 'كل زبون يصبح قناة تسويقية تلقائية — مشاركة إنستغرام، دعوة أصدقاء، وصول فيروسي. إعلان مجاني على كل طاولة.' },
  },
  { icon: ThumbsUp,
    en: { title: 'Customer Retention System', desc: 'Collect post-order ratings & comments — catch problems before they go public, keep customers coming back.' },
    fr: { title: 'Système de Fidélisation Client', desc: "Collectez notes et commentaires après commande — détectez les problèmes avant qu'ils deviennent publics." },
    ar: { title: 'نظام الاحتفاظ بالزبائن',   desc: 'اجمع التقييمات والتعليقات بعد كل طلب — اكتشف المشاكل مبكراً واحتفظ بزبائنك.' },
  },
  { icon: AlertTriangle,
    en: { title: 'Anti-Fraud Engine',        desc: 'Detects duplicate orders, suspicious patterns & fake reviews automatically — protect your revenue.' },
    fr: { title: 'Moteur Anti-Fraude',        desc: 'Détecte doublons, comportements suspects et faux avis automatiquement — protégez vos revenus.' },
    ar: { title: 'محرك مكافحة الاحتيال',    desc: 'يكشف الطلبات المكررة والأنماط المشبوهة والتقييمات المزيفة تلقائياً — حماية كاملة.' },
  },
  { icon: Wallet,
    en: { title: 'International Payments',   desc: 'Gulf: Stripe · Africa: Mobile Money (Wave, M-Pesa) · WhatsApp zero-rating. Every market covered.' },
    fr: { title: 'Paiements Internationaux', desc: 'Golfe: Stripe · Afrique: Mobile Money (Wave, M-Pesa). Tous les marchés couverts.' },
    ar: { title: 'مدفوعات دولية',            desc: 'الخليج: Stripe · أفريقيا: Mobile Money (Wave, M-Pesa) · واتساب بدون بيانات. كل الأسواق.' },
  },
  { icon: Languages,
    en: { title: 'Multilingual Operations',  desc: 'Arabic, French, English across the full OS — menu, staff screens, and analytics all localized.' },
    fr: { title: 'Opérations Multilingues',   desc: 'Arabe, français, anglais sur tout l\'OS — menu, écrans staff et analytics localisés.' },
    ar: { title: 'عمليات متعددة اللغات',     desc: 'العربية والفرنسية والإنجليزية في كل النظام — منيو، شاشات الموظفين وإحصاءات محلية.' },
  },
  { icon: Bell,
    en: { title: 'Waiter Call Button',       desc: 'One tap calls the waiter — better service experience, higher tips, stronger retention.' },
    fr: { title: "Bouton d'Appel Serveur",   desc: "Un tap appelle le serveur — meilleure expérience, plus de pourboires, fidélisation." },
    ar: { title: 'استدعاء النادل',            desc: 'زر واحد يستدعي النادل — تجربة أفضل، إكراميات أكثر، ولاء أقوى.' },
  },
  { icon: CreditCard,
    en: { title: 'Bill Request',             desc: 'Guests request the bill from their phone — faster table turnover, more covers per night.' },
    fr: { title: "Demande d'Addition",        desc: "Les clients demandent l'addition depuis leur téléphone — rotation plus rapide des tables." },
    ar: { title: 'طلب الحساب',               desc: 'الزبون يطلب الحساب من هاتفه — دوران طاولات أسرع، وتغطية أكثر في الليلة الواحدة.' },
  },
  { icon: Layers,
    en: { title: 'Table Merging',            desc: 'Large groups? Merge tables in one tap — single unified bill, zero collection confusion.' },
    fr: { title: 'Fusion de Tables',          desc: 'Grands groupes ? Fusionnez les tables en un tap — une facture unifiée, zéro confusion.' },
    ar: { title: 'دمج الطاولات',             desc: 'مجموعات كبيرة؟ ادمج الطاولات بضغطة — فاتورة موحدة، لا ارتباك في التحصيل.' },
  },
  { icon: QrCode,
    en: { title: 'Smart Menu (QR · No App)', desc: 'Part of the Smart Menu module — guests scan to browse and order instantly, no download needed. Works on any phone.' },
    fr: { title: 'Smart Menu (QR · Sans App)', desc: 'Inclus dans le module Smart Menu — les clients scannent et commandent, aucun téléchargement.' },
    ar: { title: 'Smart Menu (QR · بدون تطبيق)', desc: 'ضمن وحدة Smart Menu — الزبون يمسح ويطلب فوراً، بدون تحميل أو تسجيل.' },
  },
]

// ─── Platform Architecture ────────────────────────────────────────────────────

type ModuleLang = { en: string; fr: string; ar: string }
type ModuleFeatLang = { en: string[]; fr: string[]; ar: string[] }

const PLATFORM_MODULES: {
  Icon: ElementType
  prefix: string
  isAi: boolean
  name: ModuleLang
  features: ModuleFeatLang
  iconBg: string; iconColor: string; labelColor: string; border: string; dotColor: string
}[] = [
  {
    Icon: QrCode, prefix: 'SMART', isAi: false,
    name: { en: 'MENU', fr: 'MENU', ar: 'المنيو' },
    features: {
      en: ['QR Menu', 'Digital Menu', 'Multi-language Menu'],
      fr: ['Menu QR', 'Menu Digital', 'Menu Multilingue'],
      ar: ['منيو QR', 'منيو رقمي', 'منيو متعدد اللغات'],
    },
    iconBg: 'bg-emerald-900/60', iconColor: 'text-emerald-400',
    labelColor: 'text-emerald-500', border: 'border-emerald-700/40', dotColor: 'bg-emerald-400',
  },
  {
    Icon: CreditCard, prefix: 'SMART', isAi: false,
    name: { en: 'POS', fr: 'POS', ar: 'نقطة البيع' },
    features: {
      en: ['Orders', 'Payments', 'Receipts', 'Sales Tracking'],
      fr: ['Commandes', 'Paiements', 'Reçus', 'Suivi Ventes'],
      ar: ['الطلبات', 'المدفوعات', 'الإيصالات', 'تتبع المبيعات'],
    },
    iconBg: 'bg-blue-900/60', iconColor: 'text-blue-400',
    labelColor: 'text-blue-500', border: 'border-blue-700/40', dotColor: 'bg-blue-400',
  },
  {
    Icon: UserCircle, prefix: 'SMART', isAi: false,
    name: { en: 'STAFF', fr: 'STAFF', ar: 'الموظفون' },
    features: {
      en: ['Employees', 'Attendance', 'Scheduling', 'Roles & Permissions'],
      fr: ['Employés', 'Présence', 'Planning', 'Rôles & Permissions'],
      ar: ['الموظفون', 'الحضور', 'الجدولة', 'الأدوار والصلاحيات'],
    },
    iconBg: 'bg-violet-900/60', iconColor: 'text-violet-400',
    labelColor: 'text-violet-500', border: 'border-violet-700/40', dotColor: 'bg-violet-400',
  },
  {
    Icon: Calendar, prefix: 'SMART', isAi: false,
    name: { en: 'RESERVATIONS', fr: 'RÉSERVATIONS', ar: 'الحجوزات' },
    features: {
      en: ['Table Booking', 'Customer Management'],
      fr: ['Réservation Table', 'Gestion Clients'],
      ar: ['حجز الطاولات', 'إدارة العملاء'],
    },
    iconBg: 'bg-sky-900/60', iconColor: 'text-sky-400',
    labelColor: 'text-sky-500', border: 'border-sky-700/40', dotColor: 'bg-sky-400',
  },
  {
    Icon: BarChart3, prefix: 'SMART', isAi: false,
    name: { en: 'ANALYTICS', fr: 'ANALYTICS', ar: 'الإحصاءات' },
    features: {
      en: ['Revenue Tracking', 'Performance Reports', 'Customer Insights'],
      fr: ['Suivi Revenus', 'Rapports Performance', 'Insights Clients'],
      ar: ['تتبع الإيرادات', 'تقارير الأداء', 'رؤى العملاء'],
    },
    iconBg: 'bg-amber-900/60', iconColor: 'text-amber-400',
    labelColor: 'text-amber-500', border: 'border-amber-700/40', dotColor: 'bg-amber-400',
  },
  {
    Icon: Zap, prefix: 'SMART', isAi: true,
    name: { en: 'MARKETING AI', fr: 'MARKETING IA', ar: 'التسويق الذكي' },
    features: {
      en: ['Campaign Generation', 'Social Media Content', 'Promotions'],
      fr: ['Génération Campagnes', 'Contenu Social', 'Promotions'],
      ar: ['توليد الحملات', 'محتوى السوشيال', 'العروض الترويجية'],
    },
    iconBg: 'bg-pink-900/60', iconColor: 'text-pink-400',
    labelColor: 'text-pink-500', border: 'border-pink-700/40', dotColor: 'bg-pink-400',
  },
  {
    Icon: Film, prefix: 'SMART', isAi: true,
    name: { en: 'VIDEO AI', fr: 'VIDÉO IA', ar: 'الفيديو الذكي' },
    features: {
      en: ['Dish Video Creation', 'Promotional Videos', 'Reels Generation'],
      fr: ['Vidéos de Plats', 'Vidéos Promotionnelles', 'Génération Reels'],
      ar: ['فيديوهات الأطباق', 'فيديوهات ترويجية', 'توليد ريلز'],
    },
    iconBg: 'bg-rose-900/60', iconColor: 'text-rose-400',
    labelColor: 'text-rose-500', border: 'border-rose-700/40', dotColor: 'bg-rose-400',
  },
  {
    Icon: Globe2, prefix: 'SMART', isAi: false,
    name: { en: 'SOCIAL', fr: 'SOCIAL', ar: 'السوشيال' },
    features: {
      en: ['Facebook Publishing', 'Instagram Publishing', 'TikTok Publishing', 'YouTube Shorts Publishing'],
      fr: ['Publication Facebook', 'Publication Instagram', 'Publication TikTok', 'YouTube Shorts'],
      ar: ['نشر فيسبوك', 'نشر إنستغرام', 'نشر تيك توك', 'يوتيوب شورتس'],
    },
    iconBg: 'bg-indigo-900/60', iconColor: 'text-indigo-400',
    labelColor: 'text-indigo-500', border: 'border-indigo-700/40', dotColor: 'bg-indigo-400',
  },
  {
    Icon: Building2, prefix: 'SMART', isAi: false,
    name: { en: 'MULTI-BRANCH', fr: 'MULTI-BRANCH', ar: 'متعدد الفروع' },
    features: {
      en: ['Restaurant Chains', 'Franchise Management'],
      fr: ['Chaînes de Restaurants', 'Gestion Franchise'],
      ar: ['سلاسل المطاعم', 'إدارة الفرنشايز'],
    },
    iconBg: 'bg-teal-900/60', iconColor: 'text-teal-400',
    labelColor: 'text-teal-500', border: 'border-teal-700/40', dotColor: 'bg-teal-400',
  },
  {
    Icon: Layers, prefix: 'SMART', isAi: false,
    name: { en: 'WHITE LABEL', fr: 'WHITE LABEL', ar: 'وايت ليبل' },
    features: {
      en: ['Agencies', 'Resellers', 'Restaurant Consultants'],
      fr: ['Agences', 'Revendeurs', 'Consultants Restaurant'],
      ar: ['الوكالات', 'الموزعون', 'مستشارو المطاعم'],
    },
    iconBg: 'bg-gray-700/60', iconColor: 'text-gray-300',
    labelColor: 'text-gray-400', border: 'border-gray-600/40', dotColor: 'bg-gray-400',
  },
]

// ─── AI Marketing Engine Steps ───────────────────────────────────────────────

const AI_MARKETING_STEPS: {
  step: string
  Icon: ElementType
  title: { en: string; fr: string; ar: string }
  items: { en: string[]; fr: string[]; ar: string[] }
  clr: { text: string; bg: string; border: string; ring: string; dot: string; num: string }
}[] = [
  {
    step: '01', Icon: Upload,
    title: { en: 'Upload a Dish Photo', fr: 'Uploadez une Photo de Plat', ar: 'ارفع صورة الطبق' },
    items: {
      en: ['From your phone or camera', 'Any cuisine, any style', 'One click upload'],
      fr: ['Depuis votre téléphone', 'Toutes cuisines', 'Upload en un clic'],
      ar: ['من هاتفك أو كاميرتك', 'أي مطبخ، أي أسلوب', 'رفع بنقرة واحدة'],
    },
    clr: { text: 'text-emerald-400', bg: 'bg-emerald-900/40', border: 'border-emerald-700/50', ring: 'ring-emerald-700/30', dot: 'bg-emerald-400', num: 'text-emerald-500' },
  },
  {
    step: '02', Icon: Brain,
    title: { en: 'AI Analyzes Instantly', fr: "L'IA Analyse Instantanément", ar: 'الذكاء يحلّل فوراً' },
    items: {
      en: ['Ingredients & presentation', 'Colors & visual mood', 'Restaurant style & brand'],
      fr: ['Ingrédients & présentation', 'Couleurs & ambiance', 'Style & marque'],
      ar: ['المكونات والتقديم', 'الألوان والمزاج البصري', 'أسلوب المطعم وعلامته'],
    },
    clr: { text: 'text-blue-400', bg: 'bg-blue-900/40', border: 'border-blue-700/50', ring: 'ring-blue-700/30', dot: 'bg-blue-400', num: 'text-blue-500' },
  },
  {
    step: '03', Icon: FileText,
    title: { en: 'AI Generates Content', fr: "L'IA Génère le Contenu", ar: 'الذكاء يولّد المحتوى' },
    items: {
      en: ['Marketing text & captions', 'Social media posts', 'Ad concepts & promos'],
      fr: ['Textes marketing', 'Publications sociales', 'Concepts pub & promos'],
      ar: ['نصوص تسويقية', 'منشورات السوشيال', 'مفاهيم إعلانية وعروض'],
    },
    clr: { text: 'text-violet-400', bg: 'bg-violet-900/40', border: 'border-violet-700/50', ring: 'ring-violet-700/30', dot: 'bg-violet-400', num: 'text-violet-500' },
  },
  {
    step: '04', Icon: Film,
    title: { en: 'AI Creates Visuals', fr: "L'IA Crée les Visuels", ar: 'الذكاء يصنع المرئيات' },
    items: {
      en: ['Video Ads', 'Instagram Reels', 'TikTok Videos', 'Facebook Posts', 'Story Content'],
      fr: ['Vidéos Publicitaires', 'Instagram Reels', 'Vidéos TikTok', 'Posts Facebook', 'Stories'],
      ar: ['إعلانات فيديو', 'ريلز إنستغرام', 'فيديوهات تيك توك', 'منشورات فيسبوك', 'ستوري'],
    },
    clr: { text: 'text-rose-400', bg: 'bg-rose-900/40', border: 'border-rose-700/50', ring: 'ring-rose-700/30', dot: 'bg-rose-400', num: 'text-rose-500' },
  },
  {
    step: '05', Icon: Send,
    title: { en: 'AI Publishes on Schedule', fr: "L'IA Publie Automatiquement", ar: 'الذكاء ينشر بجدول تلقائي' },
    items: {
      en: ['Optimal posting times', 'All platforms at once', 'Zero manual work'],
      fr: ['Heures optimales', 'Toutes plateformes', 'Zéro travail manuel'],
      ar: ['أوقات نشر مثلى', 'كل المنصات دفعة واحدة', 'صفر عمل يدوي'],
    },
    clr: { text: 'text-amber-400', bg: 'bg-amber-900/40', border: 'border-amber-700/50', ring: 'ring-amber-700/30', dot: 'bg-amber-400', num: 'text-amber-500' },
  },
]

const OUTPUT_FORMATS = [
  { label: 'Video Ad',        ratio: '16:9', color: 'from-rose-900/60 to-rose-800/30',    border: 'border-rose-700/40',    icon: Film,         iconColor: 'text-rose-400'    },
  { label: 'Instagram Reel',  ratio: '9:16', color: 'from-pink-900/60 to-fuchsia-900/30', border: 'border-pink-700/40',    icon: Film,         iconColor: 'text-pink-400'    },
  { label: 'TikTok Video',    ratio: '9:16', color: 'from-gray-800/80 to-gray-900/60',    border: 'border-gray-600/40',    icon: Film,         iconColor: 'text-white'       },
  { label: 'Facebook Post',   ratio: '1:1',  color: 'from-blue-900/60 to-blue-800/30',    border: 'border-blue-700/40',    icon: Share2,       iconColor: 'text-blue-400'    },
  { label: 'Story Content',   ratio: '9:16', color: 'from-amber-900/60 to-orange-900/30', border: 'border-amber-700/40',   icon: Globe2,       iconColor: 'text-amber-400'   },
] as const

const MARKETS = [
  {
    flag: '🇲🇦', currency: 'MAD',
    en: { country: 'Morocco', cities: 'Agadir · Marrakech · Casablanca · Fes · Rabat' },
    fr: { country: 'Maroc',   cities: 'Agadir · Marrakech · Casablanca · Fès · Rabat' },
    ar: { country: 'المغرب',  cities: 'أكادير · مراكش · كازابلانكا · فاس · الرباط' },
    color: 'from-emerald-700 to-emerald-900',
    pricing: [
      { en: 'Under 30 MAD',  fr: 'Moins de 30 MAD', ar: 'أقل من 30 درهم',    fee: '0.30 MAD'    },
      { en: '30 — 70 MAD',   fr: '30 — 70 MAD',     ar: '30 — 70 درهم',      fee: '0.99 MAD'    },
      { en: '70 — 150 MAD',  fr: '70 — 150 MAD',    ar: '70 — 150 درهم',     fee: '3.99 MAD'    },
      { en: 'Over 150 MAD',  fr: 'Plus de 150 MAD', ar: 'أكثر من 150 درهم',  fee: '10 — 12 MAD' },
    ],
    note: { en: '−5% if order has 2+ items', fr: '−5% dès 2 articles', ar: 'خصم 5% عند طلب منتجين أو أكثر' },
    premium: { price: '199', currency: 'MAD', label: '199 MAD / mois' },
  },
  {
    flag: '🇸🇦', currency: 'SAR',
    en: { country: 'Saudi Arabia', cities: 'Riyadh · Jeddah · Mecca · Dammam · Medina' },
    fr: { country: 'Arabie Saoudite', cities: 'Riyad · Djeddah · La Mecque · Dammam' },
    ar: { country: 'السعودية',        cities: 'الرياض · جدة · مكة · الدمام · المدينة' },
    color: 'from-green-700 to-green-900',
    pricing: [
      { en: 'Under 15 SAR',  fr: 'Moins de 15 SAR', ar: 'أقل من 15 ريال',  fee: '1 SAR'  },
      { en: '15 — 40 SAR',   fr: '15 — 40 SAR',     ar: '15 — 40 ريال',    fee: '3 SAR'  },
      { en: '40 — 70 SAR',   fr: '40 — 70 SAR',     ar: '40 — 70 ريال',    fee: '6 SAR'  },
      { en: '70 — 120 SAR',  fr: '70 — 120 SAR',    ar: '70 — 120 ريال',   fee: '10 SAR' },
      { en: '120 — 200 SAR', fr: '120 — 200 SAR',   ar: '120 — 200 ريال',  fee: '15 SAR' },
      { en: 'Over 200 SAR',  fr: 'Plus de 200 SAR', ar: 'أكثر من 200 ريال',fee: '22 SAR' },
    ],
    note: { en: '−5% if order has 2+ items', fr: '−5% dès 2 articles', ar: 'خصم 5% عند طلب منتجين أو أكثر' },
    premium: { price: '159', currency: 'SAR', label: '159 SAR / month' },
  },
  {
    flag: '🇦🇪', currency: 'AED',
    en: { country: 'UAE',       cities: 'Dubai · Abu Dhabi · Sharjah · Ajman' },
    fr: { country: 'Émirats',   cities: 'Dubaï · Abu Dhabi · Sharjah · Ajman' },
    ar: { country: 'الإمارات',  cities: 'دبي · أبوظبي · الشارقة · عجمان' },
    color: 'from-red-700 to-red-900',
    pricing: [
      { en: 'Under 15 AED',  fr: 'Moins de 15 AED', ar: 'أقل من 15 درهم',  fee: '1 AED'  },
      { en: '15 — 40 AED',   fr: '15 — 40 AED',     ar: '15 — 40 درهم',    fee: '3 AED'  },
      { en: '40 — 80 AED',   fr: '40 — 80 AED',     ar: '40 — 80 درهم',    fee: '6 AED'  },
      { en: '80 — 130 AED',  fr: '80 — 130 AED',    ar: '80 — 130 درهم',   fee: '10 AED' },
      { en: '130 — 200 AED', fr: '130 — 200 AED',   ar: '130 — 200 درهم',  fee: '15 AED' },
      { en: 'Over 200 AED',  fr: 'Plus de 200 AED', ar: 'أكثر من 200 درهم',fee: '22 AED' },
    ],
    note: { en: '−5% if order has 2+ items', fr: '−5% dès 2 articles', ar: 'خصم 5% عند طلب منتجين أو أكثر' },
    premium: { price: '159', currency: 'AED', label: '159 AED / month' },
  },
  {
    flag: '🇩🇿🇹🇳🇪🇬', currency: 'DZD/TND/EGP',
    en: { country: 'North Africa', cities: 'Algiers · Tunis · Cairo · Tripoli · Oran' },
    fr: { country: 'Afrique du Nord', cities: 'Alger · Tunis · Le Caire · Tripoli · Oran' },
    ar: { country: 'شمال أفريقيا', cities: 'الجزائر · تونس · القاهرة · طرابلس · وهران' },
    color: 'from-sky-700 to-sky-900',
    pricing: [
      { en: 'Algeria (DZD)',  fr: 'Algérie (DZD)', ar: 'الجزائر (دينار)', fee: '15 → 450 DZD' },
      { en: 'Tunisia (TND)',  fr: 'Tunisie (TND)', ar: 'تونس (دينار)',    fee: '0.15 → 5 TND' },
      { en: 'Egypt (EGP)',    fr: 'Égypte (EGP)',  ar: 'مصر (جنيه)',      fee: '2 → 60 EGP'   },
      { en: 'Libya (LYD)',    fr: 'Libye (LYD)',   ar: 'ليبيا (دينار)',   fee: '0.30 → 8 LYD' },
    ],
    note: { en: '−5% if order has 2+ items', fr: '−5% dès 2 articles', ar: 'خصم 5% عند طلب منتجين أو أكثر' },
    premium: null,
  },
  {
    flag: '🇫🇷🇪🇸🇧🇪', currency: 'EUR',
    en: { country: 'Europe', cities: 'Paris · Madrid · Brussels · Berlin · Rome · Amsterdam' },
    fr: { country: 'Europe', cities: 'Paris · Madrid · Bruxelles · Berlin · Rome · Amsterdam' },
    ar: { country: 'أوروبا', cities: 'باريس · مدريد · بروكسل · برلين · روما · أمستردام' },
    color: 'from-blue-700 to-blue-900',
    pricing: [
      { en: 'Under €5',    fr: 'Moins de 5€',  ar: 'أقل من 5 يورو',   fee: '€0.10' },
      { en: '€5 — €12',   fr: '5€ — 12€',     ar: '5 — 12 يورو',     fee: '€0.25' },
      { en: '€12 — €25',  fr: '12€ — 25€',    ar: '12 — 25 يورو',    fee: '€0.50' },
      { en: '€25 — €50',  fr: '25€ — 50€',    ar: '25 — 50 يورو',    fee: '€0.80' },
      { en: '€50 — €100', fr: '50€ — 100€',   ar: '50 — 100 يورو',   fee: '€1.20' },
      { en: 'Over €100',  fr: 'Plus de 100€', ar: 'أكثر من 100 يورو', fee: '€2.00' },
    ],
    note: { en: '−5% if order has 2+ items', fr: '−5% dès 2 articles', ar: 'خصم 5% عند طلب منتجين أو أكثر' },
    premium: { price: '159', currency: 'EUR', label: '159 € / mois' },
  },
  {
    flag: '🇸🇳🇨🇮🇧🇫', currency: 'XOF',
    en: { country: 'West Africa', cities: 'Dakar · Abidjan · Ouagadougou · Bamako' },
    fr: { country: "Afrique de l'Ouest", cities: 'Dakar · Abidjan · Ouagadougou · Bamako' },
    ar: { country: 'غرب أفريقيا', cities: 'داكار · أبيدجان · واغادوغو · باماكو' },
    color: 'from-yellow-700 to-yellow-900',
    pricing: [
      { en: 'Under 2,000 XOF', fr: 'Moins de 2 000 XOF', ar: 'أقل من 2000 فرنك', fee: '50 XOF'  },
      { en: '2,000 — 5,000',   fr: '2 000 — 5 000',       ar: '2000 — 5000',      fee: '200 XOF' },
      { en: 'Over 5,000 XOF',  fr: 'Plus de 5 000 XOF',   ar: 'أكثر من 5000',    fee: '500 XOF' },
    ],
    note: { en: '−5% if order has 2+ items', fr: '−5% dès 2 articles', ar: 'خصم 5% عند طلب منتجين أو أكثر' },
    premium: { price: '13 000', currency: 'XOF', label: '13 000 XOF / mois' },
  },
  {
    flag: '🌍', currency: 'XOF/KES/XAF',
    en: { country: 'Sub-Saharan Africa', cities: 'Dakar · Abidjan · Nairobi · Libreville · Yaoundé' },
    fr: { country: 'Afrique subsaharienne', cities: 'Dakar · Abidjan · Nairobi · Libreville · Yaoundé' },
    ar: { country: 'أفريقيا جنوب الصحراء', cities: 'داكار · أبيدجان · نيروبي · ليبرفيل · ياوندي' },
    color: 'from-orange-700 to-orange-900',
    pricing: [
      { en: 'Senegal/CI (XOF)',  fr: 'Sénégal/CI (XOF)',   ar: 'السنغال/ساحل العاج', fee: '25 → 600 XOF' },
      { en: 'Gabon/Cam (XAF)',   fr: 'Gabon/Cam (XAF)',    ar: 'الغابون/الكاميرون',  fee: '25 → 550 XAF' },
      { en: 'Kenya (KES)',        fr: 'Kenya (KES)',         ar: 'كينيا (شلن)',         fee: '10 → 180 KES' },
      { en: 'Mobile Money',       fr: 'Mobile Money',        ar: 'موبايل موني',         fee: 'Wave · M-Pesa' },
    ],
    note: { en: '−5% if order has 2+ items', fr: '−5% dès 2 articles', ar: 'خصم 5% عند طلب منتجين أو أكثر' },
    premium: null,
  },
]

const TESTIMONIALS: LandingConfig['testimonials'] = [
  {
    name: 'Mohammed Idrissi', avatarUrl: undefined,
    role: { en: 'Owner, Brahim Restaurant — Marrakech', fr: 'Propriétaire, Restaurant Brahim — Marrakech', ar: 'صاحب مطعم ببراهيم، مراكش' },
    rating: 5,
    text: { en: 'SmartRestau changed how I run my entire restaurant. Errors dropped to near zero, the kitchen operates like clockwork, and I finally have real visibility into my margins.', fr: "SmartRestau a transformé la façon dont je gère mon restaurant. Les erreurs ont presque disparu, la cuisine fonctionne parfaitement et j'ai enfin une vraie visibilité sur mes marges.", ar: 'SmartRestau غيّر طريقة إدارتي للمطعم بالكامل. الأخطاء وصلت لشبه صفر، المطبخ يشتغل بدقة، وأخيراً عندي رؤية حقيقية على هامش ربحي.' },
  },
  {
    name: 'Fatima Bouzidi', avatarUrl: undefined,
    role: { en: 'Manager, Café Latte — Agadir', fr: 'Directrice, Café Latte — Agadir', ar: 'مديرة كافي لاتيه، أكادير' },
    rating: 5,
    text: { en: 'In under an hour the entire operation was live — orders, kitchen, staff management and analytics. Revenue went up 25% the first month because we stopped losing orders.', fr: "En moins d'une heure, toute l'opération était en ligne — commandes, cuisine, gestion du staff et analytics. Les revenus ont augmenté de 25% le premier mois.", ar: 'في أقل من ساعة كان كل شيء شغّال — طلبات، مطبخ، إدارة موظفين وإحصاءات. الإيرادات ارتفعت 25% الشهر الأول لأننا توقفنا عن خسارة الطلبات.' },
  },
  {
    name: 'Khalid Al-Omari', avatarUrl: undefined,
    role: { en: 'Owner, Food Court — Riyadh', fr: 'Propriétaire, Food Court — Riyad', ar: 'صاحب فود كورت، الرياض' },
    rating: 5,
    text: { en: 'Managing 3 branches used to be chaos. Now I see everything from one dashboard — revenue, kitchen load, staff performance. It is a real operating system for my business.', fr: 'Gérer 3 branches était un chaos. Maintenant je vois tout depuis un tableau de bord — revenus, charge cuisine, performance staff. C\'est un vrai système d\'exploitation pour mon business.', ar: 'إدارة 3 فروع كانت فوضى. الآن أشوف كل شيء من لوحة تحكم واحدة — إيرادات، حمل المطبخ، أداء الموظفين. هذا فعلاً نظام تشغيل حقيقي لمطعمي.' },
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
  promoVideoUrl?: string
  text?: {
    ar?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; trustBar?: string; featTitle?: string; featSub?: string }
    en?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; trustBar?: string; featTitle?: string; featSub?: string }
    fr?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; trustBar?: string; featTitle?: string; featSub?: string }
  }
  faqs?: { en: { q: string; a: string }; fr: { q: string; a: string }; ar: { q: string; a: string } }[]
  footer?: {
    brandName?: string
    flags?: string[]
    whatsapp?: string
    email?: string
    copyright?: string
  }
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
  const promoVideoUrl    = cfg.promoVideoUrl    ?? ''
  const promoEmbedUrl    = getEmbedUrl(promoVideoUrl)
  const contactPhone  = cfg.contact?.whatsapp ?? '+212 664546849'
  const contactEmail  = cfg.contact?.email    ?? 'smartrestau@gmail.com'
  const footerBrand   = cfg.footer?.brandName ?? 'SmartMenu'
  const footerFlags   = cfg.footer?.flags
    ? (Array.isArray(cfg.footer.flags) ? cfg.footer.flags : String(cfg.footer.flags).split(',').map(f => f.trim()).filter(Boolean))
    : ['🇲🇦','🇸🇦','🇦🇪','🇸🇳','🇨🇮','🇰🇪']
  const footerPhone   = cfg.footer?.whatsapp  ?? contactPhone
  const footerEmail   = cfg.footer?.email     ?? contactEmail
  const footerCopy    = cfg.footer?.copyright ?? `© ${new Date().getFullYear()} SmartMenu`

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
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes heroFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1);    }
        }
        .hero-title-mobile { animation: heroFadeUp 0.55s cubic-bezier(.22,1,.36,1) both; }
        .hero-visual       { animation: heroFadeIn 0.65s cubic-bezier(.22,1,.36,1) 0.18s both; }
        .hero-text-body    { animation: heroFadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.32s both; }
      `}</style>

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
              <span className="hidden sm:block text-[10px] text-emerald-600 font-semibold leading-none">AI OS · OPERATE · GROW</span>
            </div>
          </div>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-6 text-sm text-gray-600 font-medium">
            <a href="#who"      className="hover:text-emerald-700 transition-colors">{t('whoLabel')}</a>
            <a href="#platform" className="hover:text-emerald-700 transition-colors">{t('architectureLabel')}</a>
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
            {[['#who', t('whoLabel')], ['#platform', t('architectureLabel')], ['#features', t('featLabel')], ['#how', t('howLabel')], ['#pricing', t('pricingLabel')], ['#contact', t('contactLabel')]].map(([href, label]) => (
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

        <div className={`relative max-w-7xl mx-auto px-4 pt-10 pb-14 lg:pt-16 lg:pb-20 flex flex-col ${isRtl ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-5 lg:gap-16`}>

          {/* ── Mobile-first: tagline + title FIRST on small screens ── */}
          <div className="lg:hidden w-full text-center hero-title-mobile">
            <div className="inline-flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/40 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {t('tagline')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.1] text-white mt-1">
              {t('h1a')}
              <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{t('h1b')}</span>
            </h1>
          </div>

          {/* ── Text column (desktop: full left col; mobile: desc+CTAs below visual) ── */}
          <div className={`flex-1 ${isRtl ? 'text-right' : 'text-left'} text-center lg:text-inherit order-3 lg:order-none hero-text-body`}>

            {/* Desktop-only title */}
            <div className="hidden lg:block">
              <div className="inline-flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/40 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium mb-7">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {t('tagline')}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] text-white">
                {t('h1a')}
                <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{t('h1b')}</span>
              </h1>
            </div>

            <p className="mt-5 text-base sm:text-lg text-gray-400 leading-relaxed max-w-lg whitespace-pre-line">{t('desc')}</p>

            <div className={`mt-7 flex flex-col sm:flex-row gap-3 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              <Link href="/signup" className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-7 py-3.5 rounded-xl shadow-xl shadow-emerald-900/40 transition-all text-base">
                {t('cta1')} <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#contact" className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold px-7 py-3.5 rounded-xl transition-all text-base">
                {t('cta2')}
              </a>
            </div>

            {/* Trust bar */}
            <p className={`mt-5 text-gray-500 text-sm flex items-center gap-2 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              <span className="flex gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
              </span>
              {t('trustBar')}
            </p>

            <div className={`mt-4 flex flex-wrap gap-2 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              {ta('badges').map(b => (
                <span key={b} className="flex items-center gap-1.5 bg-white/8 text-gray-300 border border-white/10 px-3 py-1.5 rounded-full text-xs font-medium">
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" /> {b}
                </span>
              ))}
            </div>
          </div>

          {/* ── Dashboard visual — order-2 on mobile = after title, before text ── */}
          <div className="flex-1 flex items-center justify-center mt-1 lg:mt-0 order-2 lg:order-none hero-visual">
            <div className="relative w-full max-w-sm lg:max-w-xl xl:max-w-2xl">
              <div className="absolute -inset-8 rounded-3xl bg-emerald-500/15 blur-3xl" />
              <div className="absolute -inset-16 rounded-3xl bg-teal-500/8 blur-[80px]" />

              {/* Dashboard frame */}
              <div className="relative bg-gray-900/90 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">

                {/* Window chrome */}
                <div className="bg-gray-800/80 px-4 py-2.5 flex items-center gap-3 border-b border-gray-700/50">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <span className="text-[11px] text-gray-400 font-medium bg-gray-700/50 px-3 py-0.5 rounded-full">SmartRestau OS — Dashboard</span>
                  </div>
                </div>

                {/* KPI row */}
                <div className="p-3 grid grid-cols-3 gap-2">
                  <div className="bg-emerald-900/40 border border-emerald-700/30 rounded-xl p-3 text-center">
                    <p className="text-emerald-400 text-[9px] font-bold uppercase tracking-wider mb-1">Revenue</p>
                    <p className="text-white text-lg font-extrabold">+32%</p>
                  </div>
                  <div className="bg-blue-900/40 border border-blue-700/30 rounded-xl p-3 text-center">
                    <p className="text-blue-400 text-[9px] font-bold uppercase tracking-wider mb-1">Orders</p>
                    <p className="text-white text-lg font-extrabold">1,248</p>
                  </div>
                  <div className="bg-amber-900/40 border border-amber-700/30 rounded-xl p-3 text-center">
                    <p className="text-amber-400 text-[9px] font-bold uppercase tracking-wider mb-1">Tables</p>
                    <p className="text-white text-lg font-extrabold">24 / 24</p>
                  </div>
                </div>

                {/* Module grid */}
                <div className="px-3 pb-3 grid grid-cols-4 gap-2">
                  {([
                    { icon: CreditCard, label: 'POS',            color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-800/40', badge: 'LIVE',       badgeColor: 'bg-emerald-500/20 text-emerald-300' },
                    { icon: UserCircle, label: 'Staff Mgmt',     color: 'text-blue-400',    bg: 'bg-blue-900/30 border-blue-800/40',       badge: '12 active',  badgeColor: 'bg-blue-500/20 text-blue-300'    },
                    { icon: Clock,      label: 'Attendance',     color: 'text-violet-400',  bg: 'bg-violet-900/30 border-violet-800/40',   badge: 'AI',         badgeColor: 'bg-violet-500/20 text-violet-300'},
                    { icon: Calendar,   label: 'Reservations',   color: 'text-sky-400',     bg: 'bg-sky-900/30 border-sky-800/40',         badge: '8 today',    badgeColor: 'bg-sky-500/20 text-sky-300'     },
                    { icon: BarChart3,  label: 'Analytics',      color: 'text-amber-400',   bg: 'bg-amber-900/30 border-amber-800/40',     badge: 'Live',       badgeColor: 'bg-amber-500/20 text-amber-300' },
                    { icon: Zap,        label: 'AI Marketing',   color: 'text-pink-400',    bg: 'bg-pink-900/30 border-pink-800/40',       badge: 'Auto',       badgeColor: 'bg-pink-500/20 text-pink-300'   },
                    { icon: Film,       label: 'Video Studio',   color: 'text-rose-400',    bg: 'bg-rose-900/30 border-rose-800/40',       badge: 'AI',         badgeColor: 'bg-rose-500/20 text-rose-300'   },
                    { icon: Building2,  label: 'Multi-Branch',   color: 'text-teal-400',    bg: 'bg-teal-900/30 border-teal-800/40',       badge: '3 branches', badgeColor: 'bg-teal-500/20 text-teal-300'   },
                  ] as const).map(({ icon: Icon, label, color, bg, badge, badgeColor }) => (
                    <div key={label} className={`${bg} border rounded-xl p-3 flex flex-col gap-2`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                      <p className="text-white text-[11px] font-bold leading-tight">{label}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor} w-fit`}>{badge}</span>
                    </div>
                  ))}
                </div>
              </div>
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
      {/* ECOSYSTEM SHOWCASE */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-950 py-24 relative overflow-hidden">
        {/* dot grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        {/* ambient center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4">

          {/* Section header */}
          <div className="text-center mb-14">
            <span className="inline-block bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
              {lang === 'ar' ? 'المنصة الشاملة' : lang === 'fr' ? 'Vue d\'ensemble' : 'Platform Overview'}
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-5">
              {lang === 'ar' ? (
                <>كل ما يحتاجه مطعمك.<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">في نظام واحد.</span></>
              ) : lang === 'fr' ? (
                <>Tout ce dont votre restaurant a besoin.<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Dans un seul OS.</span></>
              ) : (
                <>Everything Your Restaurant Needs.<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">One Unified OS.</span></>
              )}
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              {lang === 'ar'
                ? 'من القوائم الذكية وشاشات المطبخ إلى التسويق بالذكاء الاصطناعي والنشر التلقائي — كل شيء متصل وكل شيء مؤتمت.'
                : lang === 'fr'
                ? 'Des menus intelligents aux écrans cuisine, en passant par le marketing IA et la publication sociale — tout connecté, tout automatisé.'
                : 'From smart menus and kitchen displays to AI marketing and social publishing — all connected, all automated.'}
            </p>
          </div>

          {/* Image showcase */}
          <div className="relative">
            {/* outer glow ring */}
            <div className="absolute -inset-6 bg-gradient-to-r from-emerald-500/20 via-teal-400/10 to-emerald-500/20 rounded-3xl blur-2xl" />
            {/* mid glow */}
            <div className="absolute -inset-2 bg-gradient-to-br from-emerald-900/30 to-transparent rounded-2xl" />
            {/* image frame */}
            <div className="relative rounded-2xl overflow-hidden border border-emerald-700/40 shadow-[0_0_80px_rgba(16,185,129,0.15)] ring-1 ring-white/5">
              <Image
                src="/assets/smartrest.png"
                alt="Smart Resto — Complete Restaurant OS"
                width={1400}
                height={900}
                className="w-full h-auto object-cover"
                priority
                unoptimized
              />
              {/* subtle bottom fade */}
              <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-gray-950/60 to-transparent" />
            </div>
          </div>

          {/* Benefits bar */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              { icon: TrendingUp, en: 'Increase Revenue',     fr: 'Augmenter les Revenus',  ar: 'زيادة الإيرادات',     color: 'emerald' },
              { icon: CheckCircle,icon2: CheckCircle, en: 'Reduce Errors',         fr: 'Réduire les Erreurs',    ar: 'تقليل الأخطاء',      color: 'blue'    },
              { icon: Clock,      en: 'Save Time',            fr: 'Gagner du Temps',         ar: 'توفير الوقت',         color: 'amber'   },
              { icon: Layers,     en: 'Control Operations',   fr: 'Contrôler les Opérations',ar: 'التحكم في العمليات',  color: 'violet'  },
              { icon: Star,       en: 'Delight Customers',    fr: 'Ravir les Clients',        ar: 'إسعاد الزبائن',       color: 'rose'    },
              { icon: Zap,        en: 'Grow Your Brand',      fr: 'Développer votre Marque',  ar: 'تنمية علامتك',       color: 'teal'    },
            ] as const).map(({ icon: Icon, en: enL, fr: frL, ar: arL, color }) => {
              const label = lang === 'ar' ? arL : lang === 'fr' ? frL : enL
              const colorMap: Record<string, { bg: string; text: string; border: string }> = {
                emerald: { bg: 'bg-emerald-900/40', text: 'text-emerald-300', border: 'border-emerald-700/40' },
                blue:    { bg: 'bg-blue-900/40',    text: 'text-blue-300',    border: 'border-blue-700/40'    },
                amber:   { bg: 'bg-amber-900/40',   text: 'text-amber-300',   border: 'border-amber-700/40'   },
                violet:  { bg: 'bg-violet-900/40',  text: 'text-violet-300',  border: 'border-violet-700/40'  },
                rose:    { bg: 'bg-rose-900/40',    text: 'text-rose-300',    border: 'border-rose-700/40'    },
                teal:    { bg: 'bg-teal-900/40',    text: 'text-teal-300',    border: 'border-teal-700/40'    },
              }
              const c = colorMap[color]
              return (
                <div key={enL} className={`flex flex-col items-center gap-2.5 ${c.bg} border ${c.border} rounded-2xl px-4 py-5 text-center`}>
                  <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                  <span className={`text-sm font-semibold ${c.text} leading-tight`}>{label}</span>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PROMO VIDEO */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {promoEmbedUrl && (
        <section className="bg-gray-900 py-24 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-emerald-600/10 rounded-full blur-[130px] pointer-events-none" />

          <div className="relative max-w-5xl mx-auto px-4">

            {/* Header */}
            <div className="text-center mb-14">
              <span className="inline-block bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
                {lang === 'ar' ? 'شاهده مباشرة' : lang === 'fr' ? 'Voir en Action' : 'See It in Action'}
              </span>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
                {lang === 'ar' ? (
                  <>شاهد كيف يحوّل SmartRestau<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">مطعمك في أقل من 30 دقيقة</span></>
                ) : lang === 'fr' ? (
                  <>Regardez comment SmartRestau<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">transforme un restaurant en 30 min</span></>
                ) : (
                  <>Watch How SmartRestau<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Transforms a Restaurant in 30 Min</span></>
                )}
              </h2>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">
                {lang === 'ar'
                  ? 'من الإعداد الأول إلى أول طلب حقيقي — شاهد كل شيء بالكامل.'
                  : lang === 'fr'
                  ? 'De la première config au premier vrai ticket — regardez tout en direct.'
                  : 'From first setup to first real ticket — watch the full walkthrough.'}
              </p>
            </div>

            {/* Browser-frame video */}
            <div className="relative">
              {/* outer glow */}
              <div className="absolute -inset-6 bg-gradient-to-r from-emerald-500/20 via-teal-400/8 to-emerald-500/20 rounded-3xl blur-2xl" />
              {/* frame */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-700/70 shadow-[0_0_60px_rgba(16,185,129,0.12)] ring-1 ring-white/5 bg-gray-950">
                {/* window chrome */}
                <div className="bg-gray-800/90 px-4 py-3 flex items-center gap-3 border-b border-gray-700/60">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <span className="text-[11px] text-gray-400 bg-gray-700/50 px-3 py-0.5 rounded-full font-medium">
                      SmartRestau — Platform Demo
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold shrink-0">● LIVE</span>
                </div>
                {/* 16:9 responsive iframe */}
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={promoEmbedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title="SmartRestau Demo"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* CTA below video */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-emerald-900/40 transition-all text-base">
                {t('cta1')} <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#contact" className="flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/15 text-gray-300 font-semibold px-8 py-3.5 rounded-xl transition-all text-base">
                {t('cta2')}
              </a>
            </div>

          </div>
        </section>
      )}

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
      {/* PLATFORM ARCHITECTURE */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="platform" className="py-24 bg-gray-950 relative overflow-hidden">
        {/* bg dot grid */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* ambient glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-4">

          {/* Header */}
          <div className="text-center mb-16">
            <span className="inline-block bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-4 py-1 rounded-full text-sm font-semibold mb-5">
              {t('architectureLabel')}
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
              {lang === 'ar'
                ? <>منصة واحدة. <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">كل عمليات مطعمك.</span></>
                : lang === 'fr'
                ? <>Une Plateforme. <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Toutes les Opérations.</span></>
                : <>One Platform. <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Every Restaurant Operation.</span></>
              }
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('architectureSub')}</p>
          </div>

          {/* Module grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {PLATFORM_MODULES.map((mod) => (
              <div
                key={mod.name.en}
                className={`group relative bg-gray-900/70 border ${mod.border} rounded-2xl p-5 hover:bg-gray-900 hover:scale-[1.02] transition-all duration-200 cursor-default overflow-hidden`}
              >
                {/* subtle inner glow on hover */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`}
                  style={{ background: `radial-gradient(circle at 30% 20%, ${mod.iconColor.replace('text-', '').replace('-400', '')} 0%, transparent 70%)`, opacity: 0 }} />

                {/* Icon */}
                <div className={`w-11 h-11 ${mod.iconBg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <mod.Icon className={`w-5 h-5 ${mod.iconColor}`} />
                </div>

                {/* Module name */}
                <div className="mb-3">
                  <p className={`text-[9px] font-extrabold uppercase tracking-[0.15em] ${mod.labelColor} mb-0.5`}>
                    {mod.prefix}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-white font-extrabold text-sm leading-tight">{mod.name[lang]}</h3>
                    {mod.isAi && (
                      <span className="inline-flex items-center text-[9px] font-extrabold bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded-full leading-none">
                        AI
                      </span>
                    )}
                  </div>
                </div>

                {/* Feature list */}
                <ul className="space-y-1.5">
                  {mod.features[lang].map((feat) => (
                    <li key={feat} className={`flex items-center gap-2 text-[11px] text-gray-400 leading-tight ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className={`w-1 h-1 rounded-full ${mod.dotColor} shrink-0`} />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom connector line */}
          <div className="mt-12 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
              {lang === 'ar' ? 'كل الوحدات متصلة • بيانات موحدة • لوحة تحكم واحدة'
                : lang === 'fr' ? 'Tous les modules connectés • Données unifiées • Un seul dashboard'
                : 'All modules connected • Unified data • Single dashboard'}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
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
      {/* AI FOOD MARKETING ENGINE */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="marketing-engine" className="py-24 bg-gray-950 relative overflow-hidden">
        {/* bg grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* ambient glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-rose-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-600/8 rounded-full blur-[100px]" />

        <div className="relative max-w-7xl mx-auto px-4">

          {/* ── Header ── */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-rose-900/50 text-rose-400 border border-rose-700/40 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
              <Zap className="w-3.5 h-3.5" />
              {t('marketingEngineLabel')}
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
              {lang === 'ar'
                ? <>حوّل كل طبق إلى <span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">حملة تسويقية</span></>
                : lang === 'fr'
                ? <>Transformez Chaque Plat en <span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Campagne Marketing</span></>
                : <>Turn Every Dish Into a <span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Marketing Campaign</span></>
              }
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">{t('marketingEngineSub')}</p>
          </div>

          {/* ── Workflow pipeline ── */}
          <div className="relative">
            {/* connector line — desktop only */}
            <div className="hidden lg:block absolute top-[52px] left-[10%] right-[10%] h-px bg-gradient-to-r from-emerald-700/30 via-rose-600/40 to-amber-600/30" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {AI_MARKETING_STEPS.map((s, i) => {
                const Icon = s.Icon
                return (
                  <div key={i} className={`relative group bg-gray-900/80 border ${s.clr.border} rounded-2xl p-5 hover:bg-gray-900 hover:scale-[1.02] transition-all duration-200`}>
                    {/* step badge + icon */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 ${s.clr.bg} ring-1 ${s.clr.ring} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-5 h-5 ${s.clr.text}`} />
                      </div>
                      <span className={`text-xs font-extrabold uppercase tracking-widest ${s.clr.num}`}>{s.step}</span>
                    </div>

                    {/* title */}
                    <h3 className={`font-extrabold text-white text-sm mb-3 leading-snug ${isRtl ? 'text-right' : ''}`}>
                      {s.title[lang]}
                    </h3>

                    {/* items */}
                    <ul className={`space-y-1.5 ${isRtl ? 'text-right' : ''}`}>
                      {s.items[lang].map(item => (
                        <li key={item} className={`flex items-center gap-2 text-[11px] text-gray-400 leading-tight ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <span className={`w-1 h-1 rounded-full ${s.clr.dot} shrink-0`} />
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/* connector arrow — between cards on large screens */}
                    {i < AI_MARKETING_STEPS.length - 1 && (
                      <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Output format showcase ── */}
          <div className="mt-10">
            <p className={`text-center text-xs font-bold uppercase tracking-widest text-gray-500 mb-5`}>
              {lang === 'ar' ? 'تنسيقات المحتوى المُولَّدة تلقائياً'
                : lang === 'fr' ? 'Formats de contenu générés automatiquement'
                : 'Content formats generated automatically'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {OUTPUT_FORMATS.map(fmt => {
                const FmtIcon = fmt.icon
                const is916 = fmt.ratio === '9:16'
                return (
                  <div key={fmt.label}
                    className={`group bg-gradient-to-br ${fmt.color} border ${fmt.border} rounded-2xl p-4 flex flex-col items-center gap-3 hover:scale-[1.03] transition-all cursor-default`}>
                    {/* format preview box */}
                    <div className={`${is916 ? 'w-10 h-16' : fmt.ratio === '1:1' ? 'w-12 h-12' : 'w-16 h-10'} bg-black/30 rounded-lg border border-white/10 flex items-center justify-center`}>
                      <FmtIcon className={`${is916 ? 'w-4 h-4' : 'w-5 h-5'} ${fmt.iconColor}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-white text-xs font-bold leading-tight">{fmt.label}</p>
                      <span className="text-gray-500 text-[9px] font-mono">{fmt.ratio}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Result callout ── */}
          <div className="mt-14 relative overflow-hidden rounded-3xl">
            {/* layered bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-950/80 via-gray-900/90 to-amber-950/60" />
            <div className="absolute inset-0 opacity-[0.06]"
              style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-rose-500/20 blur-[60px]" />

            <div className={`relative px-8 py-10 text-center ${isRtl ? 'text-right' : ''}`}>
              {/* zero-cost stat */}
              <div className="flex items-center justify-center gap-6 mb-5 flex-wrap">
                {(['0', '0', '0'] as const).map((n, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-5xl font-black text-white leading-none">{n}</span>
                    <span className="text-gray-400 text-xs font-semibold mt-1">
                      {i === 0
                        ? (lang === 'ar' ? 'مصمم' : lang === 'fr' ? 'Designer' : 'Designers')
                        : i === 1
                        ? (lang === 'ar' ? 'مصوّر' : lang === 'fr' ? 'Vidéaste' : 'Videographers')
                        : (lang === 'ar' ? 'مدير سوشيال' : lang === 'fr' ? 'Community Mgr' : 'Social Mgr')}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-white text-xl sm:text-2xl font-extrabold mb-3 max-w-2xl mx-auto leading-snug">
                {t('marketingEngineResultTitle')}
              </p>
              <p className="text-gray-400 text-base max-w-2xl mx-auto leading-relaxed mb-7">
                {t('marketingEngineResult')}
              </p>

              <Link href="/signup"
                className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-400 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-rose-900/40 transition-all text-sm">
                {t('marketingEngineCta')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
                    <div className="space-y-2 mb-3">
                      {m.pricing.map((p, pi) => (
                        <div key={pi} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{tl(p, lang)}</span>
                          <span className="font-bold text-emerald-600 text-xs">{p.fee}</span>
                        </div>
                      ))}
                    </div>
                    {'note' in m && m.note && (
                      <p className="text-[10px] text-blue-600 font-semibold bg-blue-50 rounded-lg px-2 py-1 mb-3">
                        {(m.note as Record<string, string>)[lang] ?? (m.note as Record<string, string>).en}
                      </p>
                    )}
                    {'premium' in m && m.premium && (
                      <div className="mt-3 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">💎 Premium</span>
                          <p className="text-white font-bold text-lg mt-0.5">{(m.premium as { price: string; currency: string; label: string }).label}</p>
                          <p className="text-gray-400 text-xs">Pas de commission · Toutes les fonctionnalités</p>
                        </div>
                      </div>
                    )}
                    <Link href="/signup" className="block text-center bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">
                      {lang === 'ar' ? `ابدأ في ${d.country}` : lang === 'fr' ? `Démarrer en ${d.country}` : `Start in ${d.country}`}
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
            {lang === 'ar' ? 'شغّل نظام مطعمك — بدون بطاقة بنكية'
              : lang === 'fr' ? 'Lancez votre OS restaurant — sans carte bancaire'
              : 'Launch your restaurant OS — no credit card required'}
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            {t('finalTitle')}<br />
            <span className="text-emerald-400">
              {lang === 'ar' ? 'ابدأ بإيميلك فقط' : lang === 'fr' ? 'Démarrez avec votre Email' : 'Start With Your Email'}
            </span>
          </h2>

          <p className="text-gray-400 mb-10 text-lg">
            {lang === 'ar' ? 'أدخل إيميلك وشغّل نظام مطعمك فوراً — طلبات، مطبخ، موظفين، تسويق وحسابات في مكان واحد.'
              : lang === 'fr' ? "Entrez votre email et lancez votre OS restaurant instantanément — commandes, cuisine, staff, marketing et finances au même endroit."
              : 'Enter your email and launch your full restaurant OS instantly — orders, kitchen, staff, marketing and finances in one place.'}
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
              { icon: MapPin, label: lang === 'ar' ? 'العنوان' : lang === 'fr' ? 'Adresse' : 'Address', value: lang === 'ar' ? 'حي محمدي 231، الدار البيضاء' : lang === 'fr' ? 'Hay Mohamedi 231, Casablanca' : 'Hay Mohamedi 231, Casablanca', sub: 'Casablanca, Morocco 🇲🇦', color: 'text-amber-600', bg: 'bg-amber-50' },
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
                <Image src={logoImageUrl} alt={footerBrand} width={36} height={36} className="rounded-xl object-contain" unoptimized={!logoImageUrl.startsWith('/') || logoImageUrl.startsWith('/uploads/')} />
                <span className="text-white font-extrabold text-lg">{footerBrand}</span>
              </div>
              <p className="text-sm leading-relaxed mb-4">{t('madeWith')}</p>
              <div className={`flex gap-2 flex-wrap ${isRtl ? 'justify-end' : ''}`}>
                {footerFlags.map(f => <span key={f} className="text-lg">{f}</span>)}
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
                  ? ['الوحدات', 'الأسعار', 'لوحة التحكم', 'شاشة المطبخ KDS', 'تحليلات الإيرادات']
                  : lang === 'fr'
                  ? ['Modules', 'Tarifs', 'Dashboard', 'Écran Cuisine', 'Analytics IA']
                  : ['Modules', 'Pricing', 'Dashboard', 'Kitchen Screen', 'AI Analytics']
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
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Phone className="w-4 h-4 text-emerald-500 shrink-0" /> {footerPhone}</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Mail className="w-4 h-4 text-emerald-500 shrink-0" /> {footerEmail}</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><MessageCircle className="w-4 h-4 text-green-500 shrink-0" /> WhatsApp</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Globe2 className="w-4 h-4 text-blue-500 shrink-0" /> AR · FR · EN</li>
              </ul>
            </div>
          </div>

          <div className={`border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
            <span>{footerCopy} — {t('allRights')}</span>
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
