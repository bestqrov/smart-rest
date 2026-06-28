import prisma from '../prisma'
import logger  from '../logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type AIJobLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

export interface CreateJobInput {
  module:         string
  jobType:        string
  provider?:      string
  model?:         string
  priority?:      number
  inputReference?: string
  metadata?:      Record<string, unknown>
}

export interface CompleteJobInput {
  outputReference?: string
  totalTokens?:     number
  estimatedCost?:   number
  metadata?:        Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonStr(v: Record<string, unknown> | undefined): string | undefined {
  if (!v) return undefined
  try { return JSON.stringify(v) } catch { return undefined }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function createJob(input: CreateJobInput): Promise<string> {
  const job = await prisma.aIJob.create({
    data: {
      module:         input.module,
      jobType:        input.jobType,
      provider:       input.provider,
      model:          input.model,
      priority:       input.priority ?? 5,
      status:         'QUEUED',
      inputReference: input.inputReference,
      metadata:       jsonStr(input.metadata),
    },
  })
  logger.info({ msg: '[AIJob] created', jobId: job.id, module: job.module, jobType: job.jobType })
  return job.id
}

export async function startJob(jobId: string, provider?: string, model?: string): Promise<void> {
  await prisma.aIJob.update({
    where: { id: jobId },
    data:  { status: 'RUNNING', startedAt: new Date(), provider, model },
  })
  await appendLog(jobId, 'INFO', 'Job started')
}

export async function updateProgress(jobId: string, progress: number): Promise<void> {
  await prisma.aIJob.update({
    where: { id: jobId },
    data:  { progress: Math.min(100, Math.max(0, progress)) },
  })
}

export async function completeJob(jobId: string, result: CompleteJobInput = {}): Promise<void> {
  const job = await prisma.aIJob.findUnique({ where: { id: jobId }, select: { startedAt: true } })
  const durationMs = job?.startedAt ? Date.now() - new Date(job.startedAt).getTime() : undefined

  await prisma.aIJob.update({
    where: { id: jobId },
    data: {
      status:          'COMPLETED',
      progress:        100,
      completedAt:     new Date(),
      durationMs,
      outputReference: result.outputReference,
      totalTokens:     result.totalTokens,
      estimatedCost:   result.estimatedCost,
      metadata:        result.metadata ? jsonStr(result.metadata) : undefined,
    },
  })
  await appendLog(jobId, 'INFO', `Job completed in ${durationMs ?? '?'}ms`)
}

export async function failJob(jobId: string, errorMessage: string, incrementRetry = false): Promise<void> {
  const job = await prisma.aIJob.findUnique({ where: { id: jobId }, select: { startedAt: true, retryCount: true } })
  const durationMs = job?.startedAt ? Date.now() - new Date(job.startedAt).getTime() : undefined

  await prisma.aIJob.update({
    where: { id: jobId },
    data: {
      status:       'FAILED',
      completedAt:  new Date(),
      durationMs,
      errorMessage,
      retryCount:   incrementRetry ? (job?.retryCount ?? 0) + 1 : undefined,
    },
  })
  await appendLog(jobId, 'ERROR', `Job failed: ${errorMessage}`)
}

export async function retryJob(jobId: string): Promise<void> {
  const job = await prisma.aIJob.findUnique({ where: { id: jobId }, select: { retryCount: true } })
  await prisma.aIJob.update({
    where: { id: jobId },
    data: {
      status:       'QUEUED',
      startedAt:    null,
      completedAt:  null,
      durationMs:   null,
      errorMessage: null,
      progress:     0,
      retryCount:   (job?.retryCount ?? 0) + 1,
    },
  })
  await appendLog(jobId, 'INFO', 'Job queued for retry')
}

export async function cancelJob(jobId: string): Promise<void> {
  await prisma.aIJob.update({
    where: { id: jobId },
    data: { status: 'CANCELLED', completedAt: new Date() },
  })
  await appendLog(jobId, 'WARN', 'Job cancelled')
}

export async function appendLog(
  jobId: string,
  level: AIJobLogLevel,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.aIJobLog.create({
      data: {
        jobId,
        level,
        message,
        metadata: jsonStr(metadata),
      },
    })
  } catch (err) {
    logger.warn({ msg: '[AIJob] appendLog failed', jobId, err })
  }
}
