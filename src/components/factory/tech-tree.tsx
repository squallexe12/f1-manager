'use client'

import type { RndUpgrade } from '@/types/team'
import { TechNode } from './tech-node'
import { BranchHeader } from './branch-header'

interface TechTreeProps {
  upgrades: RndUpgrade[]
  onStart?: (id: string) => void
  onPause?: (id: string) => void
  /** Upgrade id currently recommended by the Technical Director, if any */
  recommendedUpgradeId?: string
}

const BRANCH_CONFIG = [
  { key: 'chassis' as const, label: 'CHASSIS', color: 'var(--sig-green)' },
  { key: 'power-unit' as const, label: 'POWER UNIT', color: 'var(--sig-cyan)' },
  { key: 'active-aero' as const, label: 'ACTIVE AERO', color: 'var(--sig-purple)' },
]

export function TechTree({ upgrades, onStart, onPause, recommendedUpgradeId }: TechTreeProps) {
  return (
    <div className="tree-grid">
      {BRANCH_CONFIG.map(({ key, label, color }) => {
        const branchUpgrades = upgrades.filter((u) => u.branch === key)
        const completed = branchUpgrades.filter((u) => u.status === 'complete').length
        const active = branchUpgrades.some((u) => u.status === 'in-progress')

        return (
          <div key={key} className="branch-col">
            <BranchHeader
              label={label}
              color={color}
              completed={completed}
              total={branchUpgrades.length}
              active={active}
            />
            {branchUpgrades.map((u) => (
              <TechNode
                key={u.id}
                upgrade={u}
                onStart={onStart}
                onPause={onPause}
                recommended={u.id === recommendedUpgradeId}
                branchColor={color}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
