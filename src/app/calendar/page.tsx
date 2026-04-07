'use client'

import { useState } from 'react'
import { useRequireGame } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { Badge } from '@/components/ui/badge'
import type { Race } from '@/types/race'

// Country flag emoji map
const COUNTRY_FLAGS: Record<string, string> = {
  Australia: '🇦🇺', China: '🇨🇳', Japan: '🇯🇵', Bahrain: '🇧🇭',
  'Saudi Arabia': '🇸🇦', USA: '🇺🇸', Italy: '🇮🇹', Monaco: '🇲🇨',
  Canada: '🇨🇦', Spain: '🇪🇸', Austria: '🇦🇹', 'Great Britain': '🇬🇧',
  Belgium: '🇧🇪', Netherlands: '🇳🇱', Azerbaijan: '🇦🇿', Singapore: '🇸🇬',
  Mexico: '🇲🇽', Brazil: '🇧🇷', 'United Arab Emirates': '🇦🇪',
  'United Kingdom': '🇬🇧',
}

export default function CalendarPage() {
  const world = useRequireGame()
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)

  if (!world) return null

  const { gameState, calendar, drivers, teams } = world
  const currentRound = gameState.currentRound
  const playerTeam = teams.find(t => t.id === gameState.playerTeamId)!

  // Get results for completed races (simplified: use driver season stats)
  const playerDrivers = drivers.filter(d => d.teamId === playerTeam.id && !d.isReserve)

  return (
    <PageShell>
      <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4">
        Season {gameState.season} Calendar
      </h2>

      {/* Season Progress */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent-lime)] rounded-full transition-[width] duration-500"
            style={{ width: `${((currentRound - 1) / calendar.length) * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-[var(--text-dim)]">
          {currentRound - 1}/{calendar.length} completed
        </span>
      </div>

      {/* Race Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
        {calendar.map((race) => {
          const isCompleted = race.round < currentRound
          const isCurrent = race.round === currentRound
          const flag = COUNTRY_FLAGS[race.circuit.country] ?? '🏁'

          return (
            <button
              key={race.id}
              onClick={() => setSelectedRace(selectedRace?.id === race.id ? null : race)}
              className={`
                text-left p-3 rounded-lg border transition-colors duration-150
                outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
                ${isCurrent
                  ? 'bg-[var(--accent-lime)]/[0.06] border-[var(--accent-lime)]/40'
                  : isCompleted
                    ? 'bg-white/[0.02] border-[var(--border-default)] opacity-70'
                    : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--border-hover)]'
                }
                ${selectedRace?.id === race.id ? 'ring-1 ring-[var(--accent-cyan)]' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[var(--text-dim)] w-5">
                    R{race.round}
                  </span>
                  <span className="text-sm">{flag}</span>
                  <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">
                    {race.circuit.country}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {race.isSprint && <Badge variant="cyan">Sprint</Badge>}
                  {isCurrent && <Badge variant="lime">Next</Badge>}
                  {isCompleted && <Badge variant="neutral">Done</Badge>}
                </div>
              </div>

              <div className="text-[10px] text-[var(--text-secondary)] mb-1.5">
                {race.name}
              </div>

              {/* Circuit characteristics */}
              <div className="flex gap-2 text-[9px] font-mono text-[var(--text-dim)]">
                <span>{race.circuit.laps} laps</span>
                <span>DF:{race.circuit.downforceLevel[0].toUpperCase()}</span>
                <span>TW:{race.circuit.tireWear[0].toUpperCase()}</span>
                <span>OT:{race.circuit.overtakingDifficulty[0].toUpperCase()}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected Race Detail Panel */}
      {selectedRace && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)] mb-3">
            {selectedRace.name}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <DetailCell label="Country" value={selectedRace.circuit.country} />
            <DetailCell label="Laps" value={String(selectedRace.circuit.laps)} />
            <DetailCell label="Downforce" value={selectedRace.circuit.downforceLevel} />
            <DetailCell label="Tire Wear" value={selectedRace.circuit.tireWear} />
            <DetailCell label="Overtaking" value={selectedRace.circuit.overtakingDifficulty} />
            <DetailCell label="Weather" value={selectedRace.circuit.weatherVariability} />
            <DetailCell label="Format" value={selectedRace.isSprint ? 'Sprint Weekend' : 'Standard'} />
            <DetailCell
              label="Compounds"
              value={selectedRace.circuit.compounds.join(' / ')}
            />
          </div>

          {/* Completed race result placeholder */}
          {selectedRace.round < currentRound && (
            <div className="border-t border-[var(--border-default)] pt-3">
              <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
                Race completed
              </span>
            </div>
          )}
        </div>
      )}

      {/* Standings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {/* Constructor Standings */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Constructor Standings
          </h3>
          <div className="flex flex-col gap-1.5">
            {[...teams]
              .sort((a, b) => b.constructorPoints - a.constructorPoints)
              .slice(0, 11)
              .map((team, i) => (
                <div
                  key={team.id}
                  className={`flex items-center gap-2 text-xs ${team.id === playerTeam.id ? 'text-[var(--accent-lime)]' : 'text-[var(--text-secondary)]'}`}
                >
                  <span className="w-5 font-mono text-[var(--text-dim)]">{i + 1}</span>
                  <div className="w-1.5 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                  <span className="flex-1 font-heading">{team.shortName}</span>
                  <span className="font-mono">{team.constructorPoints}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Driver Standings */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Driver Standings
          </h3>
          <div className="flex flex-col gap-1.5">
            {[...drivers]
              .filter(d => d.teamId && !d.isReserve && !d.isF2)
              .sort((a, b) => b.seasonStats.points - a.seasonStats.points)
              .slice(0, 10)
              .map((driver, i) => {
                const team = teams.find(t => t.id === driver.teamId)
                const isPlayerDriver = driver.teamId === playerTeam.id
                return (
                  <div
                    key={driver.id}
                    className={`flex items-center gap-2 text-xs ${isPlayerDriver ? 'text-[var(--accent-lime)]' : 'text-[var(--text-secondary)]'}`}
                  >
                    <span className="w-5 font-mono text-[var(--text-dim)]">{i + 1}</span>
                    <div className="w-1.5 h-3 rounded-full" style={{ backgroundColor: team?.color ?? '#666' }} />
                    <span className="flex-1 font-heading">{driver.shortName}</span>
                    <span className="font-mono">{driver.seasonStats.points}</span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-heading uppercase tracking-wider text-[var(--text-dim)] mb-0.5">
        {label}
      </div>
      <div className="text-xs font-mono text-[var(--text-secondary)] capitalize">{value}</div>
    </div>
  )
}
