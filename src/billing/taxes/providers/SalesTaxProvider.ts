// ─── Billing Platform — Sales Tax Provider ────────────────────────────────

const SALES_TAX_RATES: Record<string, number> = {
  US_CA: 8.25,
  US_NY: 8.875,
  US_TX: 6.25,
  DEFAULT: 0,
}

export function getSalesTaxRate(state: string): number {
  return SALES_TAX_RATES[state.toUpperCase()] ?? SALES_TAX_RATES.DEFAULT
}

export function calculateSalesTax(subtotal: number, state: string): {
  taxRate: number; taxAmount: number; total: number
} {
  const taxRate   = getSalesTaxRate(state)
  const taxAmount = +(subtotal * taxRate / 100).toFixed(2)
  return { taxRate, taxAmount, total: +(subtotal + taxAmount).toFixed(2) }
}
