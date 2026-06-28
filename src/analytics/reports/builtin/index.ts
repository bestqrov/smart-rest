import { registerReport } from '../ReportRegistry'
import type { ReportDefinition } from '../../types'

// ─── Built-in report definitions ─────────────────────────────────────────────

const BUILTIN_REPORTS: ReportDefinition[] = [
  {
    id:          'platform-overview',
    name:        'Platform Overview',
    description: 'High-level KPIs across all SmartSuite modules',
    module:      'platform',
    defaultPeriod: '30d',
    tags:        ['superadmin', 'kpi', 'platform'],
    metrics: [
      'restaurants.total',
      'restaurants.active',
      'restaurants.new_30d',
      'billing.mrr',
      'billing.arr',
      'billing.active_subs',
      'billing.churn_risk',
      'ai.jobs_completed',
      'ai.cost_total',
      'certification.avg_score',
      'certification.gold_plus',
      'marketing.campaigns_completed',
      'orders.total_30d',
    ],
  },

  {
    id:          'billing-overview',
    name:        'Billing Overview',
    description: 'Revenue, subscriptions, and churn indicators',
    module:      'billing',
    defaultPeriod: 'month',
    tags:        ['superadmin', 'billing', 'revenue'],
    metrics: [
      'billing.mrr',
      'billing.arr',
      'billing.active_subs',
      'billing.trial',
      'billing.grace_period',
      'billing.suspended',
      'billing.churn_risk',
      'billing.avg_monthly_fee',
    ],
  },

  {
    id:          'ai-usage',
    name:        'AI Usage Report',
    description: 'AI job execution, token consumption, cost, and performance',
    module:      'ai',
    defaultPeriod: '30d',
    tags:        ['superadmin', 'ai', 'cost'],
    metrics: [
      'ai.jobs_completed',
      'ai.jobs_failed',
      'ai.jobs_running',
      'ai.jobs_queued',
      'ai.tokens_total',
      'ai.cost_total',
      'ai.avg_duration_ms',
      'ai.success_rate',
    ],
  },

  {
    id:          'marketing-performance',
    name:        'Marketing Performance',
    description: 'Campaign creation, completion rate, and success metrics',
    module:      'marketing',
    defaultPeriod: '30d',
    tags:        ['superadmin', 'marketing'],
    metrics: [
      'marketing.campaigns_total',
      'marketing.campaigns_completed',
      'marketing.campaigns_failed',
      'marketing.success_rate',
    ],
  },

  {
    id:          'certification-overview',
    name:        'Certification Overview',
    description: 'Certification scores, level distribution, and quality metrics',
    module:      'certification',
    defaultPeriod: '30d',
    tags:        ['superadmin', 'certification', 'quality'],
    metrics: [
      'certification.evaluations',
      'certification.avg_score',
      'certification.gold_plus',
      'certification.platinum_plus',
    ],
  },

  {
    id:          'restaurant-activity',
    name:        'Restaurant Activity',
    description: 'Restaurant growth, order volumes, and platform adoption',
    module:      'restaurants',
    defaultPeriod: '30d',
    tags:        ['superadmin', 'restaurants', 'growth'],
    metrics: [
      'restaurants.total',
      'restaurants.active',
      'restaurants.new_today',
      'restaurants.new_30d',
      'orders.total_30d',
      'orders.revenue_30d',
    ],
  },
]

export function registerBuiltinReports(): void {
  for (const report of BUILTIN_REPORTS) {
    registerReport(report)
  }
}

export { BUILTIN_REPORTS }
