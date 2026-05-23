'use client'

import { useEffect, useState } from 'react'
import { Wifi, X, Copy, Check } from 'lucide-react'

interface Props {
  ssid: string
  password: string
  onClose: () => void
}

// Standard WiFi QR Code URI format — supported natively by iOS 11+, Android 10+
function buildWifiUri(ssid: string, password: string): string {
  // Escape special chars per the WPA/WEP QR spec
  const esc = (s: string) => s.replace(/([\\";,])/g, '\\$1')
  return `WIFI:S:${esc(ssid)};T:WPA;P:${esc(password)};;`
}

export default function SmartWifiCard({ ssid, password, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const wifiUri = buildWifiUri(ssid, password)

  // Generate QR code client-side using the qrcode package (already installed)
  useEffect(() => {
    let cancelled = false
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(wifiUri, {
        width: 220,
        margin: 1,
        color: { dark: '#065f46', light: '#f0fdf4' }
      }).then(url => {
        if (!cancelled) setQrDataUrl(url)
      })
    })
    return () => { cancelled = true }
  }, [wifiUri])

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable (http or blocked)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Wifi className="w-5 h-5" />
          <span className="font-bold text-sm">WiFi ذكي — اتصل مجاناً</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 text-center space-y-4">
        <p className="text-sm text-gray-500">
          امسح رمز QR للاتصال التلقائي بشبكة الواي فاي
        </p>

        {/* QR Code */}
        <div className="flex justify-center">
          {qrDataUrl
            ? <img
                src={qrDataUrl}
                alt={`WiFi QR: ${ssid}`}
                width={220}
                height={220}
                className="rounded-xl border border-emerald-100"
              />
            : <div className="w-[220px] h-[220px] rounded-xl bg-emerald-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
          }
        </div>

        {/* Network name */}
        <div className="bg-gray-50 rounded-xl px-4 py-2 text-sm">
          <span className="text-gray-500">الشبكة: </span>
          <strong className="text-gray-800">{ssid}</strong>
        </div>

        {/* Copy password button */}
        <button
          onClick={copyPassword}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {copied
            ? <><Check className="w-4 h-4 text-emerald-600" /> تم النسخ</>
            : <><Copy className="w-4 h-4" /> نسخ كلمة المرور</>
          }
        </button>

        {/* Deep-link fallback for Android/iOS */}
        <a
          href={wifiUri}
          className="block bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
        >
          اتصل تلقائياً
        </a>
      </div>
    </div>
  )
}
