// ─── Order domain types ───────────────────────────────────────────────────────

export type OrderStatus   = 'PENDING' | 'PREPARING' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
export type OrderSource   = 'QR_CODE' | 'POS_MANUAL'
export type BillStatus    = 'OPENED' | 'BILL_REQUESTED' | 'CLOSED_PRINTED' | 'CLOSED_VIRTUAL'
export type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE'

export interface OrderItemSnapshot {
  id:             string
  orderId:        string
  productId:      string
  quantity:       number
  notes:          string | null
  /** price at the moment the order was placed — never changes after creation */
  unitPrice:      number
  /** commission fraction at time of order (0.05 = 5%) */
  commissionRate: number
  product?: {
    nameEn: string
    nameAr: string
    nameFr: string
  }
}

export interface Order {
  id:              string
  cafeId:          string
  tableId:         string | null
  originalTableId: string | null
  seatId:          string | null
  seatNumber:      number | null

  status:        OrderStatus
  orderSource:   OrderSource
  billStatus:    BillStatus
  paymentMethod: PaymentMethod

  isPaid:        boolean
  totalPrice:    number
  customerPhone: string | null
  createdAt:     Date

  /** staff who entered the order — null for QR self-service orders */
  createdById: string | null

  items:  OrderItemSnapshot[]
}

// ─── Request bodies ───────────────────────────────────────────────────────────

export interface CreateOrderBody {
  /** QR seat token — required for QR_CODE orders */
  seatToken?:     string
  tableToken?:    string
  customerPhone?: string
  items: { productId: string; quantity: number; notes?: string }[]
  /** Required for POS_MANUAL orders */
  orderSource?:  OrderSource
  createdById?:  string
}

export interface UpdateBillStatusBody {
  billStatus:     BillStatus
  paymentMethod?: PaymentMethod
  isPaid?:        boolean
}

// ─── Aggregations ─────────────────────────────────────────────────────────────

export interface OrderSummary {
  orderId:          string
  totalPrice:       number
  totalCommission:  number
  itemCount:        number
  orderSource:      OrderSource
  billStatus:       BillStatus
  status:           OrderStatus
  createdAt:        Date
}

/** Commission breakdown for a single shift or date range */
export interface CommissionReport {
  staffId:         string
  staffName:       string
  periodStart:     Date
  periodEnd:       Date
  totalOrders:     number
  totalRevenue:    number
  totalCommission: number
  byProduct: {
    productId:        string
    productName:      string
    quantitySold:     number
    revenue:          number
    commission:       number
  }[]
}
