// ─── Staff & CashierShift domain types ───────────────────────────────────────

export type StaffRole   = 'CASHIER' | 'WAITER' | 'SUPERVISOR'
export type ShiftStatus = 'OPEN' | 'CLOSED'

export interface Staff {
  id:        string
  cafeId:    string
  name:      string
  role:      StaffRole
  /**
   * 4-digit PIN — NEVER returned to the client after creation.
   * Stored as a bcrypt hash in the database.
   */
  pinCode:   string
  isActive:  boolean
  createdAt: Date
}

/** Shape returned to the client (PIN excluded) */
export type StaffPublic = Omit<Staff, 'pinCode'>

export interface CashierShift {
  id:      string
  cafeId:  string
  staffId: string
  status:  ShiftStatus

  startTime: Date
  endTime:   Date | null

  /** Cash amount in drawer when shift started */
  initialCash:        number
  /** Running total of CASH payments collected this shift */
  totalCollectedCash: number

  notes: string | null

  staff?: StaffPublic
}

// ─── Request bodies ───────────────────────────────────────────────────────────

export interface CreateStaffBody {
  name:    string
  role:    StaffRole
  pinCode: string   // raw 4-digit PIN — hashed before saving
}

export interface PinLoginBody {
  cafeId:  string
  pinCode: string  // raw — compared against hash server-side
}

export interface OpenShiftBody {
  staffId:     string
  initialCash: number
  notes?:      string
}

export interface CloseShiftBody {
  shiftId:           string
  totalCollectedCash: number
  notes?:            string
}

// ─── Aggregations ─────────────────────────────────────────────────────────────

export interface ShiftSummary {
  shiftId:            string
  staffName:          string
  role:               StaffRole
  startTime:          Date
  endTime:            Date | null
  durationMinutes:    number | null
  initialCash:        number
  totalCollectedCash: number
  /** totalCollectedCash - initialCash */
  netCash:            number
  totalOrders:        number
  totalRevenue:       number
  status:             ShiftStatus
}
