"use client"

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import NProgress from 'nprogress'

NProgress.configure({ showSpinner: false, trickleSpeed: 200 })

export default function NProgressProvider() {
  const pathname = usePathname()

  useEffect(() => {
    // start on path change
    NProgress.start()
    const t = setTimeout(() => NProgress.done(), 800)
    return () => {
      clearTimeout(t)
      NProgress.done()
    }
  }, [pathname])

  return null
}
