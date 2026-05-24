'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type AdminLang = 'ar' | 'en' | 'fr' | 'es'

const STORAGE_KEY = 'sm_admin_lang'

interface LangCtx {
  lang:    AdminLang
  setLang: (l: AdminLang) => void
  isRTL:   boolean
}

const LangContext = createContext<LangCtx>({ lang: 'ar', setLang: () => {}, isRTL: true })

export function AdminLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AdminLang>('ar')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as AdminLang | null
    if (saved && ['ar', 'en', 'fr', 'es'].includes(saved)) setLangState(saved)
  }, [])

  function setLang(l: AdminLang) {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang, isRTL: lang === 'ar' }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
