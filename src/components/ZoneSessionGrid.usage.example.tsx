/**
 * USAGE EXAMPLES — not a real page, just reference snippets.
 * Delete this file after wiring up the real pages.
 */

// ─── 1. Customer menu page ────────────────────────────────────────────────────
// In: app/[subdomain]/zone/[zoneId]/page.tsx  (or wherever the QR scan lands)
//
// After POST /api/zones/scan returns { sessionId, tokenNumber, zoneName }:

import FlashSignalOverlay from '@/src/components/FlashSignalOverlay'

function CustomerZonePage({ cafeId, activeSessionId }: { cafeId: string; activeSessionId: string }) {
  return (
    <>
      {/* Your menu / order tracking UI */}

      {/*
        Mount once — it stays invisible until the server fires ready_for_service.
        activeSessionId comes from localStorage after the scan.
      */}
      <FlashSignalOverlay
        activeSessionId={activeSessionId}
        cafeId={cafeId}
      />
    </>
  )
}

// ─── 2. Waiter tablet dashboard ───────────────────────────────────────────────
// In: app/waiter/zones/page.tsx  (add a new tab or replace an existing section)

import ZoneSessionGrid from '@/src/components/ZoneSessionGrid'

function WaiterZoneDashboard({ cafeId, authToken }: { cafeId: string; authToken: string }) {
  return (
    <div className="p-4">
      <ZoneSessionGrid cafeId={cafeId} authToken={authToken} />
    </div>
  )
}

export { CustomerZonePage, WaiterZoneDashboard }
