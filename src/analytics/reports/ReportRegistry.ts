import type { ReportDefinition } from '../types'

// ─── In-memory report registry ────────────────────────────────────────────────

const registry = new Map<string, ReportDefinition>()

export function registerReport(report: ReportDefinition): void {
  if (registry.has(report.id)) {
    throw new Error(`Analytics: report "${report.id}" is already registered`)
  }
  registry.set(report.id, report)
}

export function getReport(id: string): ReportDefinition {
  const r = registry.get(id)
  if (!r) throw new Error(`Analytics: report "${id}" not registered`)
  return r
}

export function hasReport(id: string): boolean {
  return registry.has(id)
}

export function getAllReports(): ReportDefinition[] {
  return Array.from(registry.values())
}

export function getReportsByModule(module: string): ReportDefinition[] {
  return getAllReports().filter(r => r.module === module)
}

export function getReportsByTag(tag: string): ReportDefinition[] {
  return getAllReports().filter(r => r.tags.includes(tag))
}

export function _resetReportRegistry(): void {
  registry.clear()
}
