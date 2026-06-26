'use client'

import { memo } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// ISO-3166 alpha-2 → alpha-3 mapping for countries we care about
const COUNTRY_A3: Record<string, string> = {
  MA: 'MAR', DZ: 'DZA', TN: 'TUN', EG: 'EGY', LY: 'LBY', MR: 'MRT',
  SA: 'SAU', AE: 'ARE', QA: 'QAT', KW: 'KWT', BH: 'BHR', OM: 'OMN', JO: 'JOR',
  FR: 'FRA', ES: 'ESP', BE: 'BEL', DE: 'DEU', GB: 'GBR', CA: 'CAN', US: 'USA',
  SN: 'SEN', CI: 'CIV', ML: 'MLI',
}

// Country centroids [lng, lat] for marker placement
const CENTROIDS: Record<string, [number, number]> = {
  MA: [-7.1, 31.8], DZ: [3, 28], TN: [9.5, 34], EG: [30, 26],
  SA: [45, 24], AE: [54, 24], QA: [51.2, 25.3], FR: [2.2, 46.2],
  ES: [-3.7, 40.4], US: [-100, 38], CA: [-96, 56], GB: [-1.5, 52],
}

interface Props {
  tenants: { country?: string }[]
}

function countByCountry(tenants: { country?: string }[]) {
  const map: Record<string, number> = {}
  for (const t of tenants) {
    if (t.country) map[t.country] = (map[t.country] ?? 0) + 1
  }
  return map
}

function fillColor(count: number) {
  if (count >= 5)  return '#3b82f6'   // blue-500
  if (count >= 3)  return '#60a5fa'   // blue-400
  if (count >= 1)  return '#93c5fd'   // blue-300
  return '#1e293b'                     // slate-800 default
}

export default memo(function ClientsMap({ tenants }: Props) {
  const counts = countByCountry(tenants)
  const activeCountries = new Set(Object.keys(counts).map(k => COUNTRY_A3[k]).filter(Boolean))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm">Client Distribution</h3>
          <p className="text-gray-500 text-xs">{Object.keys(counts).length} countries · {tenants.length} restaurants</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> 5+</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" /> 3–4</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-300 inline-block" /> 1–2</span>
        </div>
      </div>

      <div className="relative" style={{ height: 300 }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 140, center: [20, 20] }}
          style={{ width: '100%', height: '100%', background: '#0f172a' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const a3  = geo.id as string
                // reverse lookup a2 from a3
                const a2  = Object.entries(COUNTRY_A3).find(([, v]) => v === a3)?.[0]
                const cnt = a2 ? (counts[a2] ?? 0) : 0
                const isActive = activeCountries.has(a3)
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor(cnt)}
                    stroke="#0f172a"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none', opacity: isActive ? 1 : 0.4 },
                      hover:   { outline: 'none', fill: isActive ? '#2563eb' : '#1e293b', opacity: 1 },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>

          {/* Markers with count badges */}
          {Object.entries(counts).map(([a2, cnt]) => {
            const coords = CENTROIDS[a2]
            if (!coords) return null
            return (
              <Marker key={a2} coordinates={coords}>
                <circle r={cnt > 1 ? 10 : 7} fill="#1d4ed8" stroke="#93c5fd" strokeWidth={1.5} />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  style={{ fontFamily: 'system-ui', fontSize: cnt > 1 ? 9 : 8, fill: 'white', fontWeight: 700 }}
                >
                  {cnt}
                </text>
              </Marker>
            )
          })}
        </ComposableMap>
      </div>
    </div>
  )
})
