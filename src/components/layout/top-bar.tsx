'use client'

import { useGameStore } from '@/stores/game-store'
import { useShallow } from 'zustand/react/shallow'

export function TopBar() {
  const data = useGameStore(
    useShallow((s) => {
      if (!s.world) return null
      const { gameState, teams, calendar } = s.world
      const playerTeam = teams.find((t) => t.id === gameState.playerTeamId)
      return {
        teamShortName: playerTeam?.shortName ?? 'TEAM',
        teamColor: playerTeam?.color ?? 'var(--text-primary)',
        season: gameState.season,
        currentRound: gameState.currentRound,
        totalRaces: gameState.totalRaces,
        phase: gameState.phase,
        raceName: calendar[gameState.currentRound - 1]?.name ?? 'Off Season',
      }
    })
  )

  if (!data) return null

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-default)]">
      <div className="flex items-center justify-between w-full max-w-[var(--shell-max,64rem)] mx-auto px-4 h-12">
        {/* Left: Team + Season */}
        <div className="flex flex-col">
          <span
            className="text-sm font-heading font-bold tracking-wide"
            style={{ color: data.teamColor }}
          >
            {data.teamShortName}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            S{data.season} R{data.currentRound}/{data.totalRaces}
          </span>
        </div>

        {/* Center: Race name */}
        <div className="text-xs font-heading text-[var(--text-secondary)] uppercase tracking-wider">
          {data.raceName}
        </div>

        {/* Right: Phase */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--accent-cyan)] uppercase">
            {data.phase.replace('-', ' ')}
          </span>
        </div>
      </div>
    </header>
  )
}
