'use client'

/**
 * CertifiedBadge — displayed on the public QR menu when the restaurant
 * has certificationStatus === "certified".
 *
 * Uses a CSS keyframe animation (no external deps) for the neon glow effect.
 * The badge is purely decorative — it only renders when `certified` is true.
 */

interface Props {
  certified: boolean
  lang?:     'ar' | 'fr' | 'en'
}

const LABELS = {
  ar: { badge: 'مُعتمد Smart Resto', sub: 'خدمة رقمية راقية وسريعة' },
  fr: { badge: 'Smart Resto Certifié', sub: 'Service digital premium & rapide' },
  en: { badge: 'Smart Resto Certified', sub: 'Premium digital dining experience' },
}

export default function CertifiedBadge({ certified, lang = 'fr' }: Props) {
  if (!certified) return null

  const { badge, sub } = LABELS[lang] ?? LABELS.fr

  return (
    <>
      {/* Inject neon keyframe once into the document head via a style tag */}
      <style>{`
        @keyframes neon-pulse {
          0%, 100% {
            box-shadow:
              0 0 4px  #10b981,
              0 0 10px #10b981,
              0 0 20px #10b981,
              0 0 40px #059669;
          }
          50% {
            box-shadow:
              0 0 6px  #34d399,
              0 0 16px #34d399,
              0 0 30px #10b981,
              0 0 60px #059669;
          }
        }
        @keyframes neon-text {
          0%, 100% { text-shadow: 0 0 6px #6ee7b7, 0 0 14px #10b981; }
          50%       { text-shadow: 0 0 10px #a7f3d0, 0 0 22px #34d399; }
        }
        .neon-badge       { animation: neon-pulse 2.4s ease-in-out infinite; }
        .neon-badge-text  { animation: neon-text  2.4s ease-in-out infinite; }
      `}</style>

      <div
        className="neon-badge mx-auto my-3 flex w-fit items-center gap-2.5 rounded-full border border-emerald-400/60 bg-gray-900 px-4 py-2"
      >
        {/* Award star */}
        <span className="text-lg leading-none">⭐</span>

        {/* Text */}
        <div className={lang === 'ar' ? 'text-right' : ''}>
          <p className="neon-badge-text text-xs font-extrabold uppercase tracking-widest text-emerald-300">
            {badge}
          </p>
          <p className="text-[10px] text-emerald-500/80">{sub}</p>
        </div>
      </div>
    </>
  )
}
