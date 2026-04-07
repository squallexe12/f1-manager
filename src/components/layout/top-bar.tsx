'use client'

import { useGameStore } from '@/stores/game-store'

export function TopBar() {
  const world = useGameStore((s) => s.world)

  if (!world) return null

  const { gameState, teams, calendar } = world
  const playerTeam = teams.find((t) => t.id === gameState.playerTeamId)
  const currentRace = calendar[gameState.currentRound - 1]

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-default)]">
      <div className="flex items-center justify-between max-w-5xl mx-auto px-4 h-12">
        {/* Left: Team + Season */}
        <div className="flex flex-col">
          <span
            className="text-sm font-heading font-bold tracking-wide"
            style={{ color: playerTeam?.color ?? 'var(--text-primary)' }}
          >
            {playerTeam?.shortName ?? 'TEAM'}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            S{gameState.season} R{gameState.currentRound}/{gameState.totalRaces}
          </span>
        </div>

        {/* Center: Race name */}
        <div className="text-xs font-heading text-[var(--text-secondary)] uppercase tracking-wider">
          {currentRace?.name ?? 'Off Season'}
        </div>

        {/* Right: Phase */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--accent-cyan)] uppercase">
            {gameState.phase.replace('-', ' ')}
          </span>
        </div>
      </div>
    </header>
  )
}
