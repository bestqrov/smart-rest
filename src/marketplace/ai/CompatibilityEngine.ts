export type CompatibilityStatus = 'COMPATIBLE' | 'PARTIAL' | 'INCOMPATIBLE'

export interface CompatibilityResult {
  status: CompatibilityStatus
  score: number   // 0–100
  reasons: string[]
}

// product.metadata is a JSON string optionally containing requiredModules and optionalModules arrays
export function checkCompatibility(
  product: { supportedModules: string[]; metadata?: string | null },
  restaurantModules: string[],
): CompatibilityResult {
  let meta: { requiredModules?: string[]; optionalModules?: string[] } = {}
  try { if (product.metadata) meta = JSON.parse(product.metadata) } catch { /* ignore */ }

  const required  = meta.requiredModules ?? []
  const optional  = meta.optionalModules ?? []
  const supported = product.supportedModules ?? []
  const reasons: string[] = []

  // Required modules must all be present
  const missingRequired = required.filter(m => !restaurantModules.includes(m))
  if (missingRequired.length > 0) {
    reasons.push(`وحدات مطلوبة غير موجودة: ${missingRequired.join('، ')}`)
    return { status: 'INCOMPATIBLE', score: 0, reasons }
  }

  // ALL = compatible with every module
  if (supported.includes('ALL') || supported.length === 0) {
    reasons.push('متوافق مع جميع الوحدات')
    return { status: 'COMPATIBLE', score: 100, reasons }
  }

  const hasSupported = supported.some(m => restaurantModules.includes(m) || m === 'RESTAURANT')
  if (!hasSupported) {
    reasons.push('هذا المنتج غير مصمم لنوع مطعمك')
    return { status: 'INCOMPATIBLE', score: 10, reasons }
  }

  // Optional modules raise score when present
  const presentOptional = optional.filter(m => restaurantModules.includes(m))
  if (optional.length > 0 && presentOptional.length < optional.length) {
    const missing = optional.filter(m => !restaurantModules.includes(m))
    reasons.push(`وحدات اختيارية غير موجودة: ${missing.join('، ')}`)
    const optScore = (presentOptional.length / optional.length) * 30
    return { status: 'PARTIAL', score: Math.round(70 + optScore), reasons }
  }

  reasons.push('متوافق تماماً مع إعدادك الحالي')
  return { status: 'COMPATIBLE', score: 100, reasons }
}

export function compatibilityLabel(status: CompatibilityStatus): string {
  const map: Record<CompatibilityStatus, string> = {
    COMPATIBLE:   'متوافق',
    PARTIAL:      'متوافق جزئياً',
    INCOMPATIBLE: 'غير متوافق',
  }
  return map[status]
}

export function compatibilityColor(status: CompatibilityStatus): string {
  const map: Record<CompatibilityStatus, string> = {
    COMPATIBLE:   'text-emerald-600 bg-emerald-50',
    PARTIAL:      'text-amber-600 bg-amber-50',
    INCOMPATIBLE: 'text-red-600 bg-red-50',
  }
  return map[status]
}
