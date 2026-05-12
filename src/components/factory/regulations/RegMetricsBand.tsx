'use client'

import { useState } from 'react'
import { useGameSlice } from '@/hooks/use-require-game'
import {
  activeAeroMaturity,
  hybridEfficiencyScore,
  grid2026AdoptionRank,
} from '@/engine/engineering/regulation-metrics'
import { REG_2026, type RegId } from '@/data/regulations/2026-rules'
import { RegMetricTile } from './RegMetricTile'

export function RegMetricsBand() {
  const [openReg, setOpenReg] = useState<RegId | null>(null)
  const slice = useGameSlice((w) => ({
    teams: w.teams,
    playerTeamId: w.gameState.playerTeamId,
  }))

  if (!slice) return null
  const playerTeam = slice.teams.find((t) => t.id === slice.playerTeamId)
  if (!playerTeam) return null

  const maturity = activeAeroMaturity(playerTeam)
  const hybrid = hybridEfficiencyScore(playerTeam)
  const { rank, of } = grid2026AdoptionRank(slice.teams, slice.playerTeamId)

  const handleSeeAlso = (id: RegId) => setOpenReg((curr) => (curr === id ? null : id))
  const openEntry = openReg ? REG_2026[openReg] : null

  return (
    <section className="reg-band" aria-labelledby="reg-band-title">
      <header id="reg-band-title" className="reg-band-title">2026 READINESS</header>
      <div className="reg-band-grid">
        <RegMetricTile
          label="Active Aero Maturity"
          value={maturity}
          suffix="%"
          footnote="Aero-branch R&D progress against the 2026 active-aero ruleset."
          regSeeAlso="active-aero"
          onSeeAlso={handleSeeAlso}
        />
        <RegMetricTile
          label="Hybrid Efficiency"
          value={hybrid}
          suffix="%"
          footnote="Composite of PU R&D, reliability, and power axis."
          regSeeAlso="hybrid-50-50"
          onSeeAlso={handleSeeAlso}
        />
        <RegMetricTile
          label="Grid 2026 Adoption Rank"
          value={rank}
          prefix="P"
          ofValue={of}
          footnote="Where you sit among 2026-readiness peers."
          regSeeAlso="active-aero"
          onSeeAlso={handleSeeAlso}
        />
      </div>
      {openEntry && (
        <div className="reg-band-briefing" data-testid="reg-band-briefing">
          <span className="reg-band-briefing-tag">{openEntry.ribbon}</span>
          <p className="reg-band-briefing-text">{openEntry.briefing}</p>
        </div>
      )}
    </section>
  )
}
