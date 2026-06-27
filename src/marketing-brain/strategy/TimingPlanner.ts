import type { StrategyContext }     from './StrategyContext'
import type { RecommendedSendTime }  from './StrategyResult'

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** Used when no country or business-type knowledge is available. */
const DEFAULT_BEST_DAYS:   string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
const DEFAULT_HOUR_START:  number   = 10
const DEFAULT_HOUR_END:    number   = 12
const DEFAULT_AVOID:       string[] = []

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Determine the optimal send-time window for the first message.
 *
 * Inputs consumed (in priority order):
 *   1. ScenarioKnowledge.sendDelaySeconds — initial delay before sending
 *   2. ScenarioKnowledge.optimalSendHour  — specific hour override (if set)
 *   3. Intersection of CountryKnowledge.bestContactHours and
 *      BusinessTypeKnowledge.bestContactHours — preferred window
 *   4. CountryKnowledge.bestContactDays   — best days of week
 *   5. CountryKnowledge.avoidContactPeriods — cultural/religious exclusions
 *
 * When country or business-type data is unavailable, documented defaults apply.
 *
 * Pure function: no DB access, no side effects.
 */
export function planTiming(ctx: StrategyContext): RecommendedSendTime {
  const { scenarioKnowledge: sk, countryKnowledge: ck, businessTypeKnowledge: bk } = ctx

  // 1. Initial delay from scenario profile
  const initialDelaySeconds = sk?.sendDelaySeconds ?? 0

  // 2. Best days (from country knowledge, fallback to default)
  const bestDays = chooseBestDays(ck?.bestContactDays, bk?.peakDays)

  // 3. Best hour window: intersect country + businessType ranges, fall back to union
  const countryRanges  = parseRanges(ck?.bestContactHours ?? [])
  const bizTypeRanges  = parseRanges(bk?.bestContactHours ?? [])

  const { start: hourStart, end: hourEnd } = chooseHourWindow(
    countryRanges,
    bizTypeRanges,
    bk?.peakHours ?? [],
  )

  // 4. Specific optimal hour from scenario (overrides window when set)
  const optimalHour = sk?.optimalSendHour ?? null

  // 5. Avoid periods from country knowledge
  const avoidPeriods = ck?.avoidContactPeriods ?? DEFAULT_AVOID

  const reason = buildReason(
    ck?.bestContactHours, bk?.bestContactHours, bestDays,
    hourStart, hourEnd, optimalHour, initialDelaySeconds, bk?.peakDays,
  )

  return {
    bestDays,
    bestHourStart: hourStart,
    bestHourEnd:   hourEnd,
    avoidPeriods,
    initialDelaySeconds,
    optimalHour,
    reason,
  }
}

// ─── Hour range parsing ───────────────────────────────────────────────────────

interface HourRange { start: number; end: number }

/**
 * Parse human-readable time range strings into numeric hour boundaries.
 * Accepts: "10:00–12:00", "10:00-12:00", "9h-11h", "09:00–11:00".
 */
function parseRanges(strs: string[]): HourRange[] {
  const result: HourRange[] = []
  for (const s of strs) {
    const match = s.match(/(\d{1,2})[:h]\d{0,2}\s*[–\-]\s*(\d{1,2})/)
    if (match) {
      result.push({ start: parseInt(match[1], 10), end: parseInt(match[2], 10) })
    }
  }
  return result
}

/**
 * Given country-level and business-type-level hour ranges (and peak hours to
 * exclude), find the best overlap window.
 *
 * Strategy:
 *   1. Find the intersection of country and bizType ranges
 *   2. If no intersection, use country ranges only
 *   3. If no country ranges, use bizType ranges
 *   4. Exclude any window that overlaps with peakHours (owners are too busy)
 *   5. Fall back to hardcoded defaults when all else fails
 */
