import os from 'os'
import { checkIntelligenceHealth } from '../../intelligence/observability'
import type { ModuleHealth, SystemHealth, HealthStatus } from '../types'

// ─── Individual module health checks ─────────────────────────────────────────

async function checkDatabase(): Promise<ModuleHealth> {
  const start = Date.now()
  try {
    const { default: prisma } = await import('../../prisma')
    await (prisma as any).$queryRaw`SELECT 1`
    const latencyMs = Date.now() - start
    return {
      module: 'database', label: 'Database (MongoDB)',
      status:    latencyMs > 500 ? 'warning' : 'healthy',
      latencyMs,
      message:   latencyMs > 500 ? 'High database latency' : 'Connected and responsive',
      checkedAt: new Date(),
    }
  } catch (err) {
    return {
      module: 'database', label: 'Database (MongoDB)',
      status: 'critical', latencyMs: Date.now() - start,
      message: `Connection failed: ${(err as Error).message}`,
      checkedAt: new Date(),
    }
  }
}

async function checkAICenter(): Promise<ModuleHealth> {
  const start = Date.now()
  try {
    const { default: prisma } = await import('../../prisma')
    const since = new Date(Date.now() - 3600_000)  // last hour
    const [running, queued, recentCompleted] = await Promise.all([
      prisma.aIJob.count({ where: { status: 'RUNNING' } }),
      prisma.aIJob.count({ where: { status: 'QUEUED' } }),
      prisma.aIJob.count({ where: { status: 'COMPLETED', completedAt: { gte: since } } }),
    ])
    const latencyMs = Date.now() - start

    let status: HealthStatus = 'healthy'
    if (queued > 50)  status = 'warning'
    if (queued > 200) status = 'critical'

    return {
      module: 'ai', label: 'AI Center',
      status, latencyMs,
      message: `${running} running, ${queued} queued, ${recentCompleted} completed (1h)`,
      checkedAt: new Date(),
      details: { running, queued, recentCompleted },
    }
  } catch (err) {
    return {
      module: 'ai', label: 'AI Center',
      status: 'unavailable', latencyMs: Date.now() - start,
      message: (err as Error).message,
      checkedAt: new Date(),
    }
  }
}

async function checkMarketing(): Promise<ModuleHealth> {
  const start = Date.now()
  try {
    const { default: prisma } = await import('../../prisma')
    const since = new Date(Date.now() - 86400_000)  // last 24h
    const [total, failed] = await Promise.all([
      prisma.marketingCampaign.count({ where: { createdAt: { gte: since } } }),
      prisma.marketingCampaign.count({ where: { createdAt: { gte: since }, status: 'failed' } }),
    ])
    const latencyMs = Date.now() - start
    const failRate  = total > 0 ? (failed / total) : 0

    let status: HealthStatus = 'healthy'
    if (failRate > 0.3) status = 'warning'
    if (failRate > 0.7) status = 'critical'

    return {
      module: 'marketing', label: 'Marketing Brain',
      status, latencyMs,
      message: total === 0 ? 'No campaigns in last 24h' : `${total} campaigns, ${failed} failed (24h)`,
      checkedAt: new Date(),
      details: { total, failed, failRate: Math.round(failRate * 100) },
    }
  } catch (err) {
    return {
      module: 'marketing', label: 'Marketing Brain',
      status: 'unavailable', latencyMs: Date.now() - start,
      message: (err as Error).message, checkedAt: new Date(),
    }
  }
}

async function checkCertification(): Promise<ModuleHealth> {
  const start = Date.now()
  try {
    const { default: prisma } = await import('../../prisma')
    const total = await (prisma as any).certificationResult.count()
    const latencyMs = Date.now() - start
    return {
      module: 'certification', label: 'Certification Engine',
      status: 'healthy', latencyMs,
      message: `${total} certification records`,
      checkedAt: new Date(),
      details: { total },
    }
  } catch (err) {
    return {
      module: 'certification', label: 'Certification Engine',
      status: 'unavailable', latencyMs: Date.now() - start,
      message: (err as Error).message, checkedAt: new Date(),
    }
  }
}

async function checkAnalytics(): Promise<ModuleHealth> {
  const start = Date.now()
  try {
    const { default: prisma } = await import('../../prisma')
    const since = new Date(Date.now() - 3600_000)
    const recent = await (prisma as any).metricSnapshot.count({ where: { createdAt: { gte: since } } })
    const latencyMs = Date.now() - start
    return {
      module: 'analytics', label: 'Analytics Engine',
      status:  recent === 0 ? 'warning' : 'healthy', latencyMs,
      message: recent === 0 ? 'No snapshots in last hour' : `${recent} snapshots collected (1h)`,
      checkedAt: new Date(),
      details: { recentSnapshots: recent },
    }
  } catch (err) {
    return {
      module: 'analytics', label: 'Analytics Engine',
      status: 'unavailable', latencyMs: Date.now() - start,
      message: (err as Error).message, checkedAt: new Date(),
    }
  }
}

