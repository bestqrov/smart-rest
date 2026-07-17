/**
 * One-off: create the default BillingPlan via the same PlanService.createPlan
 * path the SuperAdmin billing-plans interface (POST /api/superadmin/billing/
 * plans) uses — same validation, same "unset other defaults" behavior.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/createDefaultPlan.ts
 */
import * as PlanService from '../src/billing/plans/PlanService'
import * as PlanRepository from '../src/billing/plans/PlanRepository'

async function main() {
  const existing = await PlanRepository.findDefault()
  if (existing) {
    console.log(`Default plan already exists: ${existing.code} (${existing.id}) — not creating a duplicate.`)
    process.exit(0)
  }

  const plan = await PlanService.createPlan({
    name:         'Standard',
    code:         'STANDARD',
    description:  'Default plan — full platform access for a single restaurant location.',
    monthlyPrice: 199,
    yearlyPrice:  1990,
    currency:     'MAD',
    isActive:     true,
    isDefault:    true,
    displayOrder: 0,
    maxUsers:          10,
    maxStorageGB:      20,
    aiCredits:         100,
    marketplaceEnabled:   true,
    automationEnabled:    true,
    certificationEnabled: true,
    apiAccess:            false,
    supportLevel:         'EMAIL',
  }, 'system:release-prep')

  console.log('Created plan:', JSON.stringify(plan, null, 2))

  const verify = await PlanRepository.findDefault()
  console.log('\nVerify findDefault() returns this plan:', verify?.id === plan.id ? 'YES' : 'NO — MISMATCH')
  console.log('isActive:', plan.isActive, ' isDefault:', plan.isDefault)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to create default plan:', err)
    process.exit(1)
  })
