'use client'

import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { SeasonEndResult } from '@/engine/core/season-end-processor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface StandingsSummaryProps {
  teams: Team[]
  drivers: Driver[]
  playerTeamId: string
  season: number
  seasonEndResult: SeasonEndResult
  onContinue: () => void
  className?: string
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  return `$${(value / 1_000).toFixed(0)}K`
}

export function StandingsSummary({
  teams, drivers, playerTeamId, season, seasonEndResult, onContinue, className = '',
}: StandingsSummaryProps) {
  const playerTeam = teams.find(t => t.id === playerTeamId)!
  const playerDrivers = drivers
    .filter(d => d.teamId === playerTeamId && !d.isReserve)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)

  const sortedTeams = [...teams].sort((a, b) => b.constructorPoints - a.constructorPoints)
  const sortedDrivers = [...drivers]
    .filter(d => d.teamId && !d.isReserve && !d.isF2)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)

  const prizeMoney = seasonEndResult.prizeMoney[playerTeamId] ?? 0
  const capBreach = seasonEndResult.capBreaches[playerTeamId]

  // Season highlights
  const totalWins = playerDrivers.reduce((s, d) => s + d.seasonStats.wins, 0)
  const totalPodiums = playerDrivers.reduce((s, d) => s + d.seasonStats.podiums, 0)
  const totalDNFs = playerDrivers.reduce((s, d) => s + d.seasonStats.dnfs, 0)

  return (
    <div className={`flex flex-col gap-6 max-w-2xl mx-auto ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
          Season {season} Complete
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">{playerTeam.name}</p>
      </div>

      {/* Player Team Season Summary */}
      <div className="bg-[var(--bg-surface)] border border-[var(--accent-lime)]/20 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-heading font-bold text-[var(--accent-lime)]">
              P{playerTeam.constructorPosition}
            </div>
            <div className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
              Constructor
            </div>
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-[var(--text-primary)]">
              {playerTeam.constructorPoints}
            </div>
            <div className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
              Points
            </div>
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-[var(--accent-cyan)]">
              {totalWins}
            </div>
            <div className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
              Wins
            </div>
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-[var(--accent-amber)]">
              {totalPodiums}
            </div>
            <div className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
              Podiums
            </div>
          </div>
        </div>
      </div>

      {/* Driver Season Stats */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Driver Performance
        </h3>
        {playerDrivers.map(driver => {
          const wdcPos = sortedDrivers.findIndex(d => d.id === driver.id) + 1
          return (
            <div key={driver.id} className="flex items-center justify-between py-2 border-b border-[var(--border-default)] last:border-0">
              <div>
                <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">
                  {driver.firstName} {driver.lastName}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-dim)] ml-2">WDC P{wdcPos}</span>
              </div>
              <div className="flex gap-3 text-[10px] font-mono">
                <span className="text-[var(--accent-lime)]">{driver.seasonStats.points} pts</span>
                <span className="text-[var(--text-secondary)]">{driver.seasonStats.wins}W {driver.seasonStats.podiums}P</span>
                {driver.seasonStats.dnfs > 0 && (
                  <span className="text-[var(--accent-red)]">{driver.seasonStats.dnfs} DNF</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Constructor Standings */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Final Constructor Standings
          </h3>
          <div className="flex flex-col gap-1">
            {sortedTeams.map((team, i) => (
              <div
                key={team.id}
                className={`flex items-center gap-2 text-xs py-0.5 ${team.id === playerTeamId ? 'text-[var(--accent-lime)]' : 'text-[var(--text-secondary)]'}`}
              >
                <span className="w-5 font-mono text-[var(--text-dim)]">{i + 1}</span>
                <div className="w-1.5 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                <span className="flex-1 font-heading">{team.shortName}</span>
                <span className="font-mono">{team.constructorPoints}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Standings (Top 10) */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Driver Championship (Top 10)
          </h3>
          <div className="flex flex-col gap-1">
            {sortedDrivers.slice(0, 10).map((driver, i) => {
              const team = teams.find(t => t.id === driver.teamId)
              const isPlayer = driver.teamId === playerTeamId
              return (
                <div
                  key={driver.id}
                  className={`flex items-center gap-2 text-xs py-0.5 ${isPlayer ? 'text-[var(--accent-lime)]' : 'text-[var(--text-secondary)]'}`}
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

      {/* Financial Summary */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Financial Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-[var(--text-dim)]">Prize Money</div>
            <div className="text-sm font-mono text-[var(--accent-lime)]">{formatMoney(prizeMoney)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-dim)]">Budget Cap Status</div>
            <div className="text-sm font-mono">
              {capBreach?.breached ? (
                <span className="text-[var(--accent-red)]">BREACH — {capBreach.penaltyTier}</span>
              ) : (
                <span className="text-[var(--accent-lime)]">Under Cap</span>
              )}
            </div>
          </div>
        </div>
        {capBreach?.breached && (
          <div className="mt-2 text-[10px] text-[var(--accent-red)]">
            Penalty: -{capBreach.pointsDeduction} constructor points
          </div>
        )}
      </div>

      {/* Highlight Reel */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Season Highlights
        </h3>
        <div className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
          {totalWins > 0 && <Highlight icon="W" text={`${totalWins} race ${totalWins === 1 ? 'win' : 'wins'}`} color="var(--accent-lime)" />}
          {totalPodiums > 0 && <Highlight icon="P" text={`${totalPodiums} podium ${totalPodiums === 1 ? 'finish' : 'finishes'}`} color="var(--accent-cyan)" />}
          {totalDNFs > 0 && <Highlight icon="X" text={`${totalDNFs} retirement${totalDNFs === 1 ? '' : 's'}`} color="var(--accent-red)" />}
          {playerTeam.constructorPosition === 1 && <Highlight icon="C" text="Constructors' Champions!" color="var(--accent-lime)" />}
          {sortedDrivers[0]?.teamId === playerTeamId && <Highlight icon="D" text="Drivers' Champion!" color="var(--accent-lime)" />}
        </div>
      </div>

      {/* Continue */}
      <div className="flex justify-center">
        <Button size="lg" onClick={onContinue}>
          Continue to Season {season + 1}
        </Button>
      </div>
    </div>
  )
}

function Highlight({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: `${color}20`, color }}>
        {icon}
      </span>
      <span>{text}</span>
    </div>
  )
}
