'use client'

import type { RaceResult } from '@/engine/core/post-race-processor'
import type { Driver } from '@/types/driver'
import type { Team } from '@/types/team'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ResultsSummaryProps {
  results: RaceResult[]
  drivers: Driver[]
  teams: Team[]
  playerTeamId: string
  raceName: string
  isSprint: boolean
  onContinue: () => void
  className?: string
}

const RACE_POINTS: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
  6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

const SPRINT_POINTS: Record<number, number> = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4,
  6: 3, 7: 2, 8: 1,
}

export function ResultsSummary({ results, drivers, teams, playerTeamId, raceName, isSprint, onContinue, className = '' }: ResultsSummaryProps) {
  const pointsTable = isSprint ? SPRINT_POINTS : RACE_POINTS
  const playerDrivers = drivers.filter(d => d.teamId === playerTeamId && !d.isReserve)
  const playerTeam = teams.find(t => t.id === playerTeamId)!
  const sortedResults = [...results].sort((a, b) => a.position - b.position)

  // Player results
  const playerResults = sortedResults.filter(r =>
    playerDrivers.some(d => d.id === r.driverId)
  )

  const totalPoints = playerResults.reduce((sum, r) => {
    const pts = pointsTable[r.position] ?? 0
    const fl = r.fastestLap && r.position <= 10 ? 1 : 0
    return sum + pts + fl
  }, 0)

  return (
    <div className={`flex flex-col gap-6 max-w-lg mx-auto ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
          {isSprint ? 'Sprint' : 'Race'} Complete
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">{raceName}</p>
      </div>

      {/* Player Team Results */}
      <div className="bg-[var(--bg-surface)] border border-[var(--accent-lime)]/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-6 rounded-full" style={{ backgroundColor: playerTeam.color }} />
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {playerTeam.name}
          </h3>
          <span className="ml-auto text-sm font-mono font-bold text-[var(--accent-lime)]">
            +{totalPoints} pts
          </span>
        </div>

        {playerResults.map(result => {
          const driver = drivers.find(d => d.id === result.driverId)!
          const pts = pointsTable[result.position] ?? 0
          const flBonus = result.fastestLap && result.position <= 10 ? 1 : 0

          return (
            <div key={result.driverId} className="flex items-center justify-between py-2 border-t border-[var(--border-default)]">
              <div className="flex items-center gap-3">
                <span className="text-lg font-heading font-bold text-[var(--accent-lime)]">
                  P{result.position}
                </span>
                <div>
                  <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">
                    {driver.firstName} {driver.lastName}
                  </span>
                  {result.dnf && <Badge variant="red" className="ml-2">DNF</Badge>}
                  {result.fastestLap && <Badge variant="cyan" className="ml-2">FL</Badge>}
                </div>
              </div>
              <span className="text-xs font-mono text-[var(--text-secondary)]">
                +{pts + flBonus}
              </span>
            </div>
          )
        })}

        {/* Mood changes */}
        <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
          <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Morale Impact</span>
          <div className="flex gap-4 mt-1">
            {playerResults.map(result => {
              const driver = drivers.find(d => d.id === result.driverId)!
              const isGood = result.position <= 10 && !result.dnf
              return (
                <div key={result.driverId} className="text-[10px]">
                  <span className="text-[var(--text-secondary)]">{driver.shortName}: </span>
                  <span className={isGood ? 'text-[var(--accent-lime)]' : 'text-[var(--accent-red)]'}>
                    {isGood ? 'Positive' : 'Negative'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Championship Impact */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Championship Standing
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Constructor Position</span>
          <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
            P{playerTeam.constructorPosition}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-[var(--text-secondary)]">Total Points</span>
          <span className="text-sm font-mono text-[var(--accent-lime)]">
            {playerTeam.constructorPoints}
          </span>
        </div>
      </div>

      {/* Continue */}
      <div className="flex justify-center">
        <Button size="lg" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  )
}
