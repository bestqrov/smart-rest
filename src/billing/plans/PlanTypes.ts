// ─── Billing Plans — Types ─────────────────────────────────────────────────

export type SupportLevel = 'COMMUNITY' | 'EMAIL' | 'PRIORITY' | 'DEDICATED'

export interface BillingPlan {
  id:                   string
  name:                 string
  code:                 string
  description:          string | null
  monthlyPrice:         number
  yearlyPrice:          number
  currency:             string
  isActive:             boolean
  isDefault:            boolean
  displayOrder:         number
  maxUsers:             number
  maxStorageGB:         number
  aiCredits:            number
  marketplaceEnabled:   boolean
  automationEnabled:    boolean
  certificationEnabled: boolean
  apiAccess:            boolean
  supportLevel:         SupportLevel
  createdAt:            Date
  updatedAt:            Date
}

export interface CreatePlanInput {
  name:                 string
  code:                 string
  description?:         string
  monthlyPrice:         number
  yearlyPrice?:         number
  currency?:            string
  isActive?:            boolean
  isDefault?:           boolean
  displayOrder?:        number
  maxUsers?:            number
  maxStorageGB?:        number
  aiCredits?:           number
  marketplaceEnabled?:  boolean
  automationEnabled?:   boolean
  certificationEnabled?: boolean
  apiAccess?:           boolean
  supportLevel?:        SupportLevel
}

export type UpdatePlanInput = Partial<Omit<CreatePlanInput, 'code'>> & {
  code?: string
}
