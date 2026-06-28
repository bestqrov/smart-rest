import type { Period, PeriodType } from '../types'

// ─── Period resolution ────────────────────────────────────────────────────────

export function resolvePeriod(
  type:         PeriodType,
  customStart?: Date,
  customEnd?:   Date,
): Period {
  const now   = new Date()
  const today = startOfDay(now)
  const eod   = endOfDay(now)

  switch (type) {
    case 'today':
      return { type, start: today, end: eod }

    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      return { type, start: y, end: endOfDay(y) }
    }

    case '7d': {
      const s = new Date(today); s.setDate(s.getDate() - 7)
      return { type, start: s, end: eod }
    }

    case '30d': {
      const s = new Date(today); s.setDate(s.getDate() - 30)
      return { type, start: s, end: eod }
    }

    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { type, start: s, end: e }
    }

    case 'year': {
      const s = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      const e = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      return { type, start: s, end: e }
    }

    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('resolvePeriod: customStart and customEnd are required for custom period')
      }
      return { type, start: customStart, end: customEnd }

    default:
      throw new Error(`resolvePeriod: unknown period type "${type}"`)
  }
}

// ─── Previous period (for TREND calculation) ──────────────────────────────────

export function previousPeriod(period: Period): Period {
  const durationMs = period.end.getTime() - period.start.getTime()

  const prevEnd   = new Date(period.start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - durationMs)

  return { type: 'custom', start: prevStart, end: prevEnd }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
