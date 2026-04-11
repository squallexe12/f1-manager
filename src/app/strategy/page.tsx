'use client'

import { useMemo, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/game-store'
import { useRequireGame, useGameSlice } from '@/hooks/use-require-game'
import { useRaceSimulation, type TimingEntry } from '@/hooks/use-race-simulation'
import { PageShell } from '@/components/layout/page-shell'
import { TimingTower } from '@/components/strategy/timing-tower'
import { TireStrategy } from '@/components/strategy/tire-strategy'
import { CommentaryFeed } from '@/components/strategy/commentary-feed'
import { BattleForecast } from '@/components/strategy/battle-forecast'
import { DriverCommands } from '@/components/strategy/driver-commands'
import { RaceStatusBar } from '@/components/strategy/race-status-bar'
import { SimSpeedControl } from '@/components/strategy/sim-speed-control'
import { GapChart } from '@/components/charts/gap-chart'
import { PreRaceSetup } from '@/components/strategy/pre-race-setup'
import { CircuitMap } from '@/components/strategy/circuit-map'
import { RaceTicker } from '@/components/strategy/race-ticker'
import { PostRaceResults } from '@/components/strategy/post-race-results'
import { Button } from '@/components/ui/button'
import type { RaceState, RaceStrategy, DriverCommand, TireCompound } from '@/types/race'
import type { RaceDriver } from '@/engine/race/race-simulator'
import type { DriverStrategies } from '@/components/strategy/strategy-planner'

export default function StrategyPage() {
  const router = useRouter()
  useRequireGame() // guard only
  const advancePhase = useGameStore((s) => s.advancePhase)
  const submitRaceResults = useGameStore((s) => s.submitRaceResults)
  const [driverStrategies, setDriverStrategies] = useState<DriverStrategies>({})

  const slice = useGameSlice((w) => ({
    gameState: w.gameState,
    teams: w.teams,
    drivers: w.drivers,
    calendar: w.calendar,
  }))

  // All hooks must be above early returns
  const gameState = slice?.gameState
  const teams = slice?.teams ?? []
  const drivers = slice?.drivers ?? []
  const calendar = slice?.calendar ?? []
  const playerTeamId = gameState?.playerTeamId ?? ''

  const playerTeam = teams.find((t) => t.id === playerTeamId)
  const playerDrivers = drivers.filter((d) => d.teamId === playerTeamId && !d.isReserve)
  const currentRace = calendar[(gameState?.currentRound ?? 1) - 1]

  const driverMeta = useMemo(() => {
    return drivers
      .filter((d) => d.teamId && !d.isReserve && !d.isF2)
      .map((d) => {
        const team = teams.find((t) => t.id === d.teamId)
        return {
          id: d.id,
          shortName: d.shortName,
          teamColor: team?.color ?? '#666',
          isPlayer: d.teamId === playerTeamId,
        }
      })
  }, [drivers, teams, playerTeamId])

  const onRaceEnd = useCallback((finalResults: import('@/types/race').LapResult[], fastestLap: { driverId: string; time: number }) => {
    const raceResults = finalResults.map(r => ({
      driverId: r.driverId,
      position: r.position,
      dnf: false,
      fastestLap: r.driverId === fastestLap.driverId,
    }))
    const isSprint = gameState?.phase === 'sprint'
    submitRaceResults(raceResults, isSprint ?? false)
  }, [gameState?.phase, submitRaceResults])

  const { state: raceSim, startRace, setSpeed, pause, resume, sendCommand, pitWithCompound } = useRaceSimulation({
    driverMeta,
    playerTeamId,
    onRaceEnd,
  })

  if (!slice || !playerTeam || !gameState) return null

  // After guard: gameState is guaranteed defined
  const state = gameState

  // Handle advancing to next phase
  function handleAdvance() {
    advancePhase()
  }

  // Advance and return to paddock (used after post-race)
  function handleReturnToPaddock() {
    advancePhase()
    router.push('/paddock')
  }

  // Handle starting the race simulation
  function handleStartRace() {
    if (!currentRace) return

    // Build initial race state
    const raceState: RaceState = {
      currentLap: 0,
      totalLaps: currentRace.circuit.laps,
      weather: { current: 'dry', rainProbability: 0.15, changeInLaps: null },
      safetyCar: 'green',
      trackTemp: 35 + Math.random() * 15,
      results: [],
      incidents: [],
      commentary: [],
    }

    // Build strategies and driver data for all drivers
    const allDrivers = drivers.filter((d) => d.teamId && !d.isReserve && !d.isF2)
    const defaultStops = [{ lap: Math.floor(currentRace.circuit.laps * 0.45), compound: currentRace.circuit.compounds[0] }]
    const strategies: RaceStrategy[] = allDrivers.map((d) => {
      const driverPlan = driverStrategies[d.id]
      const stops = driverPlan ? driverPlan.stops : defaultStops
      return {
        driverId: d.id,
        plannedStops: stops,
        currentCommand: 'standard' as DriverCommand,
      }
    })

    // Build RaceDriver array with real car/driver data
    const raceDrivers: RaceDriver[] = allDrivers.map((d) => {
      const dTeam = teams.find((t) => t.id === d.teamId)!
      return {
        id: d.id,
        car: { ...dTeam.car },
        attributes: { ...d.attributes },
      }
    })

    const circuitInfo = {
      tireWear: currentRace.circuit.tireWear,
      overtakingDifficulty: currentRace.circuit.overtakingDifficulty,
      weatherVariability: currentRace.circuit.weatherVariability,
      compounds: currentRace.circuit.compounds,
    }

    // Build start compound map — use each driver's selected strategy start compound
    const startCompounds: Record<string, import('@/types/race').TireCompound> = {}
    for (const d of allDrivers) {
      const driverPlan = driverStrategies[d.id]
      if (driverPlan?.startCompound) {
        startCompounds[d.id] = driverPlan.startCompound
      } else {
        startCompounds[d.id] = currentRace.circuit.compounds[1] // default to medium
      }
    }

    startRace(raceState, strategies, state.seed + state.currentRound, raceDrivers, circuitInfo, startCompounds)
  }

  // Handle practice session start
  function handleStartSession(_programId: string) {
    // In MVP, practice just advances to qualifying
    handleAdvance()
  }

  // Determine which view to show
  const phase = state.phase
  const isRaceActive = raceSim.phase === 'running' || raceSim.phase === 'paused'
  const isRaceFinished = raceSim.phase === 'finished'

  // Pre-race phases
  if (phase === 'practice' || phase === 'qualifying' || phase === 'sprint-qualifying') {
    return (
      <PageShell>
        <PreRaceSetup
          race={currentRace}
          playerTeam={playerTeam}
          playerDrivers={playerDrivers}
          phase={phase === 'practice' ? 'practice' : 'qualifying'}
          onStartSession={handleStartSession}
          onAdvance={handleAdvance}
          onSelectStrategies={setDriverStrategies}
        />
      </PageShell>
    )
  }

  // Post-race
  if (phase === 'post-race' || isRaceFinished) {
    const results = raceSim.finalResults
      ? raceSim.timing.map((t) => {
          const driver = drivers.find((d) => d.id === t.driverId)
          const team = teams.find((tm) => tm.id === driver?.teamId)
          return {
            driverId: t.driverId,
            driverName: driver ? `${driver.firstName} ${driver.lastName}` : t.driverName,
            teamName: team?.name ?? '',
            teamColor: t.teamColor,
            isPlayer: t.isPlayer,
            position: t.position,
            gapToLeader: t.gapToLeader,
            lapTime: t.lastLapTime,
          }
        })
      : []

    return (
      <PageShell>
        <PostRaceResults
          results={results}
          fastestLap={raceSim.fastestLap}
          raceName={currentRace?.name ?? ''}
          onContinue={handleReturnToPaddock}
        />
      </PageShell>
    )
  }

  // Race phase — show either the "Start Race" button or the live simulation
  if (phase === 'race' || phase === 'sprint') {
    if (!isRaceActive && !isRaceFinished) {
      // Race not started yet — show start button
      return (
        <PageShell>
          <div className="flex flex-col items-center justify-center gap-6 py-20">
            <h2 className="text-lg font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {phase === 'sprint' ? 'Sprint Race' : 'Grand Prix'}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {currentRace?.name} — {currentRace?.circuit.laps} Laps
            </p>
            <Button size="lg" onClick={handleStartRace}>
              Start Race Simulation
            </Button>
          </div>
        </PageShell>
      )
    }

    // Live Race View — Redesigned engaging layout
    const playerTireDrivers = playerDrivers.map(d => ({
      driverId: d.id,
      driverName: d.shortName,
      tireState: raceSim.tireStates[d.id] ?? null,
      wearHistory: raceSim.wearHistory[d.id] ?? [],
    }))

    return (
      <PageShell>
        {/* ═══ Sticky Control Bar ═══ */}
        <div className="sticky top-12 z-20 bg-[var(--bg-primary)]/95 backdrop-blur-md pb-2 -mx-4 px-4 pt-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <RaceStatusBar
              lap={raceSim.currentLap}
              totalLaps={raceSim.totalLaps}
              weather={raceSim.weather}
              trackTemp={raceSim.trackTemp}
              safetyCar={raceSim.safetyCar}
            />
            <SimSpeedControl
              currentSpeed={raceSim.simSpeed}
              onSetSpeed={setSpeed}
              onPause={pause}
              onResume={resume}
              isPaused={raceSim.phase === 'paused'}
            />
          </div>
          <RaceTicker entries={raceSim.commentary} className="mt-2" />
        </div>

        {/* ═══ Hero: Track Map (center, large) ═══ */}
        <div className="mt-3 mb-4">
          <CircuitMap
            circuitId={currentRace?.circuit.id ?? ''}
            circuitName={currentRace?.circuit.name ?? ''}
            currentLap={raceSim.currentLap}
            totalLaps={raceSim.totalLaps}
            drivers={raceSim.timing.map(t => ({
              driverId: t.driverId,
              driverName: t.driverName,
              teamColor: t.teamColor,
              isPlayer: t.isPlayer,
              position: t.position,
            }))}
            liveCarPositions={raceSim.carPositions}
          />
        </div>

        {/* ═══ Data Panels: 3-column below the map ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Column 1 — Timing + Gap */}
          <div className="flex flex-col gap-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 max-h-[360px] overflow-y-auto">
              <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-2 sticky top-0 bg-[var(--bg-surface)] py-1 z-10">
                Live Timing
              </h3>
              <TimingTower entries={raceSim.timing} />
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3">
              <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-2">Gap Chart</h3>
              <GapChart
                entries={raceSim.timing.slice(0, 10).map(t => ({
                  driverId: t.driverId, driverName: t.driverName,
                  teamColor: t.teamColor, gap: t.gapToLeader, isPlayer: t.isPlayer,
                }))}
              />
            </div>
          </div>

          {/* Column 2 — Strategy + Commands */}
          <div className="flex flex-col gap-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3">
              <TireStrategy
                drivers={playerTireDrivers}
                currentLap={raceSim.currentLap}
                options={raceSim.strategies}
                onSelectStrategy={(opt) => {
                  if (playerDrivers[0]) pitWithCompound(playerDrivers[0].id, opt.newCompound)
                }}
              />
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3">
              <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">Driver Commands</h3>
              <div className="flex flex-col gap-4">
                {playerDrivers.map(driver => (
                  <DriverCommands
                    key={driver.id}
                    driverId={driver.id}
                    driverName={`${driver.firstName} ${driver.lastName}`}
                    currentCommand={raceSim.driverCommands[driver.id] ?? 'standard'}
                    availableCompounds={currentRace?.circuit.compounds}
                    onCommand={sendCommand}
                    onPitWithCompound={pitWithCompound}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Column 3 — Battles + Commentary */}
          <div className="flex flex-col gap-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3">
              <BattleForecast battles={raceSim.battles} />
              {raceSim.battles.length === 0 && (
                <p className="text-[10px] text-[var(--text-dim)] italic">No active battles</p>
              )}
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 flex-1 min-h-[300px]">
              <CommentaryFeed entries={raceSim.commentary} className="!max-h-[500px]" />
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  // Default: management phase — show next race info with option to advance
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Strategy Room
        </h2>
        {currentRace ? (
          <>
            <p className="text-xs text-[var(--text-secondary)]">
              Next Race: Round {currentRace.round} — {currentRace.name}
            </p>
            <Button size="lg" onClick={handleAdvance}>
              Enter Race Weekend
            </Button>
          </>
        ) : (
          <p className="text-xs text-[var(--text-dim)]">Season complete</p>
        )}
      </div>
    </PageShell>
  )
}