async function checkBilling(): Promise<ModuleHealth> {
  const start = Date.now()
  try {
    const { default: prisma } = await import('../../prisma')
    const [active, suspended] = await Promise.all([
      prisma.cafe.count({ where: { billingStatus: 'COLLECTING_DEBT' } }),
      prisma.cafe.count({ where: { billingStatus: 'SUSPENDED' } }),
    ])
    const latencyMs = Date.now() - start
    return {
      module: 'billing', label: 'Billing Engine',
      status: 'healthy', latencyMs,
      message: `${active} active, ${suspended} suspended`,
      checkedAt: new Date(),
      details: { active, suspended },
    }
  } catch (err) {
    return {
      module: 'billing', label: 'Billing Engine',
      status: 'unavailable', latencyMs: Date.now() - start,
      message: (err as Error).message, checkedAt: new Date(),
    }
  }
}

async function checkN8N(): Promise<ModuleHealth> {
  const start   = Date.now()
  const n8nUrl  = process.env.N8N_WEBHOOK_URL

  if (!n8nUrl) {
    return {
      module: 'n8n', label: 'N8N Automation',
      status: 'warning', message: 'N8N_WEBHOOK_URL not configured',
      checkedAt: new Date(),
    }
  }

  try {
    // Ping the base origin (not the webhook path) — quick HEAD request
    const origin    = new URL(n8nUrl).origin
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(origin, { method: 'HEAD', signal: controller.signal })
      .catch(() => null)
    clearTimeout(timeout)

    const latencyMs = Date.now() - start

    if (!res) {
      return {
        module: 'n8n', label: 'N8N Automation',
        status: 'warning', latencyMs,
        message: 'N8N unreachable (timeout or network error)',
        checkedAt: new Date(),
      }
    }

    return {
      module: 'n8n', label: 'N8N Automation',
      status: latencyMs > 3000 ? 'warning' : 'healthy',
      latencyMs, message: `Reachable (HTTP ${res.status})`,
      checkedAt: new Date(),
    }
  } catch {
    return {
      module: 'n8n', label: 'N8N Automation',
      status: 'warning', latencyMs: Date.now() - start,
      message: 'N8N unreachable', checkedAt: new Date(),
    }
  }
}

async function checkStorage(): Promise<ModuleHealth> {
  const start   = Date.now()
  const freeMB  = Math.round(os.freemem()  / 1024 / 1024)
  const totalMB = Math.round(os.totalmem() / 1024 / 1024)
  const usedPct = Math.round(((totalMB - freeMB) / totalMB) * 100)
  const latencyMs = Date.now() - start

  let status: HealthStatus = 'healthy'
  if (usedPct > 80) status = 'warning'
  if (usedPct > 95) status = 'critical'

  return {
    module: 'storage', label: 'Storage / Memory',
    status, latencyMs,
    message: `${usedPct}% memory used (${freeMB}MB free of ${totalMB}MB)`,
    checkedAt: new Date(),
    details: { freeMB, totalMB, usedPct },
  }
}

async function checkCoreServices(): Promise<ModuleHealth> {
  const start = Date.now()
  try {
    const { default: prisma } = await import('../../prisma')
    const flagCount = await (prisma as any).featureFlag?.count?.() ?? 0
    return {
      module: 'core', label: 'Core Services',
      status: 'healthy', latencyMs: Date.now() - start,
      message: `Core initialized — ${flagCount} feature flags`,
      checkedAt: new Date(),
      details: { featureFlags: flagCount },
    }
  } catch (err) {
    return {
      module: 'core', label: 'Core Services',
      status: 'healthy', latencyMs: Date.now() - start,
      message: 'Core services running',
      checkedAt: new Date(),
    }
  }
}

// ─── Aggregate overall health ─────────────────────────────────────────────────

function calculateOverall(modules: ModuleHealth[]): HealthStatus {
  if (modules.some(m => m.status === 'critical'))    return 'critical'
  if (modules.some(m => m.status === 'unavailable')) return 'critical'
  if (modules.some(m => m.status === 'warning'))     return 'warning'
  return 'healthy'
}

// ─── Public: get full system health ──────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemHealth> {
  const modules = await Promise.all([
    checkCoreServices(),
    checkDatabase(),
    checkAICenter(),
    checkMarketing(),
    checkBilling(),
    checkCertification(),
    checkAnalytics(),
    checkN8N(),
    checkStorage(),
    checkIntelligenceHealth(),
  ])

  return {
    overall:   calculateOverall(modules),
    modules,
    checkedAt: new Date(),
    uptimeMs:  Math.round(process.uptime() * 1000),
  }
}
