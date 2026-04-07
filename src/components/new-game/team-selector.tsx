'use client'

import { TEAMS, type TeamData } from '@/data/teams'
import { DRIVERS } from '@/data/drivers'
import { Card } from '@/components/ui/card'

interface TeamSelectorProps {
  selectedTeamId: string | null
  onSelect: (teamId: string) => void
}

export function TeamSelector({ selectedTeamId, onSelect }: TeamSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {TEAMS.map((team) => {
        const isSelected = selectedTeamId === team.id
        const drivers = team.driverIds.map(id =>
          DRIVERS.find(d => d.id === id)
        ).filter(Boolean)

        return (
          <button
            key={team.id}
            onClick={() => onSelect(team.id)}
            className={`
              text-left rounded-lg p-3
              border transition-all duration-150 outline-none
              focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
              ${isSelected
                ? 'border-[var(--accent-lime)] bg-[var(--accent-lime)]/[0.04] shadow-[0_0_20px_rgba(204,255,0,0.08)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
              }
            `}
          >
            {/* Color swatch + name */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-sm font-heading font-bold text-[var(--text-primary)] truncate">
                {team.name}
              </span>
            </div>

            {/* Drivers */}
            <div className="space-y-0.5 mb-2">
              {drivers.map((d) => (
                <div key={d!.id} className="text-xs text-[var(--text-secondary)]">
                  {d!.firstName} {d!.lastName}
                </div>
              ))}
            </div>

            {/* Power Unit */}
            <div className="text-[10px] text-[var(--text-dim)] font-mono uppercase">
              PU: {team.powerUnitSupplier}
            </div>
          </button>
        )
      })}
    </div>
  )
}
