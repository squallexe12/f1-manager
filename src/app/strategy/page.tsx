'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { resolveCalibrationForCircuit } from '@/data/calibration'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/game-store'
import { useRequireGame, useGameSlice } from '@/hooks/use-require-game'
import { useRaceSimulation } from '@/hooks/use-race-simulation'
import type { TimingEntry } from '@/hooks/use-race-simulation'
import { PageShell } from '@/components/layout/page-shell'
import { TimingTower } from '@/components/strategy/timing-tower'
import { TireStrategy } from '@/components/strategy/tire-strategy'
import { CommentaryFeed } from '@/components/strategy/commentary-feed'
import { BattleForecast } from '@/components/strategy/battle-forecast'
import { DriverCommands } from '@/components/strategy/driver-commands'
import { BroadcastChrome } from '@/components/strategy/broadcast-chrome'
import { HeroStrip } from '@/components/strategy/hero-strip'
import { GapChart } from '@/components/charts/gap-chart'
import { PreRaceSetup } from '@/components/strategy/pre-race-setup'
import { CircuitMap } from '@/components/strategy/circuit-map'
import { PostRaceResults } from '@/components/strategy/post-race-results'
import { RaceStartScreen } from '@/components/strategy/race-start-screen'
import { Button } from '@/components/ui/button'
import type { DriverStrategies } from '@/components/strategy/strategy-planner'
import type { RaceWorkerStartPayload } from '@/types/race'

// ─── GapChartRow ─────────────────────────────────────────────────────────────
// Inline helper component — collapsible secondary row below the live race grid.
// Local UI state only; no Zustand involvement.

function GapChartRow({ timing, isOpen, onToggle }: {
  timing: TimingEntry[]
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="mt-4 bg-surface-paper border border-line-sub rounded-rad overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute hover:text-ink-hi transition-[color] duration-[120ms]"
      >
        <span>Gap Chart · Top 10</span>
        <span>{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-line-hair">
          <GapChart
            entries={timing.slice(0, 10).map(t => ({
              driverId: t.driverId,
              driverName: t.driverName,
              teamColor: t.teamColor,
              gap: t.gapToLeader,
              isPlayer: t.isPlayer,
            }))}
          />
        </div>
      )}
    </div>
  )
}

