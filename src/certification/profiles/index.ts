import { registerBuiltinPacks }      from '../packs'
import { registerRestaurantProfile } from './restaurant'

export function registerBuiltinProfiles(): void {
  // Packs must be registered before profiles (profiles reference packs by ID)
  registerBuiltinPacks()
  registerRestaurantProfile()
  // Future: registerHotelProfile(), registerClinicProfile(), etc.
}

export { createProfile, registerProfile, getProfile, getAllProfiles, hasProfile } from './ProfileRegistry'
