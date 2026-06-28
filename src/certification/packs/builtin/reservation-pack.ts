import { scoreBoolean } from '../../scoring/ScoringEngine'
import type { RulePack, EvidenceInput } from '../../types'

export const RESERVATION_PACK: RulePack = {
  id:          'reservation-pack',
  name:        'Reservation Pack',
  description: 'Reservation system activity rules.',
  version:     '1.0',
  enabled:     true,
  dependencies: [],
  tags:        ['reservations', 'bookings'],

  rules: [
    {
      id:             'RESERVATIONS_ACTIVE',
      category:       'FEATURES',
      title:          'Reservations Active',
      description:    'At least one reservation must have been made in the last 30 days.',
      weight:         8,
      required:       false,
      enabled:        true,
      evaluationType: 'BOOLEAN',
    },
  ],

  evaluators: {
    RESERVATIONS_ACTIVE: async (_rule, data): Promise<EvidenceInput> =>
      scoreBoolean((data.reservationCount30d as number) > 0, true),
  },
}
