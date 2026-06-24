'use client'

/**
 * FlashSignalOverlay
 *
 * Mounted on the customer's menu/order-tracking page.
 * Listens on the zone_session_room socket for two events:
 *   ready_for_service → show fullscreen flash overlay
 *   flash_dismiss     → waiter confirmed delivery, hide overlay
 *
 * The overlay flashes between phosphor-orange and white at 4 Hz using a CSS
 * keyframe animation so the device's GPU handles it — no JS setInterval needed.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { io as socketIO, Socket }                   from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReadyPayload {
  orderId:     string
  tokenNumber: number
  zoneName:    string
}

interface Props {
  activeSessionId: string
  cafeId:          string
}

// ─── Audio: two ascending beeps on arrival ────────────────────────────────────

function playReadyChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx() as AudioContext
    ;[660, 880].forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type            = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.25)
      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime  + i * 0.18 + 0.26)
    })
  } catch (_) { /* silently skip on restricted contexts */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlashSignalOverlay({ activeSessionId, cafeId }: Props) {
  const socketRef = useRef<Socket | null>(null)
  const [flash, setFlash]     = useState<ReadyPayload | null>(null)
  const [visible, setVisible] = useState(false)  // separate so CSS keeps the DOM

  // Dismiss: hide overlay + optionally ping server if needed
  const dismiss = useCallback(() => {
    setVisible(false)
    // Slight delay before removing DOM so fade-out CSS can play
    setTimeout(() => setFlash(null), 400)
  }, [])

  useEffect(() => {
    if (!activeSessionId) return

    const socket = socketIO(SOCKET_URL || window.location.origin, {
      transports: ['polling', 'websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_zone_session_room', { activeSessionId })
    })

    socket.on('ready_for_service', (payload: ReadyPayload) => {
      setFlash(payload)
      setVisible(true)
      playReadyChime()
      // Vibrate the device if supported (mobile UX)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
    })

    socket.on('flash_dismiss', () => {
      dismiss()
    })

    return () => { socket.disconnect() }
  }, [activeSessionId, dismiss])

  if (!flash) return null

  return (
    <>
      {/* ── Keyframe animation injected once ── */}
      <style>{`
        @keyframes flash-bg {
          0%, 49% { background-color: #ff6a00; }
          50%, 100% { background-color: #ffffff; }
        }
        @keyframes flash-text {
          0%, 49% { color: #ffffff; }
          50%, 100% { color: #ff6a00; }
        }
        .flash-overlay {
          animation: flash-bg 0.25s step-end infinite;
        }
        .flash-text {
          animation: flash-text 0.25s step-end infinite;
        }
      `}</style>

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Order ready signal"
        className={`
          flash-overlay
          fixed inset-0 z-[9999]
          flex flex-col items-center justify-center
          px-6 text-center
          transition-opacity duration-400
          ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        {/* Zone + Token badge */}
        <div className="flash-text mb-4 text-sm font-bold uppercase tracking-[0.25em] opacity-80">
          {flash.zoneName}
        </div>

        {/* Token number — huge, impossible to miss */}
        <div className="flash-text mb-2 text-[6rem] font-black leading-none tabular-nums">
          #{flash.tokenNumber}
        </div>

        {/* Main CTA */}
        <p className="flash-text mb-1 text-2xl font-extrabold leading-tight max-w-xs">
          YOUR ORDER IS COMING!
        </p>
        <p className="flash-text mb-10 text-base font-semibold opacity-90 max-w-xs">
          Hold up your phone so the waiter can find you.
        </p>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="
            rounded-full border-4 border-current px-8 py-3
            text-base font-bold uppercase tracking-widest
            flash-text
            active:scale-95 transition-transform
          "
        >
          Dismiss
        </button>
      </div>
    </>
  )
}
