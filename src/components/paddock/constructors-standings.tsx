import type { Team } from '@/types/team'
import type { CSSProperties } from 'react'

interface ConstructorsStandingsProps {
  teams: Team[]
  playerTeamId: string
  /** Number of teams to render at the top of the table (default 6). */
  topN?: number
}

export function ConstructorsStandings({ teams, playerTeamId, topN = 6 }: ConstructorsStandingsProps) {
  const sorted = [...teams]
    .filter(t => t.constructorPosition > 0)
    .sort((a, b) => a.constructorPosition - b.constructorPosition)
    .slice(0, topN)

  // Fallback for round 1 before any post-race pass has populated positions.
  const rows = sorted.length > 0
    ? sorted
    : [...teams].sort((a, b) => b.constructorPoints - a.constructorPoints).slice(0, topN)

  return (
    <div className="pd-standings" role="table" aria-label="Constructors' championship standings">
      <div className="pd-panel-head">
        <div className="ph-title">Constructors&apos; Championship</div>
        <div className="ph-sub">TOP {topN}</div>
      </div>
      {rows.map((team, i) => {
        const pos = team.constructorPosition > 0 ? team.constructorPosition : i + 1
        const delta = team.previousConstructorPosition > 0
          ? team.previousConstructorPosition - pos
          : 0
        const deltaCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
        const deltaLabel = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '—'
        return (
          <div
            key={team.id}
            className={`pd-std-row ${team.id === playerTeamId ? 'is-player' : ''}`}
            style={{ '--team-color': team.color } as CSSProperties}
            role="row"
          >
            <div className={`pd-std-pos ${pos === 1 ? 'leader' : ''}`}>{pos}</div>
            <div className="pd-std-team" />
            <div className="pd-std-name">{team.name.toUpperCase()}</div>
            <div className="pd-std-pts">{team.constructorPoints}</div>
            <div className={`pd-std-delta ${deltaCls}`}>{deltaLabel}</div>
          </div>
        )
      })}
    </div>
  )
}
