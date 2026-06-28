import type { AggregationType, AggregationResult, Period, CollectedData } from '../types'
import { previousPeriod } from './periods'

// ─── Core math operations ─────────────────────────────────────────────────────

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0
  return sum(values) / values.length
}

export function count(values: (number | null)[]): number {
  return values.filter(v => v !== null).length
}

export function min(values: number[]): number {
  return values.length === 0 ? 0 : Math.min(...values)
}

export function max(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values)
}

export function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10   // 1 decimal place
}

export function trend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

// ─── Apply aggregation type ───────────────────────────────────────────────────

export function applyAggregation(type: AggregationType, values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return null

  switch (type) {
    case 'SUM':     return sum(nums)
    case 'AVG':     return Math.round(avg(nums) * 100) / 100
    case 'COUNT':   return count(values)
    case 'MIN':     return min(nums)
    case 'MAX':     return max(nums)
    case 'LATEST':  return nums[nums.length - 1]
    // PERCENTAGE and TREND handled separately (need context)
    case 'PERCENTAGE': return sum(nums)   // caller computes using denominator
    case 'TREND':      return null        // caller computes using previous period
    default:        return null
  }
}

// ─── Build AggregationResult from collected data ──────────────────────────────

export function buildResult(
  metricId: string,
  period:   Period,
  value:    number | null,
  prevValue?: number | null,
): AggregationResult {
  const trendValue = (value !== null && prevValue !== null && prevValue !== undefined)
    ? trend(value, prevValue)
    : undefined

  return {
    metricId,
    period,
    value,
    trend:       trendValue,
    collectedAt: new Date(),
  }
}

// ─── Aggregate a single metric from a CollectedData batch ─────────────────────

export function extractMetric(
  metricId: string,
  datasets: CollectedData[],
  aggType:  AggregationType,
): number | null {
  const values = datasets.map(d => d.data[metricId] ?? null)
  return applyAggregation(aggType, values)
}
