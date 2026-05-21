/**
 * Email service — magic link delivery via Resend SMTP.
 * Falls back to console logging when SMTP env vars are not set (local dev).
 *
 * Required .env vars:
 *   SMTP_HOST=smtp.resend.com
 *   SMTP_PORT=465
 *   SMTP_USER=resend
 *   SMTP_PASS=re_xxxxxxxxxxxxxxxxxxxx
 *   RESEND_FROM=Smart Resto <noreply@yourdomain.com>
 */

import nodemailer from 'nodemailer'
import logger from '../logger'
import { t, type Lang, isRTL } from '../lib/i18n'

// ─── Transport (singleton) ────────────────────────────────────────────────────

const {
  SMTP_HOST = 'smtp.resend.com',
  SMTP_PORT = '465',
  SMTP_USER = 'resend',
  SMTP_PASS,
  RESEND_FROM = 'Smart Resto <noreply@smartrestau.digima.cloud>',
} = process.env

const transporter = SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,   // TLS on port 465, STARTTLS on 587
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null

// ─── HTML template (RTL/LTR aware) ───────────────────────────────────────────

function buildEmailHtml(magicLink: string, lang: Lang, cafeName: string): string {
  const dir      = isRTL(lang) ? 'rtl' : 'ltr'
  const align    = isRTL(lang) ? 'right' : 'left'
  const fallback = lang === 'ar' ? 'أو انسخ هذا الرابط:'
                 : lang === 'fr' ? 'Ou copiez ce lien :'
                 : lang === 'es' ? 'O copia este enlace:'
                 :                 'Or copy this link:'

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t('email_subject', lang)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:36px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">☾</div>
            <div style="color:#ffffff;font-size:22px;font-weight:800;">Smart Resto</div>
            <div style="color:#fef3c7;font-size:13px;margin-top:4px;">${t('brand_tagline', lang)}</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;text-align:${align};">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#111827;">${t('email_greeting', lang)}</h1>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">
              ${cafeName ? `<strong style="color:#111827;">${cafeName}</strong> — ` : ''}${t('email_body', lang)}
            </p>
            <p style="margin:0 0 32px;color:#9ca3af;font-size:13px;">${t('email_expire_note', lang)}</p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="text-align:center;">
                <a href="${magicLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:14px;">
                  ${t('email_cta', lang)}
                </a>
              </td></tr>
            </table>

            <!-- Fallback URL -->
            <p style="margin:28px 0 0;color:#9ca3af;font-size:12px;word-break:break-all;text-align:${align};">
              ${fallback}<br/>
              <a href="${magicLink}" style="color:#f59e0b;">${magicLink}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:24px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">${t('email_ignore', lang)}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SendMagicLinkOptions {
  to:        string
  magicLink: string
  lang:      Lang
  cafeName?: string
}

export async function sendMagicLink({ to, magicLink, lang, cafeName = '' }: SendMagicLinkOptions): Promise<void> {
  const subject = t('email_subject', lang)
  const html    = buildEmailHtml(magicLink, lang, cafeName)

  if (!transporter) {
    logger.info({
      msg:       '📧 [DEV] Magic link — SMTP_PASS not set, logging link here',
      to,
      magicLink,
      lang,
    })
    return
  }

  await transporter.sendMail({ from: RESEND_FROM, to, subject, html })
  logger.info({ msg: 'Magic link sent via SMTP', to, lang })
}
