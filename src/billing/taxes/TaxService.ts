// ─── Billing Platform — Tax Service ──────────────────────────────────────

import { calculateVAT }       from './providers/VATProvider'
import { calculateSalesTax }  from './providers/SalesTaxProvider'
import type { TaxCalculation, TaxType } from '../types'

export function calculateTax(
  subtotal: number,
  currency: string,
  country:  string,
  taxType:  TaxType = 'VAT',
): TaxCalculation {
  if (taxType === 'NONE') {
    return { subtotal, taxType: 'NONE', taxRate: 0, taxAmount: 0, total: subtotal, currency }
  }

  if (taxType === 'SALES_TAX') {
    const { taxRate, taxAmount, total } = calculateSalesTax(subtotal, country)
    return { subtotal, taxType, taxRate, taxAmount, total, currency }
  }

  const { taxRate, taxAmount, total } = calculateVAT(subtotal, country)
  return { subtotal, taxType: 'VAT', taxRate, taxAmount, total, currency }
}

export function detectTaxType(country: string): TaxType {
  const US_STATES = ['US_CA', 'US_NY', 'US_TX']
  if (US_STATES.includes(country)) return 'SALES_TAX'
  return 'VAT'
}
