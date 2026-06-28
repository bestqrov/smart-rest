export function startOfDay(d: Date = new Date()): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export function endOfDay(d: Date = new Date()): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

export function isExpired(d: Date): boolean {
  return d.getTime() < Date.now()
}

export function isoNow(): string {
  return new Date().toISOString()
}

export function msUntil(d: Date): number {
  return d.getTime() - Date.now()
}
