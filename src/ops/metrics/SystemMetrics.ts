import os from 'os'
import type { SystemMetrics } from '../types'

// ─── System Metrics collection ────────────────────────────────────────────────

let _lastCpuUsage: NodeJS.CpuUsage | null = null
let _lastCpuTime  = 0

export async function collectSystemMetrics(): Promise<SystemMetrics> {
  // CPU usage (delta from last measurement)
  const cpuNow  = process.cpuUsage(_lastCpuUsage ?? undefined)
  const timeNow  = Date.now()
  const elapsed  = _lastCpuTime > 0 ? timeNow - _lastCpuTime : 1000

  const userPercent = _lastCpuUsage
    ? Math.min(100, Math.round((cpuNow.user / 1000 / elapsed) * 100))
    : null

  _lastCpuUsage = process.cpuUsage()
  _lastCpuTime  = timeNow

  // Memory
  const mem   = process.memoryUsage()
  const freeMB  = Math.round(os.freemem()  / 1024 / 1024)
  const totalMB = Math.round(os.totalmem() / 1024 / 1024)

  // Database latency
  let dbLatencyMs = -1
  let dbConnected = false
  try {
    const { default: prisma } = await import('../../prisma')
    const start = Date.now()
    await (prisma as any).$queryRaw`SELECT 1`
    dbLatencyMs = Date.now() - start
    dbConnected = true
  } catch { /* not connected */ }

  // AI Jobs snapshot
  let running = 0, queued = 0, failedToday = 0, completed = 0
  try {
    const { default: prisma } = await import('../../prisma')
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    ;[running, queued, failedToday, completed] = await Promise.all([
      prisma.aIJob.count({ where: { status: 'RUNNING' } }),
      prisma.aIJob.count({ where: { status: 'QUEUED' } }),
      prisma.aIJob.count({ where: { status: 'FAILED', completedAt: { gte: todayStart } } }),
      prisma.aIJob.count({ where: { status: 'COMPLETED', completedAt: { gte: todayStart } } }),
    ])
  } catch { /* skip */ }

  const loadAvg = os.loadavg() as [number, number, number]

  return {
    cpu: {
      loadAvg,
      cores:       os.cpus().length,
      userPercent,
    },
    memory: {
      heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB:       Math.round(mem.rss       / 1024 / 1024),
      externalMB:  Math.round(mem.external  / 1024 / 1024),
      freeMB,
      totalMB,
    },
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      pid:           process.pid,
      nodeVersion:   process.version,
      env:           process.env.NODE_ENV ?? 'unknown',
    },
    database: {
      latencyMs: dbLatencyMs,
      connected: dbConnected,
    },
    jobs: { running, queued, failedToday, completed },
    collectedAt: new Date(),
  }
}
