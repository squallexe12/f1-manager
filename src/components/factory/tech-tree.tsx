'use client'

import type { RndUpgrade } from '@/types/team'
import { TechNode } from './tech-node'

interface TechTreeProps {
  upgrades: RndUpgrade[]
  onStart?: (id: string) => void
  onPause?: (id: string) => void
  className?: string
}

const BRANCH_CONFIG = [
  { key: 'chassis' as const, label: 'Chassis', color: 'var(--accent-lime)' },
  { key: 'power-unit' as const, label: 'Power Unit', color: 'var(--accent-cyan)' },
  { key: 'active-aero' as const, label: 'Active Aero', color: 'var(--accent-purple)' },
]

export function TechTree({ upgrades, onStart, onPause, className = '' }: TechTreeProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {BRANCH_CONFIG.map(({ key, label, color }) => {
        const branchUpgrades = upgrades.filter(u => u.branch === key)

        return (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider" style={{ color }}>
                {label}
              </h3>
            </div>
            {branchUpgrades.map((upgrade) => (
              <TechNode
                key={upgrade.id}
                upgrade={upgrade}
                onStart={onStart}
                onPause={onPause}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
