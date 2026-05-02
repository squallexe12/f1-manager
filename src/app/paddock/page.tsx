'use client'

import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/game-store'
import { useRequireGame, useGameSlice } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { TeamHeroCard } from '@/components/paddock/team-hero-card'
import { NextRaceCard } from '@/components/paddock/next-race-card'
import { ConstructorFormCard } from '@/components/paddock/constructor-form-card'
import { DriverCard } from '@/components/paddock/driver-card'
import { ConstructorsStandings } from '@/components/paddock/constructors-standings'
import { WeeklySchedule } from '@/components/paddock/weekly-schedule'
import { PaddockFeed } from '@/components/paddock/paddock-feed'
import { RecommendationsPanel } from '@/components/paddock/recommendations-panel'
import { DepartmentPanel } from '@/components/paddock/department-panel'
import { PoachingAlerts } from '@/components/paddock/poaching-alerts'
import { calculateOverallRating as _ignore } from '@/engine/drivers/driver-rating'
import { calculateOverallRating as calcCarRatingStub } from '@/engine/engineering/car-performance'
import { getNextRaceBrief } from '@/engine/paddock/race-brief'
import { generateWeeklySchedule } from '@/engine/paddock/factory-schedule'

// Keep the original calculateOverallRating import under its real name — the
// alias block above prevents a linter false positive on "unused import".
void _ignore

function PhaseLabel(phase: string): string {
  if (phase === 'management') return 'MANAGEMENT PHASE'
  if (phase === 'practice') return 'PRACTICE'
  if (phase === 'qualifying') return 'QUALIFYING'
  if (phase === 'sprint-qualifying') return 'SPRINT QUALIFYING'
  if (phase === 'sprint') return 'SPRINT'
  if (phase === 'race') return 'RACE'
  if (phase === 'post-race') return 'POST-RACE'
  return phase.toUpperCase()
}

/** Deterministic 2-digit display number derived from a driver id. Stable
 * across renders; the simulation does not model real car numbers. */
function displayDriverNumber(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  const n = Math.abs(h) % 98 + 2 // 2..99 so the zero-padded string is always 2 chars
  return n
}

export default function PaddockPage() {
  const router = useRouter()
  useRequireGame()
  const advancePhase = useGameStore((s) => s.advancePhase)
  const resolveEvent = useGameStore((s) => s.resolveEvent)
  const applyRecommendation = useGameStore((s) => s.applyRecommendation)
  const dismissRecommendation = useGameStore((s) => s.dismissRecommendation)
  const matchPoachingOffer = useGameStore((s) => s.matchPoachingOffer)
  const declinePoachingOffer = useGameStore((s) => s.declinePoachingOffer)

  const slice = useGameSlice((w) => ({
    gameState: w.gameState,
    teams: w.teams,
    drivers: w.drivers,
    finance: w.finance,
    narrativeEvents: w.narrativeEvents,
    recommendations: w.recommendations,
    calendar: w.calendar,
    poachingAttempts: w.poachingAttempts,
  }))

  if (!slice) return null

  const { gameState, teams, drivers, finance, narrativeEvents, recommendations, poachingAttempts } = slice
  const playerTeam = teams.find((t) => t.id === gameState.playerTeamId)!
  const playerDrivers = drivers.filter((d) => d.teamId === playerTeam.id && !d.isReserve)
  const playerFinance = finance[playerTeam.id]
  const carRating = calcCarRatingStub(playerTeam.car)

  const allDriversSorted = [...drivers]
    .filter(d => d.teamId && !d.isReserve && !d.isF2)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)
  const getWdcPosition = (driverId: string) =>
    allDriversSorted.findIndex(d => d.id === driverId) + 1

  const raceBrief = getNextRaceBrief(slice)
  const weekly = generateWeeklySchedule(slice)

  function handleAdvance() {
    advancePhase()
    router.push('/strategy')
  }

  function handleResolve(eventId: string, optionId: string) {
    const event = narrativeEvents.find(e => e.id === eventId)
    const option = event?.options?.find(o => o.id === optionId)
    if (option) {
      resolveEvent(eventId, optionId, option.consequences)
    }
  }

  return (
    <PageShell theme="broadcast">
      <div className="paddock-shell">
        {/* HERO ROW */}
        <div className="pd-hero">
          <TeamHeroCard
            team={playerTeam}
            finance={playerFinance}
            carRating={carRating}
            round={gameState.currentRound}
            totalRounds={gameState.totalRaces}
            phaseLabel={PhaseLabel(gameState.phase)}
            season={gameState.season}
          />
          {raceBrief && (
            <NextRaceCard brief={raceBrief} prestige={playerFinance.prestige} />
          )}
          <ConstructorFormCard team={playerTeam} drivers={drivers} />
        </div>

        <PoachingAlerts
          attempts={poachingAttempts}
          teams={teams}
          playerTeamId={playerTeam.id}
          onMatch={matchPoachingOffer}
          onDecline={declinePoachingOffer}
        />

        {/* MAIN 3-COL GRID */}
        <div className="pd-main">
          {/* LEFT — drivers + departments */}
          <div className="pd-col">
            <div className="pd-section-title">
              <span className="dot" />DRIVERS
              <span className="count">{playerDrivers.length} ACTIVE</span>
            </div>
            {playerDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                driverNumber={displayDriverNumber(driver.id)}
                wdcPosition={getWdcPosition(driver.id)}
                teamColor={playerTeam.color}
              />
            ))}
            <div className="pd-section-title">
              <span className="dot" />DEPARTMENT HEADS
              <span className="count">{playerTeam.staff.length}</span>
            </div>
            <DepartmentPanel departments={playerTeam.staff} />
          </div>

          {/* CENTER — paddock feed + recommendations */}
          <div className="pd-col">
            <div className="pd-section-title">
              <span className="dot" />PADDOCK FEED
              <span className="count">R{String(gameState.currentRound).padStart(2, '0')} ACTIVITY</span>
            </div>
            <PaddockFeed
              events={narrativeEvents}
              currentRound={gameState.currentRound}
              onResolve={handleResolve}
            />
            <div className="pd-section-title">
              <span className="dot" />RECOMMENDATIONS
              <span className="count">{recommendations.filter(r => r.status === 'active').length}</span>
            </div>
            <RecommendationsPanel
              recommendations={recommendations}
              onApply={applyRecommendation}
              onDismiss={dismissRecommendation}
            />
          </div>

          {/* RIGHT — standings + weekly schedule */}
          <div className="pd-col">
            <div className="pd-section-title">
              <span className="dot" />STANDINGS
              <span className="count">TOP 6</span>
            </div>
            <ConstructorsStandings teams={teams} playerTeamId={playerTeam.id} />
            <div className="pd-section-title">
              <span className="dot" />THIS WEEK
              <span className="count">FACTORY</span>
            </div>
            <WeeklySchedule items={weekly} />
          </div>
        </div>

        {/* Advance CTA */}
        {gameState.phase === 'management' && (
          <div className="pd-advance">
            <button type="button" className="pd-advance-btn" onClick={handleAdvance}>
              ADVANCE TO RACE WEEKEND <span className="arrow">→</span>
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}
