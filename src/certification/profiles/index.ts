// Auto-registers all built-in certification profiles on import.
// Call this once at server startup.

import { registerRestaurantProfile } from './restaurant'

export function registerBuiltinProfiles(): void {
  registerRestaurantProfile()
  // Future: registerHotelProfile(), registerClinicProfile(), etc.
}

export { registerProfile, getProfile, getAllProfiles, hasProfile } from './ProfileRegistry'
