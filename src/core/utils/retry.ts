import logger from '../../logger'

export interface RetryOptions {
  attempts?:    number
  baseDelayMs?: number
  maxDelayMs?:  number
  onRetry?:     (attempt: number, error: unknown) => void
}

/**
 * Retry an async operation with exponential backoff.
 * Throws the last error if all attempts are exhausted.
 */
export async function withRetry<T>(
  fn:   () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    attempts    = 3,
    baseDelayMs = 500,
    maxDelayMs  = 30_000,
    onRetry,
  } = opts

  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i >= attempts) break
      const delay = Math.min(baseDelayMs * 2 ** (i - 1), maxDelayMs)
      onRetry?.(i, err)
      logger.warn({ msg: '[retry] attempt failed', attempt: i, delay, err })
      await sleep(delay)
    }
  }
  throw lastErr
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
