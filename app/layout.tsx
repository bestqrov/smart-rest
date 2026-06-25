import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SmartRestau',
  description: 'نظام تشغيل المطاعم الذكي — إدارة شاملة بالذكاء الاصطناعي',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SmartRestau',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <head>
        {/* Standard PWA tag — replaces deprecated apple-mobile-web-app-capable */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#059669" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" type="image/png" href="/assets/logo.png" />
        <link rel="apple-touch-icon" href="/assets/logo.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
