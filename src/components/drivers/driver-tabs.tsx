'use client'

import type { Driver } from '@/types/driver'
import { computeDriverOvr } from '@/lib/utils/driver-ovr'

export type TabId = 'CAR-01' | 'CAR-02' | 'RESERVE'

interface DriverTabsProps {
  roster: { car01: Driver | null; car02: Driver | null; reserve: Driver | null }
  teamColor: string
  active: TabId
  onChange: (id: TabId) => void
}

export function DriverTabs({ roster, teamColor, active, onChange }: DriverTabsProps) {
  const items: Array<{ id: TabId; slot: string; name: string; ovr: number }> = [
    roster.car01 && { id: 'CAR-01' as const, slot: 'CAR-01', name: `${roster.car01.firstName.toUpperCase()} ${roster.car01.lastName.toUpperCase()}`, ovr: computeDriverOvr(roster.car01.attributes) },
    roster.car02 && { id: 'CAR-02' as const, slot: 'CAR-02', name: `${roster.car02.firstName.toUpperCase()} ${roster.car02.lastName.toUpperCase()}`, ovr: computeDriverOvr(roster.car02.attributes) },
    roster.reserve && { id: 'RESERVE' as const, slot: 'RESERVE', name: `${roster.reserve.firstName.toUpperCase()} ${roster.reserve.lastName.toUpperCase()}`, ovr: computeDriverOvr(roster.reserve.attributes) },
  ].filter(Boolean) as Array<{ id: TabId; slot: string; name: string; ovr: number }>

  return (
    <div className="drv-tabs" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(it => {
        const isActive = active === it.id
        return (
          <button
            key={it.id}
            className={`drv-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(it.id)}
            style={{ ['--team' as string]: teamColor }}
          >
            <span className="t-bar" />
            <span className="t-body">
              <span className="t-slot">{it.slot}</span>
              <span className="t-name">{it.name}</span>
            </span>
            <span className="t-stat">
              <span className="ovr">{it.ovr}</span>
              OVR
            </span>
          </button>
        )
      })}
    </div>
  )
}
