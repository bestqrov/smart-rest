"use client"

import { useEffect, useState } from 'react'

export type Lang = 'ar' | 'en' | 'fr' | 'es'

function detectBrowserLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  const l = (navigator.language || navigator.languages?.[0] || 'en').toLowerCase()
  if (l.startsWith('ar')) return 'ar'
  if (l.startsWith('fr')) return 'fr'
  if (l.startsWith('es')) return 'es'
  return 'en'
}

export default function useTranslation() {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('sm_lang') : null
    if (saved === 'ar' || saved === 'en' || saved === 'fr' || saved === 'es') {
      setLangState(saved)
    } else {
      setLangState(detectBrowserLang())
    }
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    if (typeof window !== 'undefined') window.localStorage.setItem('sm_lang', l)
  }

  function tCategory(cat: any): string {
    if (!cat) return ''
    if (lang === 'ar') return cat.nameAr ?? cat.name ?? cat.nameEn ?? ''
    if (lang === 'fr') return cat.nameFr ?? cat.name ?? cat.nameEn ?? ''
    if (lang === 'es') return cat.nameEs ?? cat.nameEn ?? cat.name ?? ''
    return cat.nameEn ?? cat.name ?? cat.nameAr ?? ''
  }

  function tProduct(p: any): string {
    if (!p) return ''
    if (lang === 'ar') return p.nameAr ?? p.name ?? p.nameEn ?? ''
    if (lang === 'fr') return p.nameFr ?? p.name ?? p.nameEn ?? ''
    if (lang === 'es') return p.nameEs ?? p.nameEn ?? p.name ?? ''
    return p.nameEn ?? p.name ?? p.nameAr ?? ''
  }

  return { lang, setLang, tCategory, tProduct }
}
