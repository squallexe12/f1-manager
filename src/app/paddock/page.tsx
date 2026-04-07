'use client'

import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/game-store'
import { useRequireGame } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { HealthWidget } from '@/components/paddock/health-widget'
import { DriverSummaryCard } from '@/components/paddock/driver-summary-card'
import { PaddockFeed } from '@/components/paddock/paddock-feed'
import { DepartmentPanel } from '@/components/paddock/department-panel'
import { Button } from '@/components/ui/button'
import { calculateOverallRating } from '@/engine/engineering/car-performance'

export default function PaddockPage() {
  const router = useRouter()
  const world = useRequireGame()
  const advancePhase = useGameStore((s) => s.advancePhase)
  const resolveEvent = useGameStore((s) => s.resolveEvent)

  if (!world) return null

  const { gameState, teams, drivers, finance, narrativeEvents } = world
  const playerTeam = teams.find((t) => t.id === gameState.playerTeamId)!
  const playerDrivers = drivers.filter((d) => d.teamId === playerTeam.id && !d.isReserve)
  const playerFinance = finance[playerTeam.id]
  const carRating = calculateOverallRating(playerTeam.car)

  // Calculate WDC positions (sorted by points descending)
  const allDriversSorted = [...drivers]
    .filter(d => d.teamId && !d.isReserve && !d.isF2)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)
  const getWdcPosition = (driverId: string) =>
    allDriversSorted.findIndex(d => d.id === driverId) + 1

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
    <PageShell>
      {/* Health Widgets Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <HealthWidget
          label="Constructor"
          value={`P${playerTeam.constructorPosition || '—'}`}
          color={playerTeam.color}
        />
        <HealthWidget
          label="Car Rating"
          value={carRating}
          color="var(--accent-cyan)"
        />
        <HealthWidget
          label="Budget"
          value={`$${Math.round((playerFinance.budget.cap - playerFinance.budget.totalSpent) / 1_000_000)}M`}
          warning={playerFinance.budget.penaltyRisk ? 'Cap risk' : undefined}
        />
        <HealthWidget
          label="Morale"
          value={playerTeam.morale}
          trend={playerTeam.morale > 75 ? 'up' : playerTeam.morale < 50 ? 'down' : 'stable'}
        />
        <HealthWidget
          label="Prestige"
          value={playerFinance.prestige}
          color="var(--accent-purple)"
        />
      </div>

      {/* Main Content: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Drivers + Departments */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {playerDrivers.map((driver) => (
            <DriverSummaryCard
              key={driver.id}
              driver={driver}
              wdcPosition={getWdcPosition(driver.id)}
              teamColor={playerTeam.color}
            />
          ))}
          <DepartmentPanel departments={playerTeam.staff} />
        </div>

        {/* Right: Paddock Feed */}
        <div className="lg:col-span-2">
          <PaddockFeed events={narrativeEvents} onResolve={handleResolve} />
        </div>
      </div>

      {/* Advance Button */}
      {gameState.phase === 'management' && (
        <div className="fixed bottom-16 right-6 z-30">
          <Button size="lg" onClick={handleAdvance}>
            Advance to Race Weekend
          </Button>
        </div>
      )}
    </PageShell>
  )
}