function chooseHourWindow(
  countryRanges: HourRange[],
  bizRanges:     HourRange[],
  peakHours:     string[],
): HourRange {
  const peakRanges = parseRanges(peakHours)

  function overlaps(a: HourRange, b: HourRange): boolean {
    return a.start < b.end && b.start < a.end
  }

  function isInPeak(range: HourRange): boolean {
    return peakRanges.some(p => overlaps(range, p))
  }

  function intersection(a: HourRange, b: HourRange): HourRange | null {
    const start = Math.max(a.start, b.start)
    const end   = Math.min(a.end, b.end)
    return start < end ? { start, end } : null
  }

  // Attempt 1: intersect country × bizType
  if (countryRanges.length && bizRanges.length) {
    const intersections: HourRange[] = []
    for (const c of countryRanges) {
      for (const b of bizRanges) {
        const i = intersection(c, b)
        if (i && !isInPeak(i)) intersections.push(i)
      }
    }
    if (intersections.length) {
      // Pick the widest non-peak intersection
      intersections.sort((a, b) => (b.end - b.start) - (a.end - a.start))
      return intersections[0]!
    }
  }

  // Attempt 2: country ranges only, excluding peak
  const nonPeakCountry = countryRanges.filter(r => !isInPeak(r))
  if (nonPeakCountry.length) return nonPeakCountry[0]!

  // Attempt 3: bizType ranges only, excluding peak
  const nonPeakBiz = bizRanges.filter(r => !isInPeak(r))
  if (nonPeakBiz.length) return nonPeakBiz[0]!

  // Attempt 4: any country or bizType range regardless of peak
  if (countryRanges.length) return countryRanges[0]!
  if (bizRanges.length)     return bizRanges[0]!

  // Fallback to hardcoded default
  return { start: DEFAULT_HOUR_START, end: DEFAULT_HOUR_END }
}

// ─── Best-day selection ───────────────────────────────────────────────────────

/**
 * Build the list of best outreach days by:
 *   1. Using country.bestContactDays as the authoritative source
 *   2. Removing days that appear in businessType.peakDays (owners too busy)
 *   3. Falling back to DEFAULT_BEST_DAYS when no data
 *
 * Result is always sorted Monday → Sunday for determinism.
 */
function chooseBestDays(
  countryBest: string[] | undefined,
  bizPeakDays: string[] | undefined,
): string[] {
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const base = countryBest?.length ? countryBest : DEFAULT_BEST_DAYS
  const peak = new Set((bizPeakDays ?? []).map(d => d.toLowerCase()))

  const filtered = base.filter(d => !peak.has(d.toLowerCase()))
  const result   = filtered.length ? filtered : base  // if ALL days are peak, keep all

  return [...result].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
}

// ─── Reasoning ────────────────────────────────────────────────────────────────

function buildReason(
  countryHours:   string[] | undefined,
  bizHours:       string[] | undefined,
  bestDays:       string[],
  hourStart:      number,
  hourEnd:        number,
  optimalHour:    number | null,
  initialDelay:   number,
  peakDays:       string[] | undefined,
): string {
  const parts: string[] = []

  parts.push(
    initialDelay > 0
      ? `Initial delay: ${initialDelay}s after trigger.`
      : 'Send immediately after trigger.',
  )

  parts.push(
    `Contact window: ${hourStart}:00–${hourEnd}:00 local time` +
    (optimalHour !== null ? ` (optimal hour override: ${optimalHour}:00)` : '') + '.',
  )

  if (countryHours?.length && bizHours?.length) {
    parts.push(
      `Window derived from intersection of country hours [${countryHours.join(', ')}] ` +
      `and business hours [${bizHours.join(', ')}].`,
    )
  } else if (countryHours?.length) {
    parts.push(`Window from country knowledge: [${countryHours.join(', ')}].`)
  } else if (bizHours?.length) {
    parts.push(`Window from business-type knowledge: [${bizHours.join(', ')}].`)
  } else {
    parts.push('Window from default (no country/business-type data).')
  }

  parts.push(`Best days: ${bestDays.join(', ')}.`)
  if (peakDays?.length) {
    parts.push(`Excluded peak days: ${peakDays.join(', ')} (owner is occupied during service).`)
  }

  return parts.join(' ')
}
