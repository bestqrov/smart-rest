import os from 'os'
import type { DiagnosticCheck, DiagnosticsReport, DiagnosticStatus } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCheck(
  name:     string,
  category: DiagnosticCheck['category'],
  fn:       () => Promise<Omit<DiagnosticCheck, 'name' | 'category' | 'durationMs'>>,
): Promise<DiagnosticCheck> {
  const start = Date.now()
  return fn()
    .then(result => ({ name, category, durationMs: Date.now() - start, ...result }))
    .catch(err  => ({
      name, category,
      status:      'error' as DiagnosticStatus,
      message:     (err as Error).message,
      durationMs:  Date.now() - start,
    }))
}

// ─── Individual checks ────────────────────────────────────────────────────────

async function checkDbConnection(): Promise<DiagnosticCheck> {
  return makeCheck('Database Connection', 'connectivity', async () => {
    const { default: prisma } = await import('../../prisma')
    await (prisma as any).$queryRaw`SELECT 1`
    return { status: 'passed', message: 'Database connection successful' }
  })
}

async function checkDbLatency(): Promise<DiagnosticCheck> {
  return makeCheck('Database Latency', 'connectivity', async () => {
    const { default: prisma } = await import('../../prisma')
    const start = Date.now()
    await (prisma as any).$queryRaw`SELECT 1`
    const latencyMs = Date.now() - start
    const status: DiagnosticStatus = latencyMs > 500 ? 'warning' : 'passed'
    return {
      status,
      message: `Database responded in ${latencyMs}ms`,
      value: latencyMs,
      recommendation: status === 'warning' ? 'Consider adding indexes or upgrading your Atlas tier' : undefined,
    }
  })
}

async function checkMemoryUsage(): Promise<DiagnosticCheck> {
  return makeCheck('Memory Usage', 'resources', async () => {
    const freeMB  = Math.round(os.freemem()  / 1024 / 1024)
    const totalMB = Math.round(os.totalmem() / 1024 / 1024)
    const usedPct = Math.round(((totalMB - freeMB) / totalMB) * 100)

    let status: DiagnosticStatus = 'passed'
    if (usedPct > 80) status = 'warning'
    if (usedPct > 95) status = 'error'

    return {
      status,
      message:        `${usedPct}% memory used (${freeMB}MB free of ${totalMB}MB)`,
      value:          usedPct,
      recommendation: status !== 'passed' ? 'Consider upgrading server RAM or adding swap' : undefined,
    }
  })
}

async function checkHeapUsage(): Promise<DiagnosticCheck> {
  return makeCheck('Node.js Heap', 'resources', async () => {
    const mem = process.memoryUsage()
    const heapPct = Math.round((mem.heapUsed / mem.heapTotal) * 100)

    let status: DiagnosticStatus = 'passed'
    if (heapPct > 80) status = 'warning'
    if (heapPct > 95) status = 'error'

    return {
      status,
      message: `Heap ${heapPct}% used (${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB)`,
      value:   heapPct,
      recommendation: status !== 'passed' ? 'Check for memory leaks; consider increasing --max-old-space-size' : undefined,
    }
  })
}

async function checkN8NWebhook(): Promise<DiagnosticCheck> {
  return makeCheck('N8N Webhook', 'connectivity', async () => {
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (!webhookUrl) {
      return {
        status: 'warning',
        message: 'N8N_WEBHOOK_URL is not set — Automation features will not function',
        recommendation: 'Set N8N_WEBHOOK_URL in your environment',
      }
    }
    const origin     = new URL(webhookUrl).origin
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(origin, { method: 'HEAD', signal: controller.signal }).catch(() => null)
      clearTimeout(timeout)
      if (!res) return { status: 'warning', message: 'N8N unreachable', recommendation: 'Verify N8N service is running' }
      return { status: 'passed', message: `N8N reachable at ${origin} (HTTP ${res.status})`, value: origin }
    } finally {
      clearTimeout(timeout)
    }
  })
}

async function checkAIProvider(): Promise<DiagnosticCheck> {
  return makeCheck('AI Provider', 'connectivity', async () => {
    const key = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_AI_KEY
    if (!key) {
      return {
        status: 'warning',
        message: 'No AI provider API key found (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_KEY)',
        recommendation: 'Set at least one AI provider API key',
      }
    }
    // Don't make a real API call — just verify key format
    const provider = process.env.OPENAI_API_KEY     ? 'OpenAI'     :
                     process.env.ANTHROPIC_API_KEY   ? 'Anthropic'  : 'Google AI'
    return {
      status:  'passed',
      message: `${provider} API key is configured`,
      value:   provider,
    }
  })
}

