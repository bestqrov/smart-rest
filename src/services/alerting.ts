/**
 * Minimal production error alerting — fire-and-forget webhook notification
 * for crashes and unhandled 5xx errors, so a production incident doesn't
 * go unnoticed until someone happens to read the logs.
 *
 * Mirrors the existing fireBillingWebhook pattern in
 * src/cron/dailyDebtDetection.ts (same fetch-and-swallow-errors shape,
 * same "skip silently if unconfigured" behavior) rather than introducing
 * a new integration/dependency (Sentry etc). No secrets are sent — only
 * the error message and minimal routing context, never the full error
 * object, request body, or stack trace.
 *
 * Non-blocking by design: callers must NOT `await` this in a request path.
 * It never throws.
 */
import logger from '../logger'

export function sendErrorAlert(source: string, message: string, extra?: Record<string, string | number | undefined>): void {
  if (process.env.NODE_ENV !== 'production') return

  const webhook = process.env.N8N_ERROR_WEBHOOK
  if (!webhook) return

  fetch(webhook, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event:     'APP_ERROR',
      source,
      message,
      ...extra,
      timestamp: new Date().toISOString(),
    }),
  }).catch(err => {
    logger.warn({ msg: 'Error alert webhook failed', source, err })
  })
}
