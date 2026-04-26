'use client'

import { useGameStore } from '@/stores/game-store'
import { useRequireGame, useGameSlice } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { FactoryHeader } from '@/components/factory/factory-header'
import { CarPerformanceCard } from '@/components/factory/car-performance-card'
import { PowerUnitCard } from '@/components/factory/power-unit-card'
import { AeroCard } from '@/components/factory/aero-card'
import { RdPipelineHeader } from '@/components/factory/rd-pipeline-header'
import { RdQueue } from '@/components/factory/rd-queue'
import { TechTree } from '@/components/factory/tech-tree'
import { calculateOverallRating } from '@/engine/engineering/car-performance'
import {
  peerAveragedAxes,
  peerRank,
  projectNextChange,
  atrCoefficientForPosition,
  correlationDelta,
  nextDeliveryRound,
  windowResetsIn,
  deterministicAeroHistory,
} from '@/engine/engineering/factory-insights'
import {
  componentSwapRows,
  projectedGridLossIfElectedNow,
} from '@/engine/engineering/component-strategy'
import {
  deltaVsLeaderFromHistory,
  mtbfFromFailureLog,
} from '@/engine/engineering/car-performance-insights'

export default function FactoryPage() {
  useRequireGame()
  const allocateRnD = useGameStore((s) => s.allocateRnD)
  const pauseRnD = useGameStore((s) => s.pauseRnD)
  const electComponentSwap = useGameStore((s) => s.electComponentSwap)

  const slice = useGameSlice((w) => ({
    teams: w.teams,
    drivers: w.drivers,
    gameState: w.gameState,
    finance: w.finance,
    recommendations: w.recommendations,
  }))

  if (!slice) return null

  const { teams, drivers, gameState, finance, recommendations } = slice
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
  const corr = correlationDelta(playerTeam.id, gameState.currentRound)
  const nextDelivery = nextDeliveryRound(playerTeam.rndUpgrades, gameState.currentRound)
  const daysToReset = windowResetsIn(gameState.currentRound)

  const nextDeliveryUpgrade = nextDelivery
    ? playerTeam.rndUpgrades.find((u) => u.id === nextDelivery.upgradeId)
    : undefined

  // Wave 3 wiring: real persisted trend + last-upgrade round, plus derived MTBF
  // and deterministic aero booking histograms.
  const wtRatio = playerTeam.windTunnelHoursLimit > 0
    ? playerTeam.windTunnelHoursUsed / playerTeam.windTunnelHoursLimit
    : 0
  const cfdRatio = playerTeam.cfdRunsLimit > 0
    ? playerTeam.cfdRunsUsed / playerTeam.cfdRunsLimit
    : 0
  const wtHistory = deterministicAeroHistory(playerTeam.id, gameState.currentRound, wtRatio)
  const cfdHistory = deterministicAeroHistory(
    playerTeam.id,
    gameState.currentRound + 100, // offset so wt/cfd bars don't mirror each other
    cfdRatio,
  )
  const mtbf = mtbfFromFailureLog(playerTeam)

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
        </div>

        <RdPipelineHeader
          upgrades={playerTeam.rndUpgrades}
          nextDeliveryRound={nextDelivery?.round}
          nextDeliveryLabel={nextDeliveryUpgrade?.name}
        />

        <RdQueue upgrades={playerTeam.rndUpgrades} currentRound={gameState.currentRound} />

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
