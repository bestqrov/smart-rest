// ─── Smart Intelligence Notification Advisor — Quiet Hours (K56) ───────────
// Pure hour-of-day check, no scheduling system.

import type { QuietHoursConfig } from './types'

export function isWithinQuietHours(config: QuietHoursConfig | undefined, now: Date = new Date()): boolean {
  if (!config) return false
  const hour = now.getUTCHours()

  if (config.startHour === config.endHour) return false // zero-width window = never quiet

  if (config.startHour < config.endHour) {
    return hour >= config.startHour && hour < config.endHour
  }
  // wraps past midnight, e.g. 22 -> 7
  return hour >= config.startHour || hour < config.endHour
}
