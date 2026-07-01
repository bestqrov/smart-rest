// ─── Reservation Management (K15) ──────────────────────────────────────────
// Create/Confirm/Cancel already exist and work in routes/reservations.ts —
// reused as-is, not duplicated here. This adds what was missing: editing an
// existing reservation, check-in / no-show states, and table-conflict
// detection (both used when a reservation is assigned/reassigned a table).

import prisma from '../prisma'
import { publishStandardEvent } from '../core'

// Existing Reservation.status values (String field, no schema enum) were
// PENDING | ACCEPTED | COMPLETED | CANCELLED — CHECKED_IN and NO_SHOW are new.
const CONFLICT_WINDOW_MINUTES = 90

export interface UpdateReservationInput {
  name?:        string
  phone?:       string
  guests?:      number
  date?:        Date
  notes?:       string
  tableNumber?: number
}

async function getReservationOrThrow(id: string, cafeId: string) {
  const reservation = await prisma.reservation.findFirst({ where: { id, cafeId } })
  if (!reservation) throw new Error(`Reservation ${id} not found for cafe ${cafeId}`)
  return reservation
}

// ─── Conflict detection ─────────────────────────────────────────────────────
// True if another live (ACCEPTED/CHECKED_IN) reservation holds the same
// table within CONFLICT_WINDOW_MINUTES of the requested date.
export async function hasTableConflict(
  cafeId:               string,
  tableNumber:          number,
  date:                 Date,
  excludeReservationId?: string,
): Promise<boolean> {
  const windowMs = CONFLICT_WINDOW_MINUTES * 60 * 1000
  const count = await prisma.reservation.count({
    where: {
      cafeId,
      tableNumber,
      status: { in: ['ACCEPTED', 'CHECKED_IN'] },
      date:   { gte: new Date(date.getTime() - windowMs), lte: new Date(date.getTime() + windowMs) },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
  })
  return count > 0
}

// ─── Update ───────────────────────────────────────────────────────────────
export async function updateReservation(id: string, cafeId: string, patch: UpdateReservationInput) {
  const reservation = await getReservationOrThrow(id, cafeId)
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(reservation.status)) {
    throw new Error(`Cannot update a reservation with status ${reservation.status}`)
  }

  const tableNumber = patch.tableNumber ?? reservation.tableNumber ?? undefined
  const date         = patch.date ?? reservation.date
  if (tableNumber != null && await hasTableConflict(cafeId, tableNumber, date, id)) {
    throw new Error(`Table ${tableNumber} is already booked around that time`)
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      ...(patch.name        !== undefined ? { name: patch.name }               : {}),
      ...(patch.phone       !== undefined ? { phone: patch.phone }             : {}),
      ...(patch.guests      !== undefined ? { guests: patch.guests }           : {}),
      ...(patch.date        !== undefined ? { date: patch.date }               : {}),
      ...(patch.notes       !== undefined ? { notes: patch.notes }             : {}),
      ...(patch.tableNumber !== undefined ? { tableNumber: patch.tableNumber } : {}),
    },
  })

  publishStandardEvent('ReservationUpdated', {
    tenantId: cafeId, resourceId: id, metadata: { patch },
  }, 'reservations')

  return updated
}

// ─── Check-in ─────────────────────────────────────────────────────────────
export async function checkInReservation(id: string, cafeId: string) {
  const reservation = await getReservationOrThrow(id, cafeId)
  if (reservation.status !== 'ACCEPTED') {
    throw new Error(`Cannot check in a reservation with status ${reservation.status}`)
  }

  const updated = await prisma.reservation.update({ where: { id }, data: { status: 'CHECKED_IN' } })

  publishStandardEvent('ReservationCheckedIn', {
    tenantId: cafeId, resourceId: id, metadata: { tableNumber: reservation.tableNumber },
  }, 'reservations')

  return updated
}

// ─── No-show ────────────────────────────────────────────────────────────────
export async function markNoShow(id: string, cafeId: string) {
  const reservation = await getReservationOrThrow(id, cafeId)
  if (!['PENDING', 'ACCEPTED'].includes(reservation.status)) {
    throw new Error(`Cannot mark no-show for a reservation with status ${reservation.status}`)
  }

  const updated = await prisma.reservation.update({ where: { id }, data: { status: 'NO_SHOW' } })

  publishStandardEvent('ReservationNoShow', {
    tenantId: cafeId, resourceId: id, metadata: { tableNumber: reservation.tableNumber },
  }, 'reservations')

  return updated
}
