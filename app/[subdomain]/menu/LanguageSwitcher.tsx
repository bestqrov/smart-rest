"use client"

import React from 'react'
import useTranslation, { Lang } from '../../../src/hooks/useTranslation'

export default function LanguageSwitcher() {
  const { lang, setLang } = useTranslation()

  const options: { key: Lang; label: string }[] = [
    { key: 'en', label: 'EN' },
    { key: 'fr', label: 'FR' },
    { key: 'ar', label: 'AR' }
  ]

  return (
    <div className="flex items-center gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => setLang(o.key)}
          className={`px-2 py-1 rounded text-sm ${lang === o.key ? 'bg-gray-900 text-white' : 'bg-transparent text-gray-700'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
