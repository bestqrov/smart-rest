'use client'
import type { Theme } from './types'

interface Props {
  current: Theme
  onChange: (t: Theme) => void
}

const THEMES: { id: Theme; label: string; title: string }[] = [
  { id: 'A', label: 'A', title: 'Dark Premium' },
  { id: 'B', label: 'B', title: 'Glass Sidebar' },
  { id: 'C', label: 'C', title: 'Minimal Pro' },
]

export default function ThemeSwitcher({ current, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-800 rounded-xl p-0.5" title="Switch theme">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          title={t.title}
          className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
            current === t.id
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
