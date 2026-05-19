-- ============================================================
-- Smart Menu — Incremental migration
-- Adds: billing engine, wallet log, seat model, 5-language support
-- Run this against your existing database (do NOT run on empty DB)
-- ============================================================

-- New enums
CREATE TYPE "BillingStatus" AS ENUM ('GRACE_PERIOD', 'COLLECTING_DEBT', 'SUSPENDED');
CREATE TYPE "WalletLogType" AS ENUM ('DEBT_ACC_ORDER', 'DEBT_ACC_SOCIAL', 'PAYMENT_SETTLEMENT', 'TRIAL_EXTENSION');

-- Remove old subscription enum column + type
ALTER TABLE "Cafe" DROP COLUMN IF EXISTS "subscriptionStatus";
DROP TYPE IF EXISTS "SubscriptionStatus";

-- ── Cafe: new billing + geo columns ──────────────────────────────────────────
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "businessName"       TEXT            NOT NULL DEFAULT '';
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "country"            TEXT            NOT NULL DEFAULT 'MA';
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "totalSeats"         INTEGER         NOT NULL DEFAULT 0;
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "isActive"           BOOLEAN         NOT NULL DEFAULT true;
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "walletBalance"      DECIMAL(10,2)   NOT NULL DEFAULT 0.00;
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "trialEndsAt"        TIMESTAMP(3);
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "hasExtendedTrial"   BOOLEAN         NOT NULL DEFAULT false;
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "billingStatus"      "BillingStatus" NOT NULL DEFAULT 'GRACE_PERIOD';
ALTER TABLE "Cafe" ADD COLUMN IF NOT EXISTS "hasSocialShareAddon" BOOLEAN        NOT NULL DEFAULT false;

-- ── Table: composite unique (cafeId, tableNumber) ─────────────────────────────
ALTER TABLE "Table" ADD CONSTRAINT "Table_cafeId_tableNumber_key" UNIQUE ("cafeId", "tableNumber");

-- ── Category: French + Spanish + German names ────────────────────────────────
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameFr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameEs" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameDe" TEXT NOT NULL DEFAULT '';

-- ── Product: French + Spanish + German names ──────────────────────────────────
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "nameFr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "nameEs" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "nameDe" TEXT NOT NULL DEFAULT '';

-- ── Seat (Hybrid QR layout) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Seat" (
    "id"         SERIAL  NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "tableId"    INTEGER NOT NULL,
    "cafeId"     INTEGER NOT NULL,
    "qrToken"    TEXT    NOT NULL,
    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Seat_qrToken_key"          ON "Seat"("qrToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Seat_tableId_seatNumber_key" ON "Seat"("tableId", "seatNumber");
CREATE        INDEX IF NOT EXISTS "Seat_tableId_idx"           ON "Seat"("tableId");
CREATE        INDEX IF NOT EXISTS "Seat_qrToken_idx"           ON "Seat"("qrToken");

ALTER TABLE "Seat" ADD CONSTRAINT "Seat_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_cafeId_fkey"
    FOREIGN KEY ("cafeId")  REFERENCES "Cafe"("id")  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── BillingTier ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BillingTier" (
    "id"             SERIAL        NOT NULL,
    "cafeId"         INTEGER,
    "country"        TEXT          NOT NULL,
    "minOrderValue"  DECIMAL(10,2) NOT NULL,
    "maxOrderValue"  DECIMAL(10,2) NOT NULL,
    "feeAmount"      DECIMAL(10,2) NOT NULL,
    "isSocialShareFee" BOOLEAN     NOT NULL DEFAULT false,
    CONSTRAINT "BillingTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingTier_country_idx" ON "BillingTier"("country");
CREATE INDEX IF NOT EXISTS "BillingTier_cafeId_idx"  ON "BillingTier"("cafeId");

ALTER TABLE "BillingTier" ADD CONSTRAINT "BillingTier_cafeId_fkey"
    FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── WalletLog ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WalletLog" (
    "id"              SERIAL           NOT NULL,
    "cafeId"          INTEGER          NOT NULL,
    "orderId"         INTEGER,
    "amount"          DECIMAL(10,2)    NOT NULL,
    "type"            "WalletLogType"  NOT NULL,
    "previousBalance" DECIMAL(10,2)    NOT NULL,
    "newBalance"      DECIMAL(10,2)    NOT NULL,
    "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WalletLog_cafeId_idx"  ON "WalletLog"("cafeId");
CREATE INDEX IF NOT EXISTS "WalletLog_orderId_idx" ON "WalletLog"("orderId");

ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_cafeId_fkey"
    FOREIGN KEY ("cafeId")  REFERENCES "Cafe"("id")  ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