export default function StrategyPage() {
  const router = useRouter()
  useRequireGame() // guard only
  const advancePhase = useGameStore((s) => s.advancePhase)
  const submitRaceResults = useGameStore((s) => s.submitRaceResults)
  const applyRecommendation = useGameStore((s) => s.applyRecommendation)
  const [driverStrategies, setDriverStrategies] = useState<DriverStrategies>({})
  const [showGapChart, setShowGapChart] = useState(false)

  const slice = useGameSlice((w) => ({
    gameState: w.gameState,
    teams: w.teams,
    drivers: w.drivers,
    calendar: w.calendar,
    recommendations: w.recommendations,
  }))

  // All hooks must be above early returns.
  // Slice fallbacks are wrapped in useMemo so downstream hooks (driverMeta)
  // keep a stable reference when the slice is undefined during the first
  // render — otherwise React Compiler skips memoization on this component.
  const gameState = slice?.gameState
  const teams = useMemo(() => slice?.teams ?? [], [slice?.teams])
  const drivers = useMemo(() => slice?.drivers ?? [], [slice?.drivers])
  const calendar = useMemo(() => slice?.calendar ?? [], [slice?.calendar])
  const recommendations = useMemo(() => slice?.recommendations ?? [], [slice?.recommendations])
  const playerTeamId = gameState?.playerTeamId ?? ''

  // IP-08: surface the active Race Engineer strategy pick in PreRaceSetup.
  const raceEngineerRec = recommendations.find(
    (r) => r.role === 'race-engineer' && r.status === 'active' && r.action.startsWith('strategy:'),
  )

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
      <PageShell theme="broadcast">
        <PreRaceSetup
          race={currentRace}
          playerTeam={playerTeam}
          playerDrivers={playerDrivers}
          phase={phase === 'practice' ? 'practice' : 'qualifying'}
          onStartSession={handleStartSession}
          onAdvance={handleAdvance}
          onSelectStrategies={setDriverStrategies}
          calibration={calibration}
          raceEngineerRecommendation={raceEngineerRec}
          onApplyRecommendation={applyRecommendation}
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
      <PageShell theme="broadcast">
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
        <PageShell theme="broadcast">
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
      // Race not started yet — Broadcast StartScreen with lights gantry.
      return (
        <PageShell theme="broadcast">
          <RaceStartScreen
            circuitName={currentRace?.name ?? 'Grand Prix'}
            laps={currentRace?.circuit.laps ?? 0}
            isSprint={phase === 'sprint'}
            onStart={handleStartRace}
          />
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
      <PageShell theme="broadcast">
        {/* ═══ Sticky Command Chrome ═══ */}
        <BroadcastChrome
          phase={phase === 'sprint' ? 'sprint' : 'race'}
          lap={raceSim.currentLap}
          totalLaps={raceSim.totalLaps}
          weather={raceSim.weather}
          trackTemp={raceSim.trackTemp}
          safetyCar={raceSim.safetyCar}
          currentSpeed={raceSim.simSpeed}
          onSetSpeed={setSpeed}
          onPause={pause}
          onResume={resume}
          isPaused={raceSim.phase === 'paused'}
          tickerEntries={raceSim.commentary}
        />

        {/* ═══ Hero Strip: Leader + Lap + Gap ═══ */}
        {(() => {
          const leader = raceSim.timing[0]
          const leaderDriver = leader ? drivers.find(d => d.id === leader.driverId) : undefined
          const leaderTeam = leaderDriver ? teams.find(t => t.id === leaderDriver.teamId) : undefined
          const p2 = raceSim.timing[1]
          return (
            <HeroStrip
              currentLap={raceSim.currentLap}
              totalLaps={raceSim.totalLaps}
              leaderCode={leaderDriver?.shortName ?? ''}
              leaderFirst={leaderDriver?.firstName ?? ''}
              leaderLast={leaderDriver?.lastName ?? ''}
              leaderNumber={0}
              leaderTeamColor={leaderTeam?.color ?? '#666'}
              leaderTeamCode={leaderTeam?.shortName ?? leaderTeam?.name?.slice(0, 3).toUpperCase() ?? ''}
              leaderGap={p2?.gapToLeader}
            />
          )
        })()}

        {/* ═══ Data Panels: 3-column grid (460px | flex | 380px) ═══ */}
        <div
          className="
            grid gap-4 mt-3
            grid-cols-1
            min-[1200px]:grid-cols-[420px_1fr_360px]
            min-[1400px]:grid-cols-[460px_1fr_380px]
          "
        >
          {/* Left — Timing Tower */}
          <div className="flex flex-col gap-3">
            <TimingTower entries={raceSim.timing} />
          </div>

          {/* Center — Circuit Map (top) + Tire Strategy (bottom) */}
          <div className="flex flex-col gap-3">
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

          {/* Right — Driver Commands + Battle Forecast + Commentary Feed */}
          <div className="flex flex-col gap-3">
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
            {raceSim.battles.length > 0 && (
              <BattleForecast battles={raceSim.battles} />
            )}
            <CommentaryFeed entries={raceSim.commentary} />
          </div>
        </div>

        {/* ═══ Secondary row — collapsible Gap Chart ═══ */}
        <GapChartRow
          timing={raceSim.timing}
          isOpen={showGapChart}
          onToggle={() => setShowGapChart(v => !v)}
        />
      </PageShell>
    )
  }

  // Default: management phase — show next race info with option to advance
  return (
    <PageShell theme="broadcast">
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