async function checkRequiredEnvVars(): Promise<DiagnosticCheck> {
  return makeCheck('Environment Configuration', 'configuration', async () => {
    const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'SUPERADMIN_SECRET']
    const missing  = required.filter(k => !process.env[k])

    if (missing.length > 0) {
      return {
        status:         'error',
        message:        `Missing required env vars: ${missing.join(', ')}`,
        recommendation: `Set all required environment variables before deploying`,
      }
    }

    const optional = ['RESEND_API_KEY', 'N8N_WEBHOOK_URL', 'OPENAI_API_KEY']
    const missingOpt = optional.filter(k => !process.env[k])

    if (missingOpt.length > 0) {
      return {
        status:  'warning',
        message: `Optional env vars not set: ${missingOpt.join(', ')}`,
        recommendation: 'Set optional vars to unlock all features',
      }
    }

    return { status: 'passed', message: 'All required environment variables are set' }
  })
}

async function checkAIJobBacklog(): Promise<DiagnosticCheck> {
  return makeCheck('AI Job Backlog', 'data', async () => {
    const { default: prisma } = await import('../../prisma')
    const queued  = await prisma.aIJob.count({ where: { status: 'QUEUED' } })
    const running = await prisma.aIJob.count({ where: { status: 'RUNNING' } })

    let status: DiagnosticStatus = 'passed'
    if (queued > 20)  status = 'warning'
    if (queued > 100) status = 'error'

    return {
      status,
      message:        `${queued} queued, ${running} running`,
      value:          queued,
      recommendation: status !== 'passed' ? 'Scale AI worker capacity or investigate bottlenecks' : undefined,
    }
  })
}

async function checkCertificationExpiry(): Promise<DiagnosticCheck> {
  return makeCheck('Certification Expiry', 'data', async () => {
    const { default: prisma } = await import('../../prisma')
    const expiredCount = await (prisma as any).certificationResult.count({
      where: { expiresAt: { lt: new Date() }, status: 'COMPLETED' },
    })
    const status: DiagnosticStatus = expiredCount > 100 ? 'warning' : 'passed'
    return {
      status,
      message: `${expiredCount} expired certifications (will auto-expire on next evaluation)`,
      value:   expiredCount,
    }
  })
}

async function checkSuspendedAccounts(): Promise<DiagnosticCheck> {
  return makeCheck('Suspended Accounts', 'data', async () => {
    const { default: prisma } = await import('../../prisma')
    const suspended = await prisma.cafe.count({ where: { billingStatus: 'SUSPENDED' } })
    const status: DiagnosticStatus = suspended > 10 ? 'warning' : 'passed'
    return {
      status,
      message:        `${suspended} accounts suspended`,
      value:          suspended,
      recommendation: status !== 'passed' ? 'Review and resolve overdue accounts in Billing section' : undefined,
    }
  })
}

async function checkSecurityAlerts(): Promise<DiagnosticCheck> {
  return makeCheck('Security Alerts', 'security', async () => {
    const { default: prisma } = await import('../../prisma')
    const pending = await prisma.fraudAlert.count({ where: { status: 'Pending' } })
    const status: DiagnosticStatus = pending > 5 ? 'warning' : 'passed'
    return {
      status,
      message:        `${pending} unreviewed fraud alerts`,
      value:          pending,
      recommendation: status !== 'passed' ? 'Review fraud alerts in the Security section' : undefined,
    }
  })
}

// ─── Run all diagnostics ──────────────────────────────────────────────────────

export async function runDiagnostics(): Promise<DiagnosticsReport> {
  const runAt = new Date()
  const start = Date.now()

  const checks = await Promise.all([
    checkDbConnection(),
    checkDbLatency(),
    checkMemoryUsage(),
    checkHeapUsage(),
    checkN8NWebhook(),
    checkAIProvider(),
    checkRequiredEnvVars(),
    checkAIJobBacklog(),
    checkCertificationExpiry(),
    checkSuspendedAccounts(),
    checkSecurityAlerts(),
  ])

  const passed   = checks.filter(c => c.status === 'passed').length
  const warnings = checks.filter(c => c.status === 'warning').length
  const errors   = checks.filter(c => c.status === 'error').length

  const recommendations = checks
    .filter(c => c.recommendation)
    .map(c => c.recommendation!)

  return {
    runAt,
    durationMs:      Date.now() - start,
    passed,
    warnings,
    errors,
    checks,
    recommendations,
  }
}
