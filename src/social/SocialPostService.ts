// ─── Social Media Automation Engine (K27) ──────────────────────────────────
// MarketingCampaign already covers AI video generation + publishing via the
// n8n webhook / Upload-Post.com pipeline (routes/marketing.ts POST
// /generate-video, PATCH /campaigns/:id/status) — untouched, still the only
// way videos get made. This is the generalized layer that pipeline was
// missing: a queue/schedule/retry/history model for social posts, reusing
// the exact same n8n webhook as the one and only publish mechanism (no
// second per-platform integration — Upload-Post.com already fans out to
// whichever platforms the n8n workflow is configured for).

import prisma from '../prisma'
import logger from '../logger'
import { publishStandardEvent } from '../core'

const MAX_RETRIES = 3
const WEBHOOK_TIMEOUT_MS = 12_000

export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'snapchat' | 'linkedin' | 'x'
export type SocialContentType = 'VIDEO' | 'IMAGE' | 'TEXT'

export interface QueuePostInput {
  platform:         SocialPlatform
  contentType?:     SocialContentType
  caption:          string
  mediaUrl?:        string
  sourceCampaignId?: string
  scheduledFor?:    Date
}

// ─── Core dispatch — the only function that fires the n8n webhook ─────────
// Same fetch/timeout/error-handling shape already used by routes/marketing.ts
// generate-video, generalized for any queued post instead of duplicated per
// call site.
async function dispatch(postId: string) {
  const post = await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } })
  const webhookUrl = process.env.N8N_MARKETING_WEBHOOK_URL

  if (!webhookUrl) {
    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data:  { status: 'FAILED', error: 'N8N_MARKETING_WEBHOOK_URL not configured' },
    })
    publishStandardEvent('SocialPostFailed', { tenantId: post.cafeId, resourceId: postId, metadata: { platform: post.platform } }, 'social-engine')
    return updated
  }

  await prisma.socialPost.update({ where: { id: postId }, data: { status: 'PUBLISHING' } })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        socialPostId: post.id,
        cafeId:       post.cafeId,
        platform:     post.platform,
        contentType:  post.contentType,
        caption:      post.caption,
        mediaUrl:     post.mediaUrl,
        campaignId:   post.sourceCampaignId,
        callbackUrl:  `${process.env.NEXT_PUBLIC_SOCKET_URL || ''}/api/marketing/social-posts/${post.id}/status`,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`n8n webhook returned ${res.status}`)

    // n8n calls the /status callback asynchronously once Upload-Post.com
    // confirms — this just marks that dispatch succeeded, not that the post
    // is live yet (mirrors MarketingCampaign's pending -> rendering -> published).
    logger.info({ msg: '[SocialPostService] dispatched to n8n', postId, platform: post.platform })
    return post
  } catch (err: any) {
    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data:  { status: 'FAILED', error: err.message ?? 'Unknown error' },
    })
    publishStandardEvent('SocialPostFailed', { tenantId: post.cafeId, resourceId: postId, metadata: { platform: post.platform, error: err.message } }, 'social-engine')
    return updated
  }
}

// ─── Queue (immediate or scheduled) — the AI-ready content queue ──────────
export async function queuePost(cafeId: string, input: QueuePostInput) {
  const post = await prisma.socialPost.create({
    data: {
      cafeId,
      platform:         input.platform,
      contentType:      input.contentType ?? 'TEXT',
      caption:          input.caption,
      mediaUrl:         input.mediaUrl,
      sourceCampaignId: input.sourceCampaignId,
      scheduledFor:     input.scheduledFor,
      status:           input.scheduledFor && input.scheduledFor > new Date() ? 'SCHEDULED' : 'QUEUED',
    },
  })

  publishStandardEvent('SocialPostQueued', {
    tenantId: cafeId, resourceId: post.id, metadata: { platform: input.platform, scheduled: !!input.scheduledFor },
  }, 'social-engine')

  if (post.status === 'SCHEDULED') return post
  return dispatch(post.id)
}

// ─── Publish-status callback (called by n8n, same pattern as ─────────────
// MarketingCampaign's PATCH /campaigns/:id/status) ──────────────────────────
export async function recordPublishResult(postId: string, status: 'PUBLISHED' | 'FAILED', externalPostId?: string, error?: string) {
  const updated = await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status,
      externalPostId,
      error,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
    },
  })
  publishStandardEvent(status === 'PUBLISHED' ? 'SocialPostPublished' : 'SocialPostFailed', {
    tenantId: updated.cafeId, resourceId: postId, metadata: { externalPostId, error },
  }, 'social-engine')
  return updated
}

// ─── Retry ──────────────────────────────────────────────────────────────────
export async function retryPost(postId: string) {
  const post = await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } })
  if (post.status !== 'FAILED') throw new Error(`Post ${postId} is not FAILED (status: ${post.status})`)
  if (post.retryCount >= MAX_RETRIES) throw new Error(`Post ${postId} exceeded max retries (${MAX_RETRIES})`)

  await prisma.socialPost.update({ where: { id: postId }, data: { retryCount: { increment: 1 }, status: 'QUEUED', error: null } })
  return dispatch(postId)
}

// ─── Scheduled post processing (cron-callable) ─────────────────────────────
export async function processScheduledPosts(): Promise<number> {
  const due = await prisma.socialPost.findMany({
    where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
  })
  for (const post of due) await dispatch(post.id)
  return due.length
}

// ─── Publish history ──────────────────────────────────────────────────────
export async function listPosts(cafeId: string, status?: string) {
  return prisma.socialPost.findMany({
    where:   { cafeId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}

// ─── Unified social account management ─────────────────────────────────────
// Reads the existing flat per-platform credential fields on Cafe — no new
// storage, just a clean "what's connected" view.
export async function getConnectedPlatforms(cafeId: string): Promise<Record<SocialPlatform, boolean>> {
  const cafe = await prisma.cafe.findUniqueOrThrow({
    where:  { id: cafeId },
    select: { fbAccessToken: true, igUserId: true, tiktokAccessToken: true, snapAccessToken: true, linkedinAccessToken: true, xAccessToken: true },
  })
  return {
    facebook:  !!cafe.fbAccessToken,
    instagram: !!cafe.igUserId,
    tiktok:    !!cafe.tiktokAccessToken,
    snapchat:  !!cafe.snapAccessToken,
    linkedin:  !!cafe.linkedinAccessToken,
    x:         !!cafe.xAccessToken,
  }
}
