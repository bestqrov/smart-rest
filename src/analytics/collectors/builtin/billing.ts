import type { CollectorDefinition, CollectedData, Period } from '../../types'

async function collect(period: Period): Promise<CollectedData> {
  const { default: prisma } = await import('../../../prisma')

  // BillingStatus enum: GRACE_PERIOD (trial/new), COLLECTING_DEBT (paying),
  //                     PAST_DUE (overdue grace), SUSPENDED (halted)
  const [
    activeSubs,
    gracePeriod,    // GRACE_PERIOD = new/trial accounts
    pastDue,        // PAST_DUE = overdue — churn risk
    suspended,
    mrrAgg,
    avgFeeAgg,
  ] = await Promise.all([
    prisma.cafe.count({ where: { billingStatus: 'COLLECTING_DEBT' } }),
    prisma.cafe.count({ where: { billingStatus: 'GRACE_PERIOD' } }),
    prisma.cafe.count({ where: { billingStatus: 'PAST_DUE' } }),
    prisma.cafe.count({ where: { billingStatus: 'SUSPENDED' } }),
    prisma.cafe.aggregate({
      where: { billingStatus: 'COLLECTING_DEBT', monthlyFee: { not: null } },
      _sum: { monthlyFee: true },
    }),
    prisma.cafe.aggregate({
      where: { billingStatus: 'COLLECTING_DEBT', monthlyFee: { not: null } },
      _avg: { monthlyFee: true },
    }),
  ])

  const mrr = (mrrAgg as any)._sum?.monthlyFee ?? 0

  return {
    module:      'billing',
    collectedAt: new Date(),
    period,
    data: {
      'billing.active_subs':     activeSubs,
      'billing.trial':           gracePeriod,    // GRACE_PERIOD = trial/new
      'billing.grace_period':    pastDue,        // PAST_DUE = past-due grace window
      'billing.suspended':       suspended,
      'billing.churn_risk':      pastDue + suspended,
      'billing.mrr':             mrr,
      'billing.arr':             mrr * 12,
      'billing.avg_monthly_fee': (avgFeeAgg as any)._avg?.monthlyFee ?? null,
    },
  }
}

export const BILLING_COLLECTOR: CollectorDefinition = {
  module:  'billing',
  name:    'Billing Collector',
  collect,
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
}
