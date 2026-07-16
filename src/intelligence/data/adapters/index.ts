// Same registration idiom as analytics/collectors/builtin/index.ts.
import { registerDataAdapter } from '../DataAdapterRegistry'
import { billingAdapter }  from './billingAdapter'
import { reviewsAdapter }  from './reviewsAdapter'
import { feedbackAdapter } from './feedbackAdapter'
import { seoAdapter }      from './seoAdapter'
import { usageAdapter }    from './usageAdapter'

const BUILTIN_DATA_ADAPTERS = [billingAdapter, reviewsAdapter, feedbackAdapter, seoAdapter, usageAdapter]

export function registerBuiltinDataAdapters(): void {
  for (const adapter of BUILTIN_DATA_ADAPTERS) {
    registerDataAdapter(adapter)
  }
}

export { billingAdapter, reviewsAdapter, feedbackAdapter, seoAdapter, usageAdapter }
