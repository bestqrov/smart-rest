// ─── Smart Intelligence Context Engine — User Context from existing JWTs (K33) ─
// Reshapes the existing AdminTokenPayload/POSTokenPayload (already verified
// by authorizeAdmin/authorizePOS middleware) into UserContext — no new
// authentication, no re-verification.

import type { AdminTokenPayload } from '../../middleware/authorizeAdmin'
import type { POSTokenPayload } from '../../middleware/authorizePOS'
import type { UserContext } from './types'

export function userContextFromAdmin(admin: AdminTokenPayload): UserContext {
  return { type: 'admin', id: admin.userId, cafeId: admin.cafeId }
}

export function userContextFromStaff(staff: POSTokenPayload): UserContext {
  return { type: 'staff', id: staff.staffId, cafeId: staff.cafeId, role: staff.staffRole }
}
