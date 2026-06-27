import type { Channel } from '../models/MessageTemplate'
import type { StrategyContext } from './StrategyContext'
import type { ChannelPlan } from './StrategyResult'
import type { ContactChannel } from '../knowledge/types'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Channels the platform can actually send on (PHONE is contact-only). */
const SENDABLE: Channel[] = ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH']

/**
 * Default channel priority when no knowledge is available.
 * WhatsApp is overwhelmingly preferred for B2B outreach in MENA.
 */
const DEFAULT_CHANNEL_PRIORITY: Channel[] = ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH']

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Decide the primary and secondary outreach channels.
 *
 * Resolution order:
 *   1. Caller-specified channel in DecisionContext (explicit intent)
 *   2. Persona's idealChannel (persona-level preference)
 *   3. Country's preferredChannels (market-level preference, filtered to sendable)
 *   4. Global default (WHATSAPP first)
 *
 * Secondary channel = next viable sendable channel after the primary,
 * from the same preference list.
 *
 * Pure function: no DB access, no side effects.
 */
export function planChannels(ctx: StrategyContext): ChannelPlan {
  const { decisionContext: dctx, personaKnowledge: pk, countryKnowledge: ck } = ctx

  // Build an ordered preference list from all available signals
  const preference = buildPreference(dctx.channel, pk?.idealChannel, ck?.preferredChannels)

  const primary   = preference[0]!
  const secondary = preference[1] ?? null

  // Explain the switch condition
  const switchCondition = buildSwitchCondition(primary, secondary, ctx)

  // Build human-readable reason
  const reason = buildReason(primary, secondary, dctx.channel, pk?.idealChannel, ck?.preferredChannels)

  return { primaryChannel: primary, secondaryChannel: secondary, switchCondition, reason }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build a deduplicated, sendable-only channel preference list.
 *
 * Order of preference signals:
 *   - Explicit channel from caller → pinned to position 0
 *   - Persona ideal channel
 *   - Country preferred channels (filtered to sendable)
 *   - Global default fallback
 *
 * If the caller specified a channel, it goes first even if persona/country
 * prefer something different — caller intent overrides all.
 */
function buildPreference(
  explicit:  Channel | undefined,
  persona:   Channel | undefined,
  country:   ContactChannel[] | undefined,
): Channel[] {
  const seen = new Set<Channel>()
  const result: Channel[] = []

  function add(ch: Channel | ContactChannel | undefined) {
    if (!ch) return
    if (ch === 'PHONE') return          // not sendable
    if (!SENDABLE.includes(ch as Channel)) return
    if (seen.has(ch as Channel)) return
    seen.add(ch as Channel)
    result.push(ch as Channel)
  }

  // 1. Explicit caller request (highest authority)
  add(explicit)

  // 2. Persona ideal
  add(persona)

  // 3. Country preference list (in order)
  country?.forEach(add)

  // 4. Global fallback (fills any remaining slots)
  DEFAULT_CHANNEL_PRIORITY.forEach(add)

  return result
}

function buildSwitchCondition(
  primary:   Channel,
  secondary: Channel | null,
  ctx:       StrategyContext,
): string {
  if (!secondary) {
    return 'No secondary channel available — escalate to human if primary fails.'
  }

  const urgency  = ctx.scenarioKnowledge?.urgency  ?? 'MEDIUM'
  const daysMap: Record<string, number> = {
    CRITICAL: 1,
    HIGH:     2,
    MEDIUM:   3,
    LOW:      5,
  }
  const days = daysMap[urgency] ?? 3

  return (
    `Switch to ${secondary} if no reply on ${primary} after ${days} day(s) ` +
    `(urgency: ${urgency}).`
  )
}

function buildReason(
  primary:    Channel,
  secondary:  Channel | null,
  explicit:   Channel | undefined,
  persona:    Channel | undefined,
  country:    ContactChannel[] | undefined,
): string {
  const parts: string[] = []

  if (explicit) {
    parts.push(`Primary '${primary}' was explicitly requested by caller.`)
  } else if (persona && primary === persona) {
    parts.push(`Primary '${primary}' matches persona's idealChannel.`)
  } else if (country?.includes(primary)) {
    parts.push(`Primary '${primary}' is the top sendable channel for this country.`)
  } else {
    parts.push(`Primary '${primary}' selected from global defaults (no persona/country data).`)
  }

  if (secondary) {
    parts.push(`Secondary '${secondary}' is the next preferred sendable channel.`)
  } else {
    parts.push('No secondary channel (only one sendable option available).')
  }

  return parts.join(' ')
}
