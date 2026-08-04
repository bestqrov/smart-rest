/**
 * One-time cleanup: removes the legacy plaintext `pinDisplay` field from
 * every Staff document. Removing a field from schema.prisma does NOT delete
 * it from existing MongoDB documents — Prisma just stops selecting it — so
 * this script physically strips it via a raw $unset.
 *
 * Safe to run multiple times (idempotent — $unset on an already-absent
 * field is a no-op). Does not touch `pinCode` (the bcrypt hash) at all.
 *
 * Run once against production after the pinDisplay-removal deploy:
 *   npx ts-node -r dotenv/config scripts/migrateStripPinDisplay.ts
 */

import prisma from '../src/prisma'

async function main() {
  const result = await prisma.$runCommandRaw({
    update: 'Staff',
    updates: [
      { q: { pinDisplay: { $exists: true } }, u: { $unset: { pinDisplay: '' } }, multi: true },
    ],
  }) as { n?: number; nModified?: number }

  console.log(`Matched ${result.n ?? 0} Staff documents, modified ${result.nModified ?? 0}.`)
}

main()
  .catch(err => { console.error('migrateStripPinDisplay failed:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
