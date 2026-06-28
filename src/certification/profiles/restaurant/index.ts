import type { ProfileDefinition } from '../../types'
import { registerProfile } from '../ProfileRegistry'
import { registerRules }   from '../../rules/RuleRegistry'
import { RESTAURANT_RULES, RESTAURANT_PROFILE_ID } from './RestaurantRules'
import { restaurantDataFetcher, restaurantEvaluators } from './RestaurantEvaluators'

const RESTAURANT_PROFILE: ProfileDefinition = {
  id:          RESTAURANT_PROFILE_ID,
  name:        'SmartRestaurant Certification',
  description: 'Evaluates a restaurant tenant across content, setup, compliance, activity, and features.',
  version:     '1.0',
  enabled:     true,
  validityDays: 90,

  certificateLevels: [
    { level: 'BRONZE',   minPercentage: 30, description: 'Basic setup complete' },
    { level: 'SILVER',   minPercentage: 50, description: 'Operational restaurant' },
    { level: 'GOLD',     minPercentage: 70, description: 'Active and well-configured' },
    { level: 'PLATINUM', minPercentage: 85, description: 'High-performance operation' },
    { level: 'DIAMOND',  minPercentage: 95, description: 'Exceptional SmartRestaurant' },
  ],

  dataFetcher:    restaurantDataFetcher,
  ruleEvaluators: restaurantEvaluators,
}

export function registerRestaurantProfile(): void {
  registerRules(RESTAURANT_RULES)
  registerProfile(RESTAURANT_PROFILE)
}
