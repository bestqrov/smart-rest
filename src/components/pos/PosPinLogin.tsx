'use client'

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react'

interface DemoStaffEntry { id: string; name: string; role: string }

interface Props {
  cafeName: string
  cafeLogoUrl?: string | null
  loadingCafe?: boolean
  icon: ReactNode // shown when there's no logo
  subtitle: string
  subdomain: string
  setSubdomain: (v: string) => void
  pin: string
  setPin: Dispatch<SetStateAction<string>>
  loginErr: string
  logging: boolean
  isDemoMode: boolean
  demoStaff: DemoStaffEntry[]
  demoLabel: string
  onDemoLogin: (staffId: string) => void
  onSubmit: (e: React.FormEvent) => void
  langSwitcher?: ReactNode
}

// PIN-entry login screen shared by /pos and /comptoir. Both are staff-facing
// touchscreen terminals, so this uses a numeric keypad (thumb-friendly) rather
// than a text input that pops the system keyboard.
export default function PosPinLogin(props: Props) {
  const {
    cafeName, cafeLogoUrl, loadingCafe, icon, subtitle,
    subdomain, setSubdomain, pin, setPin, loginErr, logging,
    isDemoMode, demoStaff, demoLabel, onDemoLogin, onSubmit, langSwitcher,
  } = props

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {langSwitcher && <div className="absolute top-4 right-4 flex gap-1.5">{langSwitcher}</div>}
      {cafeLogoUrl && (
        <div className="absolute inset-0 bg-center bg-no-repeat bg-contain opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: `url(${cafeLogoUrl})` }} />
      )}
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6">
          {loadingCafe ? (
            <div className="w-20 h-20 rounded-2xl bg-gray-800 animate-pulse mx-auto mb-3" />
          ) : cafeLogoUrl ? (
            <img src={cafeLogoUrl} alt={cafeName} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-xl" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3 text-4xl shadow-xl">{icon}</div>
          )}
          <h1 className="text-2xl font-extrabold text-white">{cafeName}</h1>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
          {subdomain && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-gray-800 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-400">{subdomain}</span>
              <button onClick={() => setSubdomain('')} className="text-gray-600 hover:text-gray-400 text-xs ml-1">×</button>
            </div>
          )}
        </div>

        {isDemoMode ? (
          <div className="space-y-3">
            <p className="text-center text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-1">{demoLabel}</p>
            {demoStaff.map(s => (
              <button key={s.id} onClick={() => onDemoLogin(s.id)} disabled={logging}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-emerald-500 rounded-2xl transition-all active:scale-95 disabled:opacity-50">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
                  {s.role === 'CASHIER' ? '💳' : s.role === 'SUPERVISOR' ? '👔' : '🛎️'}
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{s.name}</p>
                  <p className="text-gray-500 text-xs">{s.role}</p>
                </div>
                {logging ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400 ml-auto" /> : (
                  <ChevronLeft className="w-4 h-4 text-gray-600 ml-auto rotate-180" />
                )}
              </button>
            ))}
            {loginErr && (
              <div className="flex items-center gap-2 bg-red-950/60 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {loginErr}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {!subdomain && (
              <input type="text" value={subdomain} onChange={e => setSubdomain(e.target.value)}
                placeholder="Cafe subdomain" required
                className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 text-white rounded-2xl text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            )}

            {/* PIN display */}
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-5 h-5 rounded-full transition-all ${pin.length > i ? 'bg-emerald-500 scale-110' : 'bg-gray-700'}`} />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
                <button key={i} type="button"
                  onClick={() => {
                    if (k === '⌫') setPin(p => p.slice(0, -1))
                    else if (k && pin.length < 8) setPin(p => p + k)
                  }}
                  className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
                    k === '' ? 'invisible' :
                    k === '⌫' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' :
                    'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {loginErr && (
              <div className="flex items-center gap-2 bg-red-950/60 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {loginErr}
              </div>
            )}

            <button type="submit" disabled={logging || !subdomain || pin.length < 4}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-lg rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-900/40">
              {logging ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'LOGIN'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
