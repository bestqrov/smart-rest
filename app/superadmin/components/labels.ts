// Arabic display labels for raw status codes shown in the superadmin console.
// Colors stay with the components; this only maps code → label.

export const AR_LOCALE = 'ar-u-nu-latn' // Arabic text, Latin digits (consistent with the rest of the console)

export const STATUS_LABELS: Record<string, string> = {
  // Cafe billing status
  GRACE_PERIOD:    'فترة تجريبية',
  COLLECTING_DEBT: 'نشط',
  SUSPENDED:       'موقوف',
  PAST_DUE:        'متأخر السداد',
  ACTIVE:          'نشط',
  TRIAL:           'تجريبي',
  TRIALING:        'تجريبي',
  CANCELLED:       'ملغى',
  CANCELED:        'ملغى',
  EXPIRED:         'منتهٍ',
  // Password-reset requests
  PENDING:         'قيد الانتظار',
  SENT:            'أُرسل',
  APPROVED:        'تمت الموافقة',
  REJECTED:        'مرفوض',
  DONE:            'مكتمل',
  // Tiers
  ECONOMY:         'اقتصادي',
  ADVANCED:        'متقدم',
}

export function statusLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return STATUS_LABELS[code] ?? code
}
