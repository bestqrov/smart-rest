// ─── Billing Platform — VAT Provider ──────────────────────────────────────

const VAT_RATES: Record<string, number> = {
  MA: 20,
  SA: 15,
  AE: 5,
  SN: 18,
  FR: 20,
  DE: 19,
  GB: 20,
  DEFAULT: 0,
}

export function getVATRate(country: string): number {
  return VAT_RATES[country.toUpperCase()] ?? VAT_RATES.DEFAULT
}

export function calculateVAT(subtotal: number, country: string): {
  taxRate: number; taxAmount: number; total: number
} {
  const taxRate   = getVATRate(country)
  const taxAmount = +(subtotal * taxRate / 100).toFixed(2)
  return { taxRate, taxAmount, total: +(subtotal + taxAmount).toFixed(2) }
}
