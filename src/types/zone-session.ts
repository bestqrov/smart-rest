import type { Zone, Table, ActiveSession, ActiveSessionStatus } from "@prisma/client";

// ─── Zone with relations ───────────────────────────────────────────────────────

export type ZoneWithTables = Zone & {
  tables: Pick<Table, "id" | "tableNumber" | "capacity" | "isActive">[];
  _count: { activeSessions: number };
};

// ─── Token assignment payload (returned after QR scan) ────────────────────────

export interface TokenAssignmentResult {
  activeSessionId: string;
  tokenNumber: number;
  zoneId: string;
  zoneName: string;
  tableId: string | null;
  status: ActiveSessionStatus;
}

// ─── Params for POST /api/zones/scan ─────────────────────────────────────────

export interface AssignTokenParams {
  cafeId: string;
  zoneId: string;
  tableId?: string | null;
  userIdentifier: string; // UUID from browser cookie / localStorage
}

// ─── ActiveSession with zone + table context ──────────────────────────────────

export type ActiveSessionWithContext = ActiveSession & {
  zone: Pick<Zone, "id" | "name" | "displayType" | "matchModeActive">;
  table: Pick<Table, "id" | "tableNumber" | "capacity"> | null;
};
