'use client'

interface PageHeaderProps {
  teamName: string
  season: number
  round: number
  nextRound: { id: string; name: string } | null
  constructorPos: number
  rosterCount: { active: number; reserve: number }
}

export function PageHeader({ teamName, season, round, nextRound, constructorPos, rosterCount }: PageHeaderProps) {
  return (
    <div className="drv-head">
      <div>
        <div className="h-eyebrow">◉ DRIVERS · {teamName.toUpperCase()} · S{season} R{String(round).padStart(2, '0')}</div>
        <div className="h-title">Driver Command</div>
      </div>
      <div className="h-meta">
        <div>
          <span className="k">NEXT EVENT</span>
          <span className="v">{nextRound ? `${nextRound.id} · ${nextRound.name}` : '—'}</span>
        </div>
        <div>
          <span className="k">CONSTRUCTORS</span>
          <span className="v amber">P{constructorPos}</span>
        </div>
        <div>
          <span className="k">ROSTER</span>
          <span className="v green">{rosterCount.active}+{rosterCount.reserve}R</span>
        </div>
      </div>
    </div>
  )
}
