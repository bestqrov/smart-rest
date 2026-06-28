import { registerPack } from '../PackRegistry'
import { OPERATIONS_PACK }  from './operations-pack'
import { BILLING_PACK }     from './billing-pack'
import { CUSTOMER_PACK }    from './customer-pack'
import { MARKETING_PACK }   from './marketing-pack'
import { AUTOMATION_PACK }  from './automation-pack'
import { RESERVATION_PACK } from './reservation-pack'
import { INVENTORY_PACK }   from './inventory-pack'
import { AI_PACK }          from './ai-pack'
import { SECURITY_PACK }    from './security-pack'
import { COMPLIANCE_PACK }  from './compliance-pack'

// Order matters: dependencies must be registered before the packs that depend on them.
// customer-pack → marketing-pack (marketing depends on customer)
const BUILTIN_PACKS = [
  OPERATIONS_PACK,
  BILLING_PACK,
  CUSTOMER_PACK,     // before marketing-pack (dependency)
  MARKETING_PACK,
  AUTOMATION_PACK,
  RESERVATION_PACK,
  INVENTORY_PACK,
  AI_PACK,
  SECURITY_PACK,
  COMPLIANCE_PACK,
]

export function registerBuiltinPacks(): void {
  for (const pack of BUILTIN_PACKS) {
    registerPack(pack)
  }
}

export {
  OPERATIONS_PACK,
  BILLING_PACK,
  CUSTOMER_PACK,
  MARKETING_PACK,
  AUTOMATION_PACK,
  RESERVATION_PACK,
  INVENTORY_PACK,
  AI_PACK,
  SECURITY_PACK,
  COMPLIANCE_PACK,
}
