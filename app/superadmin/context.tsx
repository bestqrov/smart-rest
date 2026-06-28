'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SAAuthState {
  email:  string
  secret: string
  authed: boolean
  login:  (email: string, secret: string) => void
  logout: () => void
  header: () => Record<string, string>
}

const SAAuthCtx = createContext<SAAuthState | null>(null)

export function SAAuthProvider({ children }: { children: ReactNode }) {
  const [email,  setEmail]  = useState('')
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const e = sessionStorage.getItem('sa_email')  ?? ''
    const s = sessionStorage.getItem('sa_secret') ?? ''
    if (e && s) { setEmail(e); setSecret(s); setAuthed(true) }
  }, [])

  function login(e: string, s: string) {
    setEmail(e); setSecret(s); setAuthed(true)
    sessionStorage.setItem('sa_email',  e)
    sessionStorage.setItem('sa_secret', s)
  }

  function logout() {
    setEmail(''); setSecret(''); setAuthed(false)
    sessionStorage.removeItem('sa_email')
    sessionStorage.removeItem('sa_secret')
  }

  function header(): Record<string, string> {
    return {
      'x-superadmin-secret': secret,
      'x-superadmin-email':  email,
      'Content-Type':        'application/json',
    }
  }

  return (
    <SAAuthCtx.Provider value={{ email, secret, authed, login, logout, header }}>
      {children}
    </SAAuthCtx.Provider>
  )
}

export function useSAAuth(): SAAuthState {
  const ctx = useContext(SAAuthCtx)
  if (!ctx) throw new Error('useSAAuth must be used inside SAAuthProvider')
  return ctx
}
