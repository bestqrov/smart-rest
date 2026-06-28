import type { CollectorDefinition, CollectedData, Period } from '../../types'

// Automation module is not yet fully built. This collector returns null values
// and will be replaced once AutomationExecution model is available.
async function collect(period: Period): Promise<CollectedData> {
  return {
    module:      'automation',
    collectedAt: new Date(),
    period,
    data: {
      'automation.executions':        null,
      'automation.executions_failed': null,
    },
  }
}

export const AUTOMATION_COLLECTOR: CollectorDefinition = {
  module:  'automation',
  name:    'Automation Collector',
  collect,
  metrics: [
    'automation.executions',
    'automation.executions_failed',
  ],
}
