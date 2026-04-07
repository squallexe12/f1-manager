'use client'

import type { Driver } from '@/types/driver'
import { Badge } from '@/components/ui/badge'

interface ScoutPanelProps {
  availableDrivers: Driver[]
  className?: string
}

export function ScoutPanel({ availableDrivers, className = '' }: ScoutPanelProps) {
  const sorted = [...availableDrivers].sort((a, b) =>
    (b.attributes.pace + b.attributes.developmentPotential) -
    (a.attributes.pace + a.attributes.developmentPotential)
  )

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Available Drivers ({sorted.length})
      </h3>
      <div className="flex flex-col gap-2">
        {sorted.map((driver) => (
          <div
            key={driver.id}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 hover:border-[var(--border-hover)] transition-colors duration-150"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-heading font-semibold text-[var(--text-primary)]">
                {driver.firstName} {driver.lastName}
              </span>
              <Badge variant={driver.isF2 ? 'purple' : 'cyan'}>
                {driver.isF2 ? 'F2' : 'Reserve'}
              </Badge>
            </div>
            <div className="flex gap-3 text-[10px] text-[var(--text-muted)] mb-2">
              <span>{driver.nationality}</span>
              <span>Age {driver.age}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
              <div>
                <span className="text-[var(--text-dim)]">PAC </span>
                <span className="text-[var(--text-secondary)]">{driver.attributes.pace}</span>
              </div>
              <div>
                <span className="text-[var(--text-dim)]">RCR </span>
                <span className="text-[var(--text-secondary)]">{driver.attributes.racecraft}</span>
              </div>
              <div>
                <span className="text-[var(--text-dim)]">POT </span>
                <span className="text-[var(--accent-lime)]">{driver.attributes.developmentPotential}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
