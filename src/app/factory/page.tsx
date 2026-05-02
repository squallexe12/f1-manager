'use client'

import { useGameStore } from '@/stores/game-store'
import { useRequireGame, useGameSlice } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { FactoryHeader } from '@/components/factory/factory-header'
import { CarPerformanceCard } from '@/components/factory/car-performance-card'
import { PowerUnitCard } from '@/components/factory/power-unit-card'
import { AeroCard } from '@/components/factory/aero-card'
import { PitCrewCard } from '@/components/factory/pit-crew-card'
import { RdPipelineHeader } from '@/components/factory/rd-pipeline-header'
import { RdQueue } from '@/components/factory/rd-queue'
import { TechTree } from '@/components/factory/tech-tree'
import { calculateOverallRating } from '@/engine/engineering/car-performance'
import {
  peerAveragedAxes,
  peerRank,
  projectNextChange,
  atrCoefficientForPosition,
  nextDeliveryRound,
  windowResetsIn,
} from '@/engine/engineering/factory-insights'
import {
  componentSwapRows,
  projectedGridLossIfElectedNow,
} from '@/engine/engineering/component-strategy'
import {
  deltaVsLeaderFromHistory,
  mtbfFromFailureLog,
} from '@/engine/engineering/car-performance-insights'
import {
  correlationDeltaFromOutcomes,
  AERO_BOOKINGS_CAP,
} from '@/engine/engineering/aero-budget'

