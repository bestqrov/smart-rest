// app/superadmin/components/types.ts

export interface Overview {
  totalCafes:       number
  activeCafes:      number
  suspendedCafes:   number
  trialCafes:       number
  economyCafes:     number
  advancedCafes:    number
  totalAccruedDebt: number
  totalRevenue:     number
  mrr:              number
}

export interface Tenant {
  id:               string
  name:             string
  businessName:     string
  subdomain:        string
  country:          string
  currency:         string
  isActive:         boolean
  walletBalance:    number
  billingStatus:    string
  trialEndsAt:      string | null
  hasExtendedTrial: boolean
  subscriptionTier: string | null
  monthlyFee:       number | null
  coffeeRefPrice:   number | null
  sandwichRefPrice: number | null
  weeklyOrderCount: number | null
  billingCycle:     number | null
  maintenancePack:  boolean
  maintenanceFee:   number | null
  nextBillingDate:  string | null
  isSmartInventoryEnabled:        boolean
  inventoryActivationRequested:   boolean
  inventoryActivationRequestedAt: string | null
  isDemo:           boolean
  _count: {
    orders:     number
    tables:     number
    staff:      number
    categories: number
  }
}

export interface MrrData {
  totalMRR_USD: number
  computedAt:   string
  byCountry:    {
    country:                 string
    cafes:                   number
    currency:                string
    monthlyCommissionLocal:  number
    monthlyMaintenanceUSD:   number
    monthlyUSD:              number
  }[]
}

export interface ModalState {
  tenant:          Tenant
  tab:             'billing' | 'trial' | 'activate'
  loading:         boolean
  error:           string
  coffee:          string
  sandwich:        string
  days:            string
  fee:             string
  tier:            string
  billingCycle:    number
  maintenance:     boolean
  maintenanceFee:  string
  preview:  { tier: string; monthlyFee: number; weeklyOrderCount: number } | null
}

export type Theme = 'A' | 'B' | 'C'

export interface PremiumPlan {
  country:          string
  currency:         string
  monthlyPrice:     number
  hasNoCommission:  boolean
  hasMarketing:     boolean
  hasCertification: boolean
  hasAnalytics:     boolean
}

export interface ThemeProps {
  // ── Data ────────────────────────────────────────────────────────
  overview:      Overview | null
  tenants:       Tenant[]
  total:         number
  mrrData:       MrrData | null
  demoRequests:  any[]
  demoTab:       'pending' | 'activated' | 'rejected'
  revenueHistory: { month: string; value: number }[]

  // ── UI state ─────────────────────────────────────────────────────
  loading:         boolean
  sweeping:        boolean
  sweepMsg:        string
  page:            number
  filterCountry:   string
  filterStatus:    string
  filterTier:      string
  sortBal:         'asc' | 'desc'
  actionId:        string | null
  selectedIds:     Set<string>
  bulkDeleting:    boolean
  deleteEmail:     string
  delByEmail:      boolean
  demoLoading:     boolean
  activatingDemo:  string | null
  mrrOpen:         boolean
  theme:           Theme

  // ── Callbacks ────────────────────────────────────────────────────
  onLoadAll:           (p?: number, append?: boolean) => void
  onRunSweep:          () => void
  onSuspend:           (id: string) => void
  onReactivate:        (id: string) => void
  onOpenModal:         (tenant: Tenant, tab?: 'billing' | 'trial' | 'activate') => void
  onDeleteConfirm:     (tenant: Tenant) => void
  onToggleSelect:      (id: string, isDemo: boolean) => void
  onSelectAll:         () => void
  onClearSelection:    () => void
  onBulkDelete:        () => void
  onToggleDemoFlag:    (id: string, current: boolean) => void
  onApproveInventory:  (id: string) => void
  onDeleteByEmail:     () => void
  onSetDeleteEmail:    (v: string) => void
  onLoadDemoRequests:  (status: string) => void
  onActivateDemo:      (id: string) => void
  onRejectDemo:        (id: string) => void
  onSetDemoTab:        (t: 'pending' | 'activated' | 'rejected') => void
  onSetFilterCountry:  (v: string) => void
  onSetFilterStatus:   (v: string) => void
  onSetFilterTier:     (v: string) => void
  onSetSortBal:        (v: 'asc' | 'desc') => void
  onSetMrrOpen:        (v: boolean) => void
  onSetTheme:          (t: Theme) => void
  onLoadMore:          () => void
  onOpenPurge?:        () => void

  // ── Premium Plans ────────────────────────────────────────────────
  premiumPlans:        PremiumPlan[]
  editingPlan:         PremiumPlan | null
  onSavePlan:          (country: string, patch: Record<string, unknown>) => void
  onSetEditingPlan:    (plan: PremiumPlan | null) => void
}
