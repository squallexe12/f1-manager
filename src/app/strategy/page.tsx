'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { resolveCalibrationForCircuit } from '@/data/calibration'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/game-store'
import { useRequireGame, useGameSlice } from '@/hooks/use-require-game'
import { useRaceSimulation } from '@/hooks/use-race-simulation'
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
import type { DriverStrategies } from '@/components/strategy/strategy-planner'
import type { RaceWorkerStartPayload } from '@/types/race'

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

  // All hooks must be above early returns.
  // Slice fallbacks are wrapped in useMemo so downstream hooks (driverMeta)
  // keep a stable reference when the slice is undefined during the first
  // render — otherwise React Compiler skips memoization on this component.
  const gameState = slice?.gameState
  const teams = useMemo(() => slice?.teams ?? [], [slice?.teams])
  const drivers = useMemo(() => slice?.drivers ?? [], [slice?.drivers])
  const calendar = useMemo(() => slice?.calendar ?? [], [slice?.calendar])
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

  // IP-07: Resolve the circuit's calibration profile once per race context so
  // strategy copy reflects real per-circuit pit loss + stint lengths. The
  // fallback log below warns when a circuit lacks OpenF1 data so devs can
  // notice the silent heuristic path during playtest.
  const calibration = useMemo(
    () => (currentRace ? resolveCalibrationForCircuit(currentRace.circuit) : undefined),
    [currentRace],
  )

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && calibration && calibration.source !== 'openf1') {
      console.warn(
        `[calibration] Circuit "${calibration.circuitId}" is using a "${calibration.source}" profile. ` +
          'Strategy suggestions fall back to internal heuristics instead of OpenF1-derived data.',
      )
    }
  }, [calibration])

  const { state: raceSim, startRace, setSpeed, pause, resume, sendCommand, pitWithCompound } = useRaceSimulation({
    driverMeta,
    playerTeamId,
    onRaceEnd,
    calibration,
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

    const allDrivers = drivers.filter((d) => d.teamId && !d.isReserve && !d.isF2)

    const payload: RaceWorkerStartPayload = {
      seed: state.seed,
      round: state.currentRound,
      circuit: currentRace.circuit,
      isSprint: currentRace.isSprint,
      drivers: allDrivers.map((d) => {
        const dTeam = teams.find((t) => t.id === d.teamId)!
        return {
          id: d.id,
          teamId: d.teamId ?? '',
          attributes: d.attributes,
          car: dTeam.car,
        }
      }),
      strategies: allDrivers
        .filter((d) => driverStrategies[d.id] !== undefined)
        .map((d) => {
          const plan = driverStrategies[d.id]
          return {
            driverId: d.id,
            stops: plan.stops,
            startCompound: plan.startCompound,
          }
        }),
    }

    startRace(payload)
  }

  // Handle practice session start — MVP just advances to qualifying,
  // so the program id is intentionally ignored (contravariant signature).
  function handleStartSession() {
    handleAdvance()
  }

  // Determine which view to show
  const phase = state.phase
  const isRaceActive = raceSim.phase === 'running' || raceSim.phase === 'paused'
  const isRaceFinished = raceSim.phase === 'finished'
  const isRaceErrored = raceSim.workerStatus === 'error' && raceSim.workerError?.fatal === true

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
          calibration={calibration}
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
    if (isRaceErrored) {
      return (
        <PageShell>
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <h2 className="text-lg font-heading font-bold uppercase tracking-wider text-[var(--accent-danger,#ff5252)]">
              Race Simulation Failed
            </h2>
            <p className="text-xs text-[var(--text-muted)] max-w-md text-center">
              The race worker reported a fatal error at lap {raceSim.workerError?.lastValidLap ?? 0}.
              Restart from lap 1 to continue — mid-race resume is not supported.
            </p>
            <p className="text-[10px] text-[var(--text-dim)] font-mono">
              {raceSim.workerError?.code}: {raceSim.workerError?.message}
            </p>
            <Button size="lg" onClick={handleStartRace}>
              Restart Race From Lap 1
            </Button>
          </div>
        </PageShell>
      )
    }

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
      compoundHistory: raceSim.compoundHistory[d.id] ?? [],
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
                circuitCompounds={currentRace?.circuit.compounds ?? ['C1', 'C2', 'C3']}
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
