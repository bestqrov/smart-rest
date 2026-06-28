import { registerCollector } from '../CollectorRegistry'
import { RESTAURANT_COLLECTOR }   from './restaurant'
import { BILLING_COLLECTOR }      from './billing'
import { MARKETING_COLLECTOR }    from './marketing'
import { AI_COLLECTOR }           from './ai'
import { CERTIFICATION_COLLECTOR } from './certification'
import { AUTOMATION_COLLECTOR }   from './automation'

const BUILTIN_COLLECTORS = [
  RESTAURANT_COLLECTOR,
  BILLING_COLLECTOR,
  MARKETING_COLLECTOR,
  AI_COLLECTOR,
  CERTIFICATION_COLLECTOR,
  AUTOMATION_COLLECTOR,
]

export function registerBuiltinCollectors(): void {
  for (const collector of BUILTIN_COLLECTORS) {
    registerCollector(collector)
  }
}

export {
  RESTAURANT_COLLECTOR,
  BILLING_COLLECTOR,
  MARKETING_COLLECTOR,
  AI_COLLECTOR,
  CERTIFICATION_COLLECTOR,
  AUTOMATION_COLLECTOR,
}
