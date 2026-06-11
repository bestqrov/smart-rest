import type { Tenant } from '../types'

interface Props {
  tenant: Tenant
}

interface Step {
  label: string
  done:  boolean
}

function getSteps(t: Tenant): Step[] {
  return [
    { label: 'منيو',     done: t._count.categories > 0 },
    { label: 'طاولات',   done: t._count.tables > 0 },
    { label: 'موظفين',   done: t._count.staff > 0 },
    { label: 'طلبية',    done: t._count.orders > 0 },
    { label: 'فاتورة',   done: t.subscriptionTier != null },
  ]
}

export default function OnboardingProgress({ tenant }: Props) {
  const steps    = getSteps(tenant)
  const done     = steps.filter(s => s.done).length
  const pct      = Math.round((done / steps.length) * 100)
  const complete = done === steps.length

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-400' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[10px] font-bold ${complete ? 'text-emerald-400' : 'text-amber-400'}`}>
          {done}/{steps.length}
        </span>
      </div>
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <span
            key={i}
            title={s.label}
            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              s.done
                ? 'bg-emerald-900/60 text-emerald-400'
                : 'bg-gray-800 text-gray-600'
            }`}
          >
            {s.done ? '✓' : '○'} {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
