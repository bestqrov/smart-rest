// ─── Tenant Lifecycle Engine — Plan Definitions ───────────────────────────────
// Canonical source of truth for all plan capabilities and limits.
// Add new plans here — no other file needs to change.

import type { Plan, PlanDefinition } from '../types'

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  FREE: {
    name: 'FREE',
    modules: ['MENU', 'QR', 'ORDERS', 'BASIC_ANALYTICS'],
    limits: {
      users:                        2,
      tables:                       10,
      qrCodes:                      5,
      storageGb:                    1,
      aiRequestsPerMonth:           100,
      reservationsPerMonth:         50,
      marketplaceOrdersPerMonth:    0,
      automationExecutionsPerMonth: 0,
    },
    features: {
      marketplace:    false,
      automation:     false,
      certification:  false,
      analytics:      false,
      aiCenter:       false,
      multiLocation:  false,
      customBranding: false,
      prioritySupport:false,
    },
    trialDays: 14,
  },

  STARTER: {
    name: 'STARTER',
    modules: ['MENU', 'QR', 'ORDERS', 'POS', 'RESERVATIONS', 'ANALYTICS', 'LOYALTY'],
    limits: {
      users:                        5,
      tables:                       30,
      qrCodes:                      20,
      storageGb:                    5,
      aiRequestsPerMonth:           500,
      reservationsPerMonth:         200,
      marketplaceOrdersPerMonth:    10,
      automationExecutionsPerMonth: 50,
    },
    features: {
      marketplace:    true,
      automation:     false,
      certification:  false,
      analytics:      true,
      aiCenter:       false,
      multiLocation:  false,
      customBranding: false,
      prioritySupport:false,
    },
    trialDays: 14,
  },

  PROFESSIONAL: {
    name: 'PROFESSIONAL',
    modules: [
      'MENU', 'QR', 'ORDERS', 'POS', 'RESERVATIONS', 'ANALYTICS',
      'LOYALTY', 'MARKETING', 'INVENTORY', 'CERTIFICATION', 'AI_CENTER',
      'RECIPES', 'TRAITEUR', 'SOCIAL',
    ],
    limits: {
      users:                        15,
      tables:                       100,
      qrCodes:                      50,
      storageGb:                    20,
      aiRequestsPerMonth:           2000,
      reservationsPerMonth:         1000,
      marketplaceOrdersPerMonth:    50,
      automationExecutionsPerMonth: 500,
    },
    features: {
      marketplace:    true,
      automation:     true,
      certification:  true,
      analytics:      true,
      aiCenter:       true,
      multiLocation:  false,
      customBranding: true,
      prioritySupport:false,
    },
    trialDays: 14,
  },

  ENTERPRISE: {
    name: 'ENTERPRISE',
    modules: ['ALL'],
    limits: {
      users:                        999,
      tables:                       999,
      qrCodes:                      999,
      storageGb:                    200,
      aiRequestsPerMonth:           20000,
      reservationsPerMonth:         9999,
      marketplaceOrdersPerMonth:    999,
      automationExecutionsPerMonth: 9999,
    },
    features: {
      marketplace:    true,
      automation:     true,
      certification:  true,
      analytics:      true,
      aiCenter:       true,
      multiLocation:  true,
      customBranding: true,
      prioritySupport:true,
    },
    trialDays: 30,
  },

  CUSTOM: {
    name: 'CUSTOM',
    modules: [],
    limits: {
      users:                        0,
      tables:                       0,
      qrCodes:                      0,
      storageGb:                    0,
      aiRequestsPerMonth:           0,
      reservationsPerMonth:         0,
      marketplaceOrdersPerMonth:    0,
      automationExecutionsPerMonth: 0,
    },
    features: {
      marketplace:    false,
      automation:     false,
      certification:  false,
      analytics:      false,
      aiCenter:       false,
      multiLocation:  false,
      customBranding: false,
      prioritySupport:false,
    },
    trialDays: 0,
  },
}

export function getPlan(name: Plan): PlanDefinition {
  return PLAN_DEFINITIONS[name] ?? PLAN_DEFINITIONS.FREE
}

export function listPlans(): PlanDefinition[] {
  return Object.values(PLAN_DEFINITIONS)
}

export const PLAN_NAMES: Plan[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM']
