import type { OrderStatus } from '../types'

// ─── Valid status transitions ─────────────────────────────────────────────────
// DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED
// APPROVED → FULFILLED
// DRAFT | SUBMITTED | UNDER_REVIEW → CANCELLED

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT:        ['SUBMITTED', 'CANCELLED'],
  SUBMITTED:    ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED:     ['FULFILLED'],
  REJECTED:     [],
  CANCELLED:    [],
  FULFILLED:    [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid order transition: ${from} → ${to}`)
  }
}

export function isFinalStatus(status: OrderStatus): boolean {
  return ['APPROVED', 'REJECTED', 'CANCELLED', 'FULFILLED'].includes(status)
}

export function isEditableStatus(status: OrderStatus): boolean {
  return status === 'DRAFT'
}

export function requiresApproval(status: OrderStatus): boolean {
  return status === 'UNDER_REVIEW'
}
