// ─── Smart Intelligence Prompt Engine — Template Registry (K43) ────────────
// Same versioning shape as KnowledgeEntry (K39) / IntelRule (K41): mark the
// previous current row isCurrent=false, insert version+1 — one table.

import prisma from '../../prisma'
import { publishStandardEvent } from '../../core'
import type { PromptTemplateInput } from './types'

export interface StoredPromptTemplate {
  id:           string
  key:          string
  name:         string
  category:     string
  version:      number
  systemPrompt: string
  userPrompt:   string
}

function toStored(row: {
  id: string; key: string; name: string; category: string; version: number
  systemPrompt: string; userPrompt: string
}): StoredPromptTemplate {
  return {
    id: row.id, key: row.key, name: row.name, category: row.category,
    version: row.version, systemPrompt: row.systemPrompt, userPrompt: row.userPrompt,
  }
}

export async function defineTemplate(input: PromptTemplateInput): Promise<StoredPromptTemplate> {
  const current = await prisma.intelPromptTemplate.findFirst({
    where: { key: input.key, isCurrent: true },
  })

  if (current) {
    await prisma.intelPromptTemplate.update({ where: { id: current.id }, data: { isCurrent: false } })
  }

  const row = await prisma.intelPromptTemplate.create({
    data: {
      key: input.key, name: input.name, category: input.category,
      version:      (current?.version ?? 0) + 1,
      isCurrent:    true,
      systemPrompt: input.systemPrompt,
      userPrompt:   input.userPrompt,
    },
  })

  publishStandardEvent('IntelPromptDefined', {
    tenantId: 'platform', resourceId: row.id, metadata: { key: input.key, version: row.version },
  }, 'prompt-engine')

  return toStored(row)
}

export async function getActiveTemplate(key: string): Promise<StoredPromptTemplate | null> {
  const row = await prisma.intelPromptTemplate.findFirst({ where: { key, isCurrent: true } })
  return row ? toStored(row) : null
}

export async function getTemplateHistory(key: string): Promise<StoredPromptTemplate[]> {
  const rows = await prisma.intelPromptTemplate.findMany({ where: { key }, orderBy: { version: 'desc' } })
  return rows.map(toStored)
}

export async function listTemplates(category?: string): Promise<StoredPromptTemplate[]> {
  const rows = await prisma.intelPromptTemplate.findMany({
    where: { isCurrent: true, ...(category ? { category } : {}) },
    orderBy: { key: 'asc' },
  })
  return rows.map(toStored)
}
