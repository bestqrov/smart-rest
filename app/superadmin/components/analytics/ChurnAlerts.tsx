import type { Tenant } from '../types'

interface Props {
  tenants:     Tenant[]
  onOpenModal: (tenant: Tenant) => void
}

export default function ChurnAlerts({ tenants, onOpenModal }: Props) {
  const at_risk = tenants.filter(t => !t.isDemo && t._count.orders === 0 && t.billingStatus !== 'SUSPENDED')

  if (at_risk.length === 0) return null

  return (
    <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">⚠️</span>
        <h3 className="text-red-400 font-bold text-sm">
          {at_risk.length} مطعم بدون أي طلبية
        </h3>
        <span className="text-gray-600 text-xs">— تحتاج متابعة</span>
      </div>
      <div className="space-y-2">
        {at_risk.slice(0, 5).map(t => (
          <div key={t.id} className="flex items-center justify-between bg-red-950/30 rounded-xl px-3 py-2">
            <div>
              <span className="text-white text-xs font-bold">{t.businessName || t.name}</span>
              <span className="text-gray-600 text-xs mr-2">· {t.subdomain}</span>
            </div>
            <button
              onClick={() => onOpenModal(t)}
              className="text-[10px] font-bold bg-red-700 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg transition-colors"
            >
              متابعة
            </button>
          </div>
        ))}
        {at_risk.length > 5 && (
          <p className="text-gray-600 text-xs text-center">+ {at_risk.length - 5} أخرى</p>
        )}
      </div>
    </div>
  )
}
