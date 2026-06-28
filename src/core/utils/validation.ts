import type { Result } from '../types'

export function required(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return `${field} is required`
  }
  return null
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isUrl(value: string): boolean {
  try { new URL(value); return true } catch { return false }
}

export function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

export function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

export function maxLength(value: string, max: number, field: string): string | null {
  if (value.length > max) return `${field} must be ≤ ${max} characters`
  return null
}

/**
 * Collect validation errors and return a Result.
 * Usage: validate([ required(name, 'name'), maxLength(name, 100, 'name') ])
 */
export function validate(checks: (string | null)[]): Result<true> {
  const errors = checks.filter((e): e is string => e !== null)
  if (errors.length) return { ok: false, error: errors.join('; '), code: 'VALIDATION' }
  return { ok: true, data: true }
}
