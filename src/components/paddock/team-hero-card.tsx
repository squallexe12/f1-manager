import type { Team } from '@/types/team'
import type { FinanceState } from '@/types/finance'
import type { CSSProperties } from 'react'

interface TeamHeroCardProps {
  team: Team
  finance: FinanceState
  carRating: number
  round: number
  totalRounds: number
  phaseLabel: string
  season: number
}

function trendSymbol(delta: number): string {
  if (delta > 0) return '▲'
  if (delta < 0) return '▼'
  return '—'
}

function trendClass(delta: number): 'up' | 'down' | 'flat' {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

function darkenHex(hex: string): string {
  // Simple 40% darken for the team-card radial backdrop.
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = Math.round(parseInt(m.slice(0, 2), 16) * 0.4)
  const g = Math.round(parseInt(m.slice(2, 4), 16) * 0.4)
  const b = Math.round(parseInt(m.slice(4, 6), 16) * 0.4)
  return `rgb(${r}, ${g}, ${b})`
}

export function TeamHeroCard({
  team, finance, carRating, round, totalRounds, phaseLabel, season,
}: TeamHeroCardProps) {
  // Constructor position trend: prior minus current → positive = gained places.
  const posDelta = team.previousConstructorPosition > 0
    ? team.previousConstructorPosition - team.constructorPosition
    : 0
  // Morale trend: current minus previous → positive = rising morale.
  const moraleDelta = team.morale - team.previousMorale

  const budgetRemainingM = Math.round(
    (finance.budget.cap - finance.budget.totalSpent) / 1_000_000,
  )
  const capM = Math.round(finance.budget.cap / 1_000_000)
  const monogram = team.name.charAt(0).toUpperCase()
  const posLabel = team.constructorPosition > 0 ? `P${team.constructorPosition}` : '—'
  const prevRound = round > 1 ? `R${String(round - 1).padStart(2, '0')}` : 'start'

  return (
    <div
      className="pd-team-card"
      style={{
        '--team-color': team.color,
        '--team-dark': darkenHex(team.color),
      } as CSSProperties}
    >
      <div className="pd-team-head">
        <div className="pd-team-monogram" aria-hidden>{monogram}</div>
        <div className="pd-team-text">
          <div className="pd-team-name">{team.name.toUpperCase()}</div>
          <div className="pd-team-sub">
            SEASON {String(season).padStart(2, '0')} · ROUND {String(round).padStart(2, '0')}/{totalRounds} · {phaseLabel}
          </div>
        </div>
      </div>

      <div className="pd-kpi-grid" role="list">
        <div className="pd-kpi" role="listitem">
          <div className="k">Constructor</div>
          <div className="v">{posLabel}</div>
          <div className={`trend ${trendClass(posDelta)}`}>
            {trendSymbol(posDelta)} {posDelta !== 0 ? `${posDelta > 0 ? '+' : ''}${posDelta} vs ${prevRound}` : `flat vs ${prevRound}`}
          </div>
        </div>

        <div className="pd-kpi" role="listitem">
          <div className="k">Car Rating</div>
          <div className="v accent">{carRating}<span className="u">/100</span></div>
          <div className="pd-kpi-bar"><div className="fill" style={{ width: `${carRating}%` }} /></div>
        </div>

        <div className="pd-kpi" role="listitem">
          <div className="k">Budget Left</div>
          <div className="v green">${budgetRemainingM}<span className="u">M</span></div>
          <div className="trend flat">of ${capM}M cap</div>
        </div>

        <div className="pd-kpi" role="listitem">
          <div className="k">Morale</div>
          <div className="v amber">{team.morale}</div>
          <div className={`trend ${trendClass(moraleDelta)}`}>
            {trendSymbol(moraleDelta)} {moraleDelta !== 0 ? `${moraleDelta > 0 ? '+' : ''}${moraleDelta} this week` : 'flat this week'}
          </div>
        </div>
      </div>
    </div>
  )
}
