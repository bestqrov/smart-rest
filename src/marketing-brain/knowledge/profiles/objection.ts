import type { ObjectionCategory } from '../../models/Objection'

// ─── Profile shape ─────────────────────────────────────────────────────────────

export type ProofType = 'TESTIMONIAL' | 'STAT' | 'DEMO' | 'GUARANTEE' | 'CASE_STUDY' | 'TRIAL'

export interface ObjectionEnrichment {
  underlyingFear:       string
  emotionalCore:        string
  handlingStrategy:     string
  acknowledgements:     string[]
  reframingTactics:     string[]
  proofTypes:           ProofType[]
  resolutionWindowDays: number
  escalationTrigger:    string
  doNotSay:             string[]
}

// ─── Per-category profiles ────────────────────────────────────────────────────

export const OBJECTION_PROFILES: Record<ObjectionCategory, ObjectionEnrichment> = {

  PRICE: {
    underlyingFear:  'Spending money on something that won\'t deliver enough value to justify the cost',
    emotionalCore:   'I\'m afraid of wasting money that I need to keep the business running.',
    handlingStrategy:
      'Never discount first. Anchor on cost of the problem (not cost of the solution). ' +
      'Reframe the subscription as a daily cost (MAD X/day instead of MAD Y/month). ' +
      'Offer trial — let them experience value before paying.',
    acknowledgements: [
      'واعر عليك المبلغ — نفهمك تماماً.',
      'Je comprends que chaque dirham compte pour votre activité.',
      'Absolutely — making sure it\'s worth it is the right question to ask.',
    ],
    reframingTactics: [
      'Reframe monthly fee as daily cost: "SmartRestau كيكلفك أقل من كأس قهوة في اليوم"',
      'Quantify the cost of the current problem: "كل يوم بدون SmartRestau كتضيع X دقيقة × عدد الموظفين"',
      'ROI framing: "إلا زادتك طلبية واحدة زيادة في اليوم, SmartRestau كيدفع ثمنو"',
      'Compare to alternatives: hiring an extra cashier costs 10× more per month',
      'Trial eliminates risk: "جرب 14 يوم مجاناً — إلا ما عجبكش ما تدفع والو"',
    ],
    proofTypes:           ['STAT', 'TRIAL', 'GUARANTEE', 'CASE_STUDY'],
    resolutionWindowDays: 7,
    escalationTrigger:    'Lead asks for a payment plan or requests a lower tier — qualify and offer options',
    doNotSay: [
      'It\'s cheap / it\'s not expensive (subjective and dismissive)',
      'Compared to competitors we are cheaper (opens competitor discussion)',
      'I can give you a discount (devalues the product immediately)',
    ],
  },

  TRUST: {
    underlyingFear:  'Being deceived by an unknown company or locked into a bad product with no recourse',
    emotionalCore:   'I don\'t know who you are and I\'m not ready to hand you my business data.',
    handlingStrategy:
      'Establish local presence first. Name real clients they can call. ' +
      'Make the commitment reversible (no lock-in, cancel anytime). ' +
      'Human contact — a real person with a name and photo — dramatically accelerates trust.',
    acknowledgements: [
      'منطقي 100٪ تحتاط — من حقك تعرف بشكال شركة كنا.',
      'C\'est tout à fait normal de vérifier avant de faire confiance à un nouveau partenaire.',
    ],
    reframingTactics: [
      'Local proof: name a well-known restaurant in their city that uses SmartRestau',
      'Offer a direct reference call with a current customer in their region',
      'Transparency: share the full team page, HQ address, company registration',
      'Reversibility: "ما كاين حتى عقد — تقدر تصيفط إيلا ما عجبكش"',
      'Free trial requires no credit card — reduces the perceived financial risk',
      'Share press coverage or industry recognition if available',
    ],
    proofTypes:           ['TESTIMONIAL', 'CASE_STUDY', 'GUARANTEE', 'DEMO'],
    resolutionWindowDays: 14,
    escalationTrigger:    'Lead asks to speak with a current customer or requests a site visit',
    doNotSay: [
      'Trust us (literally the worst response to a trust objection)',
      'We are the best in the market (unverifiable claim)',
      'Everyone is using us now (vague and impersonal)',
    ],
  },

  COMPLEXITY: {
    underlyingFear:  'Wasting time and disrupting the team to learn something that might not stick',
    emotionalCore:   'I\'m afraid my staff won\'t use it and I\'ll end up with two systems at once.',
    handlingStrategy:
      'Make setup feel instant, not gradual. Focus on the one thing they do on day one. ' +
      'Reframe complexity as staff adoption (the real concern). ' +
      'Offer white-glove onboarding: "احنا كنديرو ليك كلشي".',
    acknowledgements: [
      'كثير من أصحاب المطاعم قالو نفس الشي في البداية — وهاك شنو صار بعد أسبوع...',
      'Je comprends — changer ses habitudes est toujours une question.',
    ],
    reframingTactics: [
      '"Staff see it as their phone, not a new system" — frame as WhatsApp-level simplicity',
      'Setup demo: show the full menu import taking < 10 minutes on screen',
      '"كنديرو ليك كلشي فـ 30 دقيقة" — white-glove onboarding offer',
      'Staff adoption frame: "طاقم الخدمة كيتعلم كلشي فـ 5 دقيقات بالموبايل"',
      'Point to a restaurant with identical staff profile that uses SmartRestau smoothly',
    ],
    proofTypes:           ['DEMO', 'TRIAL', 'TESTIMONIAL'],
    resolutionWindowDays: 5,
    escalationTrigger:    'Lead has tried and failed to set up during trial — offer hands-on session',
    doNotSay: [
      'It\'s very simple / it\'s intuitive (invalidates their concern)',
      'All our customers found it easy (peer pressure, not reassurance)',
      'Just watch the tutorial video (impersonal and lazy)',
    ],
  },

  TIMING: {
    underlyingFear:  'Starting something new during a difficult or busy period and failing because of poor timing',
    emotionalCore:   'Right now is the worst possible moment — I\'m already overwhelmed.',
    handlingStrategy:
      'Validate the timing concern fully. Then reframe: the busiest periods are exactly when the tool pays for itself. ' +
      'Offer a deferred-start trial: "كنبداو اليوم و نبقاو معاك حتى تكون مستعد".',
    acknowledgements: [
      'صح — رمضان والصيف أوقات صعيبة للتغيير.',
      'C\'est vrai — lancer quelque chose de nouveau en haute saison est risqué.',
    ],
    reframingTactics: [
      '"البيك سيزون هو بالظبط الوقت اللي SmartRestau كيدير الفرق" — busy = high ROI moment',
      'Offer a soft start: menu setup only, orders optional — zero disruption, ready when they are',
      '"دور اليوم ديال هدوء — كنبناو ليك كلشي و كنبداو وقتك نتا" — deferred go-live',
      'Create a "quiet season" window: schedule onboarding 4 weeks out if genuinely off-season',
    ],
    proofTypes:           ['TESTIMONIAL', 'CASE_STUDY', 'TRIAL'],
    resolutionWindowDays: 21,
    escalationTrigger:    'Lead pushes timing past 3 months — qualify whether timing is real or a proxy for another objection',
    doNotSay: [
      'There\'s never a perfect time (dismissive of their real operational concern)',
      'Our other clients started during Ramadan too (not reassuring, proves it is hard)',
    ],
  },

  COMPETITION: {
    underlyingFear:  'Switching costs — time, money, and disruption — outweigh the benefit of moving',
    emotionalCore:   'I already have something that works. Why go through the pain of changing?',
    handlingStrategy:
      'Never attack the competitor. Acknowledge it works for them. ' +
      'Ask what they wish it did better (plant the seed of dissatisfaction gently). ' +
      'Position as a complement, not a replacement, initially.',
    acknowledgements: [
      'زين — و إلا كاين شي حاجة كتبغي تزيدها فيه؟',
      'C\'est bien que vous ayez déjà quelque chose en place.',
    ],
    reframingTactics: [
      'Ask "what\'s the one thing it doesn\'t do that costs you time?" — surface the gap',
      'Migration offer: "كنديرو ليك migration كاملة — ما خصك تدير والو"',
      'Feature gap: if the competitor lacks QR ordering, WhatsApp menu, or kitchen display — demonstrate',
      '"كنبداو معاك side-by-side" — trial running alongside existing system, zero risk',
      'Switching cost reversal: quantify time/cost of staying on the inferior tool',
    ],
    proofTypes:           ['DEMO', 'CASE_STUDY', 'TRIAL'],
    resolutionWindowDays: 30,
    escalationTrigger:    'Lead is on a long-term contract with competitor — note renewal date and set a calendar follow-up',
    doNotSay: [
      'That tool is bad / that tool has problems (competitor bashing backfires)',
      'We are much better than X (unqualified — triggers defensiveness)',
      'Why are you even using that? (disrespects their past decision)',
    ],
  },

  NECESSITY: {
    underlyingFear:  'Spending money on something that sounds nice but isn\'t actually needed right now',
    emotionalCore:   'My current system works fine. I don\'t see what this actually solves for me.',
    handlingStrategy:
      'Do not argue — diagnose first. Use questions to surface the hidden pain. ' +
      'If there is no pain, they are not a qualified lead — acknowledge and exit gracefully. ' +
      'If there IS pain, they have not connected it to the solution yet.',
    acknowledgements: [
      'شنو تعتقد — كتضيع وقت فـ تسيير الطلبات؟',
      'Vous gérez les commandes manuellement en ce moment ?',
    ],
    reframingTactics: [
      'Problem discovery questions: "بشحال واحد كتخدم؟ كيفاش كتديرو الطلبات فـ ساعة الذروة?"',
      'Quantification: help them count their own waste — 3 minutes per order × 80 orders = 4 hours/day',
      'Future pain: "إلا زادو عليك 20 طلبية في اليوم — كيفاش غتتعامل؟"',
      'If truly no fit, exit and ask for a referral: "شكراً بزاف — واش عندك صاحب عندو مطعم؟"',
    ],
    proofTypes:           ['STAT', 'CASE_STUDY', 'DEMO'],
    resolutionWindowDays: 7,
    escalationTrigger:    'After 2 contacts with no pain surface — disqualify and move to referral ask',
    doNotSay: [
      'You definitely need this (assumes their situation without knowing it)',
      'Everyone needs SmartRestau (generic and unconvincing)',
      'You\'ll regret not starting sooner (pressure without substance)',
    ],
  },

  OTHER: {
    underlyingFear:  'An unstated concern that may be personal, financial, or situational',
    emotionalCore:   'Something is stopping me but I\'m not ready to say what it is yet.',
    handlingStrategy:
      'Draw out the real objection with open questions before attempting any reframe. ' +
      '"واش فـ أي شي تشوف المشكلة؟" gets to truth faster than guessing.',
    acknowledgements: [
      'نفهمك — واش تقدر تقولي أكثر علاش متردد؟',
      'Je comprends votre hésitation — qu\'est-ce qui vous retient exactement ?',
    ],
    reframingTactics: [
      'Open question first: "ما شي واضح ليا — شنو هو الشي اللي كيخليك متردد بالضبط؟"',
      'Silence after the question — let them fill it',
      'Reflect back: "إلا فهمت صح، المشكلة هي..." (confirm the real issue)',
      'Once surfaced, route to the relevant category handler above',
    ],
    proofTypes:           ['TESTIMONIAL', 'DEMO', 'TRIAL'],
    resolutionWindowDays: 10,
    escalationTrigger:    'Objection remains vague after 2 direct questions — escalate to a human call',
    doNotSay: [
      'I think I know what you mean (don\'t guess — ask)',
      'Just try it (dismisses the concern rather than resolving it)',
    ],
  },
}
