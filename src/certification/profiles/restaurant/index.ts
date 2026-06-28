import { createProfile, registerProfile } from '../ProfileRegistry'
import { restaurantDataFetcher }          from './dataFetcher'

export function registerRestaurantProfile(): void {
  const profile = createProfile({
    id:          'restaurant',
    name:        'SmartRestaurant Certification',
    description: 'Evaluates a restaurant tenant across content, setup, compliance, activity, and features.',
    version:     '2.0',
    enabled:     true,
    validityDays: 90,

    // Pack assembly — order determines override priority (last wins on rule conflict).
    // Dependencies are resolved automatically (marketing-pack → customer-pack).
    packs: [
      'operations-pack',
      'billing-pack',
      'marketing-pack',    // pulls in customer-pack via dependency
      'automation-pack',
      'reservation-pack',
      'inventory-pack',
      'ai-pack',
    ],

    certificateLevels: [
      { level: 'BRONZE',   minPercentage: 30, description: 'Basic setup complete' },
      { level: 'SILVER',   minPercentage: 50, description: 'Operational restaurant' },
      { level: 'GOLD',     minPercentage: 70, description: 'Active and well-configured' },
      { level: 'PLATINUM', minPercentage: 85, description: 'High-performance operation' },
      { level: 'DIAMOND',  minPercentage: 95, description: 'Exceptional SmartRestaurant' },
    ],

    dataFetcher: restaurantDataFetcher,
    // No evaluatorOverrides — all evaluators come from packs
  })

  registerProfile(profile)
}
