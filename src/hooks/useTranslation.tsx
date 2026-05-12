"use client"

import { useEffect, useState } from 'react'

export type Lang = 'ar' | 'en' | 'fr'

function detectBrowserLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  const l = (navigator.language || navigator.languages?.[0] || 'en').toLowerCase()
  if (l.startsWith('ar')) return 'ar'
  if (l.startsWith('fr')) return 'fr'
  return 'en'
}

export default function useTranslation() {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('sm_lang') : null
    if (saved === 'ar' || saved === 'en' || saved === 'fr') {
      setLang(saved)
    } else {
      setLang(detectBrowserLang())
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('sm_lang', lang)
  }, [lang])

  function tCategory(cat: any) {
    if (!cat) return ''
    if (lang === 'ar') return cat.nameAr ?? cat.name ?? cat.nameEn ?? ''
    if (lang === 'fr') return cat.nameFr ?? cat.name ?? cat.nameEn ?? ''
    return cat.nameEn ?? cat.name ?? cat.nameAr ?? ''
  }

  function tProduct(p: any) {
    if (!p) return ''
    if (lang === 'ar') return p.nameAr ?? p.name ?? p.nameEn ?? ''
    if (lang === 'fr') return p.nameFr ?? p.name ?? p.nameEn ?? ''
    return p.nameEn ?? p.name ?? p.nameAr ?? ''
  }

  return { lang, setLang, tCategory, tProduct }
}
