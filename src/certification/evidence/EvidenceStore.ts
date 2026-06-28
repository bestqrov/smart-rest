import prisma from '../../prisma'
import type { Evidence, EvidenceInput } from '../types'

// ─── Evidence store ───────────────────────────────────────────────────────────
//
// Evidence records are immutable — once created they are never updated.
// They form a tamper-evident audit trail of each rule evaluation.

function toEvidence(row: any): Evidence {
  return {
    id:            row.id,
    resultId:      row.resultId,
    ruleId:        row.ruleId,
    passed:        row.passed,
    score:         row.score,
    rawValue:      JSON.parse(row.rawValue),
    expectedValue: row.expectedValue ? JSON.parse(row.expectedValue) : undefined,
    metadata:      row.metadata ? JSON.parse(row.metadata) : undefined,
    timestamp:     row.timestamp,
  }
}

export async function persistEvidence(
  resultId: string,
  ruleId:   string,
  ev:       EvidenceInput,
): Promise<Evidence> {
  const row = await (prisma as any).certificationEvidence.create({
    data: {
      resultId,
      ruleId,
      passed:        ev.passed,
      score:         ev.score,
      rawValue:      JSON.stringify(ev.rawValue ?? null),
      expectedValue: ev.expectedValue !== undefined ? JSON.stringify(ev.expectedValue) : undefined,
      metadata:      ev.metadata ? JSON.stringify(ev.metadata) : undefined,
    },
  })
  return toEvidence(row)
}

export async function getEvidenceForResult(resultId: string): Promise<Evidence[]> {
  const rows = await (prisma as any).certificationEvidence.findMany({
    where: { resultId },
    orderBy: { timestamp: 'asc' },
  })
  return rows.map(toEvidence)
}

export async function getEvidenceById(id: string): Promise<Evidence | null> {
  const row = await (prisma as any).certificationEvidence.findUnique({ where: { id } })
  return row ? toEvidence(row) : null
}