export default function FactoryPage() {
  useRequireGame()
  const allocateRnD = useGameStore((s) => s.allocateRnD)
  const pauseRnD = useGameStore((s) => s.pauseRnD)
  const electComponentSwap = useGameStore((s) => s.electComponentSwap)
  const hireStaffChief = useGameStore((s) => s.hireStaffChief)
  const fireStaffChief = useGameStore((s) => s.fireStaffChief)
  const hireStaffMember = useGameStore((s) => s.hireStaffMember)
  const fireStaffMember = useGameStore((s) => s.fireStaffMember)

  const slice = useGameSlice((w) => ({
    teams: w.teams,
    drivers: w.drivers,
    gameState: w.gameState,
    finance: w.finance,
    recommendations: w.recommendations,
    staffMarket: w.staffMarket,
  }))

  if (!slice) return null

  const { teams, drivers, gameState, finance, recommendations, staffMarket } = slice
  const playerTeam = teams.find((t) => t.id === gameState.playerTeamId)!
  const playerFinance = finance[playerTeam.id]
  const overallRating = calculateOverallRating(playerTeam.car)
  const location = playerTeam.headquarters

  const budgetCapM = playerFinance.budget.cap / 1_000_000
  const budgetSpentM = playerFinance.budget.totalSpent / 1_000_000

  // IP-08: Technical Director's current R&D pick in the tree.
  const tdPick = recommendations.find(
    (r) => r.role === 'technical-director' && r.status === 'active' && r.action.startsWith('start-rnd:'),
  )
  const recommendedUpgradeId = tdPick?.action.slice('start-rnd:'.length)

  // Wave 1 derivations (pure engine helpers — no schema changes).
  const peerAxes = peerAveragedAxes(teams, playerTeam.id)
  const rank = peerRank(teams, playerTeam.id)
  const leaderDelta = deltaVsLeaderFromHistory(teams, playerTeam.id)
  const nextChange = projectNextChange(playerTeam.components, gameState.currentRound, gameState.totalRaces)
  const playerDriverEntries = drivers.filter((d) => d.teamId === playerTeam.id && !d.isReserve)
  const playerDriversForRows = playerDriverEntries.map((d) => ({ id: d.id, shortName: d.shortName }))
  const swapRows = componentSwapRows(playerTeam, playerDriversForRows)
  const gridLoss = playerDriverEntries.reduce(
    (sum, d) => sum + projectedGridLossIfElectedNow(playerTeam, d.id),
    0,
  )
  const atr = atrCoefficientForPosition(playerTeam.constructorPosition)
  const corr = correlationDeltaFromOutcomes(playerTeam, gameState.currentRound)
  const nextDelivery = nextDeliveryRound(playerTeam.rndUpgrades, gameState.currentRound)
  const daysToReset = windowResetsIn(gameState.currentRound)

  const nextDeliveryUpgrade = nextDelivery
    ? playerTeam.rndUpgrades.find((u) => u.id === nextDelivery.upgradeId)
    : undefined

  // Phase 3 (Box 3): real per-day aero booking histograms. Each entry in
  // `team.aeroBookings` is one management cycle's actual WT/CFD spend; we
  // pad the array out to AERO_BOOKINGS_CAP slots so the histogram retains
  // a fixed-width layout, and normalize each value against the team's
  // per-cycle budget ceiling for visual scale.
  const wtPerDayCeiling = Math.max(1, playerTeam.windTunnelHoursLimit / AERO_BOOKINGS_CAP)
  const cfdPerDayCeiling = Math.max(1, playerTeam.cfdRunsLimit / AERO_BOOKINGS_CAP)
  const padded = [
    ...playerTeam.aeroBookings,
    ...Array.from({ length: Math.max(0, AERO_BOOKINGS_CAP - playerTeam.aeroBookings.length) }, () => ({
      day: -1, wtHours: 0, cfdRuns: 0,
    })),
  ].slice(0, AERO_BOOKINGS_CAP)
  const wtHistory = padded.map((b) => Math.max(0, Math.min(1, b.wtHours / wtPerDayCeiling)))
  const cfdHistory = padded.map((b) => Math.max(0, Math.min(1, b.cfdRuns / cfdPerDayCeiling)))
  const mtbf = mtbfFromFailureLog(playerTeam)

  // Phase 3 (Box 3): forecast which in-progress upgrades would stall on the
  // *next* management cycle, given current WT/CFD usage. Mirrors the engine's
  // lex-asc-id processing order from `consumeAeroBudget` so the UI badge
  // matches what would actually happen at the next phase advance.
  const stalledUpgradeIds = (() => {
    const inProgress = playerTeam.rndUpgrades
      .filter((u) => u.status === 'in-progress')
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    let wt = playerTeam.windTunnelHoursUsed
    let cfd = playerTeam.cfdRunsUsed
    let triggered = false
    const ids = new Set<string>()
    for (const u of inProgress) {
      if (triggered) { ids.add(u.id); continue }
      const nextWt = wt + u.wtHoursPerCycle
      const nextCfd = cfd + u.cfdRunsPerCycle
      if (nextWt > playerTeam.windTunnelHoursLimit || nextCfd > playerTeam.cfdRunsLimit) {
        ids.add(u.id)
        triggered = true
        continue
      }
      wt = nextWt
      cfd = nextCfd
    }
    return ids
  })()

  return (
    <PageShell theme="broadcast">
      <div className="factory-shell">
        <FactoryHeader
          teamName={playerTeam.name}
          location={location}
          round={gameState.currentRound}
          budgetCap={budgetCapM}
          budgetSpent={budgetSpentM}
        />

        <div className="fac-hero">
          <CarPerformanceCard
            rating={overallRating}
            car={playerTeam.car}
            peerAxes={peerAxes}
            peerRank={rank}
            trendSeries={playerTeam.ovrHistory}
            deltaVsLeader={leaderDelta}
            reliabilityMtbf={mtbf}
            lastUpgradeRound={playerTeam.lastUpgradeRound}
          />
          <PowerUnitCard
            components={playerTeam.components}
            nextChangeRound={nextChange?.round}
            nextChangeElement={nextChange?.element}
            penaltiesTaken={playerTeam.penaltiesTaken}
            projectedGridLoss={gridLoss}
            totalRaces={gameState.totalRaces}
            swapRows={swapRows}
            onElectSwap={electComponentSwap}
          />
          <AeroCard
            windTunnelUsed={playerTeam.windTunnelHoursUsed}
            windTunnelLimit={playerTeam.windTunnelHoursLimit}
            cfdUsed={playerTeam.cfdRunsUsed}
            cfdLimit={playerTeam.cfdRunsLimit}
            daysToReset={daysToReset}
            resetDateLabel={`IN-SEASON · D−${String(daysToReset).padStart(2, '0')}`}
            wtDaily={wtHistory}
            cfdDaily={cfdHistory}
            todayIndex={Math.max(0, 13 - daysToReset)}
            atrCoefficient={atr}
            correlationDelta={corr}
            nextDeliveryRound={nextDelivery?.round}
          />
          <PitCrewCard
            chief={playerTeam.pitCrewChief}
            members={playerTeam.pitCrewMembers}
            market={staffMarket}
            onHireChief={hireStaffChief}
            onFireChief={fireStaffChief}
            onHireMember={hireStaffMember}
            onFireMember={fireStaffMember}
          />
        </div>

        <RdPipelineHeader
          upgrades={playerTeam.rndUpgrades}
          nextDeliveryRound={nextDelivery?.round}
          nextDeliveryLabel={nextDeliveryUpgrade?.name}
        />

        <RdQueue
          upgrades={playerTeam.rndUpgrades}
          currentRound={gameState.currentRound}
          stalledUpgradeIds={stalledUpgradeIds}
        />

        <TechTree
          upgrades={playerTeam.rndUpgrades}
          onStart={allocateRnD}
          onPause={pauseRnD}
          recommendedUpgradeId={recommendedUpgradeId}
        />
      </div>
    </PageShell>
  )
}
