/**
 * Resend Webhook — delivery/open/click/bounce tracking (K26)
 *
 * Configure this URL in the Resend dashboard, with RESEND_WEBHOOK_SECRET set
 * as a custom header (Resend lets you add custom headers to webhook config).
 * Same shared-secret pattern already used for the n8n webhooks in this
 * codebase (e.g. routes/customers.ts's x-n8n-secret) rather than full Svix
 * signature verification, to keep this addition minimal.
 */

import express, { Request, Response } from 'express'
import logger from '../logger'
import { recordProviderEvent } from '../email/EmailEngine'

const router = express.Router()

router.post('/api/webhooks/resend', async (req: Request, res: Response) => {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET
    if (secret && req.headers['x-resend-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { type, data } = req.body as { type?: string; data?: { email_id?: string } }
    const providerId = data?.email_id
    if (!providerId) return res.json({ ok: true })

    const typeMap: Record<string, 'delivered' | 'opened' | 'clicked' | 'bounced'> = {
      'email.delivered': 'delivered',
      'email.opened':    'opened',
      'email.clicked':   'clicked',
      'email.bounced':   'bounced',
    }
    const mapped = type ? typeMap[type] : undefined
    if (mapped) await recordProviderEvent(providerId, mapped)

    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'POST /api/webhooks/resend error', err })
    return res.status(500).json({ error: 'Failed to process webhook' })
  }
})

export default router
