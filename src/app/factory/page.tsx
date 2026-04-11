'use client'

import { useGameStore } from '@/stores/game-store'
import { useRequireGame, useGameSlice } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { RadarChart } from '@/components/charts/radar-chart'
import { ComponentStatus } from '@/components/factory/component-status'
import { TechTree } from '@/components/factory/tech-tree'
import { AeroAllocation } from '@/components/factory/aero-allocation'
import { calculateOverallRating } from '@/engine/engineering/car-performance'

export default function FactoryPage() {
  useRequireGame() // guard only
  const allocateRnD = useGameStore((s) => s.allocateRnD)
  const pauseRnD = useGameStore((s) => s.pauseRnD)

  const slice = useGameSlice((w) => ({
    teams: w.teams,
    playerTeamId: w.gameState.playerTeamId,
  }))

  if (!slice) return null

  const playerTeam = slice.teams.find((t) => t.id === slice.playerTeamId)!
  const overallRating = calculateOverallRating(playerTeam.car)

  return (
    <PageShell>
      {/* Top: Car Performance + Components */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Car Performance
            <span className="ml-2 text-[var(--accent-lime)] font-mono">{overallRating}</span>
          </h3>
          <RadarChart data={playerTeam.car as unknown as Record<string, number>} color="var(--accent-lime)" className="max-w-[250px] mx-auto" />
        </div>
        <div className="flex flex-col gap-6">
          <ComponentStatus components={playerTeam.components} />
          <AeroAllocation
            windTunnelUsed={playerTeam.windTunnelHoursUsed}
            windTunnelLimit={playerTeam.windTunnelHoursLimit}
            cfdUsed={playerTeam.cfdRunsUsed}
            cfdLimit={playerTeam.cfdRunsLimit}
          />
        </div>
      </div>

      {/* R&D Tech Tree */}
      <div className="mb-6">
        <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4">
          R&D Development
        </h2>
        <TechTree
          upgrades={playerTeam.rndUpgrades}
          onStart={allocateRnD}
          onPause={pauseRnD}
        />
      </div>
    </PageShell>
  )
}
