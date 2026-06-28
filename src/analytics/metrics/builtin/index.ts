import { registerMetric } from '../MetricRegistry'
import type { MetricDefinition } from '../../types'

// ─── Platform-wide built-in metrics ──────────────────────────────────────────

const BUILTIN_METRICS: MetricDefinition[] = [

  // ── Restaurant module ──────────────────────────────────────────────────────
  {
    id: 'restaurants.total', module: 'restaurants', category: 'volume',
    name: 'Total Restaurants', description: 'All restaurants on the platform',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['platform', 'restaurants'],
  },
  {
    id: 'restaurants.active', module: 'restaurants', category: 'volume',
    name: 'Active Restaurants', description: 'Restaurants with isActive = true',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['platform', 'restaurants'],
  },
  {
    id: 'restaurants.new_today', module: 'restaurants', category: 'growth',
    name: 'New Restaurants Today', description: 'Restaurants created today',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['platform', 'restaurants', 'growth'],
  },
  {
    id: 'restaurants.new_30d', module: 'restaurants', category: 'growth',
    name: 'New Restaurants (30d)', description: 'Restaurants created in the last 30 days',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['platform', 'restaurants', 'growth'],
  },
  {
    id: 'orders.total_30d', module: 'restaurants', category: 'operations',
    name: 'Total Orders (30d)', description: 'Total orders placed across the platform in 30 days',
    unit: 'count', aggregationType: 'SUM', enabled: true, tags: ['orders', 'restaurants'],
  },
  {
    id: 'orders.revenue_30d', module: 'restaurants', category: 'revenue',
    name: 'Order Revenue (30d)', description: 'Sum of order revenue in 30 days (MAD)',
    unit: 'currency', aggregationType: 'SUM', enabled: true, tags: ['orders', 'revenue'],
  },

  // ── Billing module ─────────────────────────────────────────────────────────
  {
    id: 'billing.mrr', module: 'billing', category: 'revenue',
    name: 'Monthly Recurring Revenue', description: 'MRR from active paying subscribers (MAD)',
    unit: 'currency', aggregationType: 'LATEST', enabled: true, tags: ['billing', 'revenue', 'kpi'],
  },
  {
    id: 'billing.arr', module: 'billing', category: 'revenue',
    name: 'Annual Recurring Revenue', description: 'ARR = MRR × 12 (MAD)',
    unit: 'currency', aggregationType: 'LATEST', enabled: true, tags: ['billing', 'revenue', 'kpi'],
  },
  {
    id: 'billing.active_subs', module: 'billing', category: 'subscriptions',
    name: 'Active Subscriptions', description: 'Cafes with billingStatus = COLLECTING_DEBT',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['billing', 'kpi'],
  },
  {
    id: 'billing.trial', module: 'billing', category: 'subscriptions',
    name: 'Trial Accounts', description: 'Cafes on free trial',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['billing'],
  },
  {
    id: 'billing.grace_period', module: 'billing', category: 'subscriptions',
    name: 'Grace Period Accounts', description: 'Cafes in grace period (payment overdue)',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['billing', 'risk'],
  },
  {
    id: 'billing.suspended', module: 'billing', category: 'subscriptions',
    name: 'Suspended Accounts', description: 'Cafes with suspended access',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['billing', 'risk'],
  },
  {
    id: 'billing.churn_risk', module: 'billing', category: 'risk',
    name: 'Churn Risk (grace + suspended)', description: 'Combined grace + suspended count',
    unit: 'count', aggregationType: 'SUM', enabled: true, tags: ['billing', 'risk', 'kpi'],
  },
  {
    id: 'billing.avg_monthly_fee', module: 'billing', category: 'revenue',
    name: 'Average Monthly Fee', description: 'Mean monthly fee across active subs (MAD)',
    unit: 'currency', aggregationType: 'AVG', enabled: true, tags: ['billing', 'revenue'],
  },

  // ── AI module ──────────────────────────────────────────────────────────────
  {
    id: 'ai.jobs_completed', module: 'ai', category: 'usage',
    name: 'AI Jobs Completed', description: 'Total completed AI jobs in period',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['ai', 'usage'],
  },
  {
    id: 'ai.jobs_failed', module: 'ai', category: 'usage',
    name: 'AI Jobs Failed', description: 'Total failed AI jobs in period',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['ai', 'usage'],
  },
  {
    id: 'ai.jobs_running', module: 'ai', category: 'usage',
    name: 'AI Jobs Running', description: 'Currently running AI jobs (snapshot)',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['ai', 'operations'],
  },
  {
    id: 'ai.jobs_queued', module: 'ai', category: 'usage',
    name: 'AI Jobs Queued', description: 'Currently queued AI jobs (snapshot)',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['ai', 'operations'],
  },
  {
    id: 'ai.tokens_total', module: 'ai', category: 'usage',
    name: 'Total Tokens Consumed', description: 'Sum of tokens across all completed jobs in period',
    unit: 'tokens', aggregationType: 'SUM', enabled: true, tags: ['ai', 'cost', 'kpi'],
  },
  {
    id: 'ai.cost_total', module: 'ai', category: 'cost',
    name: 'Total AI Cost (USD)', description: 'Sum of estimatedCost across completed jobs in period',
    unit: 'currency', aggregationType: 'SUM', enabled: true, tags: ['ai', 'cost', 'kpi'],
  },
  {
    id: 'ai.avg_duration_ms', module: 'ai', category: 'performance',
    name: 'Avg Job Duration (ms)', description: 'Mean completion time of AI jobs',
    unit: 'ms', aggregationType: 'AVG', enabled: true, tags: ['ai', 'performance'],
  },
  {
    id: 'ai.success_rate', module: 'ai', category: 'performance',
    name: 'AI Success Rate (%)', description: 'Completed / (Completed + Failed) × 100',
    unit: 'percentage', aggregationType: 'PERCENTAGE', enabled: true,
    denominator: 'ai.jobs_completed', tags: ['ai', 'performance', 'kpi'],
  },

  // ── Marketing module ───────────────────────────────────────────────────────
  {
    id: 'marketing.campaigns_total', module: 'marketing', category: 'volume',
    name: 'Total Campaigns', description: 'Total campaigns created in period',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['marketing'],
  },
  {
    id: 'marketing.campaigns_completed', module: 'marketing', category: 'volume',
    name: 'Campaigns Completed', description: 'Campaigns with status = published',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['marketing', 'kpi'],
  },
  {
    id: 'marketing.campaigns_failed', module: 'marketing', category: 'volume',
    name: 'Campaigns Failed', description: 'Campaigns with status = failed',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['marketing', 'risk'],
  },
  {
    id: 'marketing.success_rate', module: 'marketing', category: 'performance',
    name: 'Campaign Success Rate (%)', description: 'Completed / Total × 100',
    unit: 'percentage', aggregationType: 'PERCENTAGE', enabled: true,
    denominator: 'marketing.campaigns_total', tags: ['marketing', 'performance'],
  },

  // ── Automation module ──────────────────────────────────────────────────────
  {
    id: 'automation.executions', module: 'automation', category: 'usage',
    name: 'Automation Executions', description: 'Total workflow automation executions in period',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['automation'],
  },
  {
    id: 'automation.executions_failed', module: 'automation', category: 'usage',
    name: 'Automation Failures', description: 'Failed automation executions in period',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['automation', 'risk'],
  },

  // ── Certification module ───────────────────────────────────────────────────
  {
    id: 'certification.evaluations', module: 'certification', category: 'usage',
    name: 'Certification Evaluations', description: 'Total evaluations run in period',
    unit: 'count', aggregationType: 'COUNT', enabled: true, tags: ['certification'],
  },
  {
    id: 'certification.avg_score', module: 'certification', category: 'quality',
    name: 'Average Certification Score (%)', description: 'Mean score across all completed evaluations',
    unit: 'percentage', aggregationType: 'AVG', enabled: true, tags: ['certification', 'kpi'],
  },
  {
    id: 'certification.gold_plus', module: 'certification', category: 'quality',
    name: 'Gold+ Certified', description: 'Restaurants with GOLD, PLATINUM, or DIAMOND certification',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['certification', 'kpi'],
  },
  {
    id: 'certification.platinum_plus', module: 'certification', category: 'quality',
    name: 'Platinum+ Certified', description: 'Restaurants with PLATINUM or DIAMOND certification',
    unit: 'count', aggregationType: 'LATEST', enabled: true, tags: ['certification'],
  },
]

export function registerBuiltinMetrics(): void {
  for (const metric of BUILTIN_METRICS) {
    registerMetric(metric)
  }
}

export { BUILTIN_METRICS }
