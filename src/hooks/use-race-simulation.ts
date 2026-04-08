'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  RaceState, RaceStrategy, SimSpeed, DriverCommand,
  LapResult, TireState, WeatherForecast, CommentaryEntry,
  RaceIncident, StrategyOption, BattleForecast, TireCompound,
} from '@/types/race'
import { simulateLap, type SimRaceState, type RaceDriver } from '@/engine/race/race-simulator'
import { WeatherEngine } from '@/engine/race/weather'
import { createPRNG } from '@/engine/core/prng'
import { calculateStrategyOptions } from '@/engine/race/pit-strategy'

export type RaceSimPhase = 'idle' | 'running' | 'paused' | 'finished'

export interface TimingEntry {
  position: number
  driverId: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  gapToLeader: number
  lastLapTime: number | null
  tire: string
}

export interface DriverLapProgress {
  driverId: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  position: number
  lapProgress: number    // 0.0–1.0 within current lap (interpolated at 60fps)
  baseLapTime: number    // seconds — used for interpolation speed
}

export interface RaceSimState {
  phase: RaceSimPhase
  currentLap: number
  totalLaps: number
  weather: WeatherForecast
  safetyCar: 'green' | 'vsc' | 'sc'
  trackTemp: number
  timing: TimingEntry[]
  tireStates: Record<string, TireState>
  commentary: CommentaryEntry[]
  incidents: RaceIncident[]
  strategies: StrategyOption[]
  battles: BattleForecast[]
  simSpeed: SimSpeed
  finalResults: LapResult[] | null
  fastestLap: { driverId: string; time: number } | null
  driverCommands: Record<string, DriverCommand>
  wearHistory: Record<string, number[]>
  carPositions: DriverLapProgress[]  // live interpolated positions for canvas map
}

interface DriverMeta {
  id: string
  shortName: string
  teamColor: string
  isPlayer: boolean
}

interface UseRaceSimulationOptions {
  driverMeta: DriverMeta[]
  playerTeamId: string
  onRaceEnd?: (finalResults: LapResult[], fastestLap: { driverId: string; time: number }) => void
}

const TICK_INTERVALS: Record<string, number> = {
  '1': 2000,
  '2': 1000,
  '5': 400,
  'max': 50,
}

const INITIAL_WEATHER: WeatherForecast = { current: 'dry', rainProbability: 0, changeInLaps: null }

export function useRaceSimulation({ driverMeta, playerTeamId, onRaceEnd }: UseRaceSimulationOptions) {
  const simStateRef = useRef<SimRaceState | null>(null)
  const weatherEngineRef = useRef<WeatherEngine | null>(null)
  const rngRef = useRef<ReturnType<typeof createPRNG> | null>(null)
  const tickRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedRef = useRef<SimSpeed>(1)
  const pausedRef = useRef(false)

  // Sub-tick interpolation state
  const lastTickTimeRef = useRef(0)      // timestamp of last sim tick
  const nextTickTimeRef = useRef(0)      // expected timestamp of next tick
  const lapProgressRef = useRef<Record<string, { progress: number; baseLapTime: number }>>({})

  const [state, setState] = useState<RaceSimState>({
    phase: 'idle',
    currentLap: 0,
    totalLaps: 0,
    weather: INITIAL_WEATHER,
    safetyCar: 'green',
    trackTemp: 35,
    timing: [],
    tireStates: {},
    commentary: [],
    incidents: [],
    strategies: [],
    battles: [],
    simSpeed: 1,
    finalResults: null,
    fastestLap: null,
    driverCommands: Object.fromEntries(driverMeta.map(d => [d.id, 'standard' as DriverCommand])),
    wearHistory: {},
    carPositions: [],
  })

  // Build lookup map
  const metaMap = useRef(new Map<string, DriverMeta>())
  useEffect(() => {
    metaMap.current = new Map(driverMeta.map(d => [d.id, d]))
  }, [driverMeta])

  // Sub-tick interpolation RAF loop — updates carPositions at 60fps
  const rafRef = useRef<number>(0)
  const interpolationActive = useRef(false)

  // Use a ref to hold car positions for the canvas — avoids React re-renders at 60fps
  const carPositionsRef = useRef<DriverLapProgress[]>([])
  const lastSyncRef = useRef(0)

  const runInterpolation = useCallback(() => {
    if (!interpolationActive.current) return

    const now = performance.now()
    const tickDuration = nextTickTimeRef.current - lastTickTimeRef.current
    const elapsed = now - lastTickTimeRef.current
    // How far through the current tick interval (0→1)
    const tickFraction = tickDuration > 0 ? Math.min(1, elapsed / tickDuration) : 0

    const progressMap = lapProgressRef.current
    const entries = Object.entries(progressMap)
    if (entries.length > 0) {
      const positions: DriverLapProgress[] = entries.map(([driverId, info]) => {
        const meta = metaMap.current.get(driverId)
        // Each car completes a full lap of the track during one tick interval
        // speedVariation makes faster cars move slightly ahead visually
        const speedVariation = 90 / Math.max(80, info.baseLapTime)
        // Linear progress through the lap — smooth constant movement
        const animatedProgress = ((info.progress + tickFraction * speedVariation) % 1 + 1) % 1
        return {
          driverId,
          driverName: meta?.shortName ?? driverId.substring(0, 3).toUpperCase(),
          teamColor: meta?.teamColor ?? '#666',
          isPlayer: meta?.isPlayer ?? false,
          position: 0,
          lapProgress: animatedProgress,
          baseLapTime: info.baseLapTime,
        }
      })

      // Store in ref for canvas (no React re-render needed)
      carPositionsRef.current = positions

      // Sync to React state every 100ms (not every frame) for UI components
      if (now - lastSyncRef.current > 100) {
        lastSyncRef.current = now
        setState(prev => {
          for (const cp of positions) {
            const timingEntry = prev.timing.find(t => t.driverId === cp.driverId)
            if (timingEntry) cp.position = timingEntry.position
          }
          positions.sort((a, b) => a.position - b.position)
          return { ...prev, carPositions: positions }
        })
      }
    }

    rafRef.current = requestAnimationFrame(runInterpolation)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearTimeout(tickRef.current)
      cancelAnimationFrame(rafRef.current)
      interpolationActive.current = false
    }
  }, [])

  const simulateNextLap = useCallback(() => {
    const simState = simStateRef.current
    const rng = rngRef.current
    const weatherEngine = weatherEngineRef.current
    if (!simState || !rng || !weatherEngine || pausedRef.current) return

    if (simState.currentLap >= simState.totalLaps) {
      // Race finished
      const lastResults = simState.results[simState.results.length - 1] ?? []
      let fastestLap = { driverId: '', time: Infinity }
      for (const lapResults of simState.results) {
        for (const result of lapResults) {
          if (result.lapTime < fastestLap.time) {
            fastestLap = { driverId: result.driverId, time: result.lapTime }
          }
        }
      }

      interpolationActive.current = false
      cancelAnimationFrame(rafRef.current)
      setState(prev => ({
        ...prev,
        phase: 'finished',
        finalResults: lastResults,
        fastestLap,
      }))
      onRaceEnd?.(lastResults, fastestLap)
      return
    }

    simState.currentLap++
    weatherEngine.tick()
    simState.weather = weatherEngine.getForecast(simState.totalLaps - simState.currentLap)

    // Auto-execute planned pit stops for ALL drivers (including player)
    for (const strategy of simState.strategies) {
      if (strategy.currentCommand === 'pit') continue // already pitting
      const nextStop = strategy.plannedStops[0]
      if (nextStop && simState.currentLap >= nextStop.lap) {
        strategy.currentCommand = 'pit'
      }
    }

    // AI agent decisions for non-player drivers
    const playerIds = new Set(driverMeta.filter(d => d.isPlayer).map(d => d.id))
    for (const strategy of simState.strategies) {
      if (playerIds.has(strategy.driverId)) continue // skip player's drivers
      const tire = simState.tireStates[strategy.driverId]
      if (!tire) continue

      // Auto-pit: when tire wear drops below 20% and past lap 5
      if (tire.wear < 20 && simState.currentLap > 5 && strategy.currentCommand !== 'pit') {
        const compounds: TireCompound[] = ['C1', 'C2', 'C3']
        const newCompound = compounds.find(c => c !== tire.compound) ?? 'C2'
        strategy.plannedStops = [{ lap: simState.currentLap, compound: newCompound }]
        strategy.currentCommand = 'pit'
      }
      // Auto-push when behind, conserve when leading by a lot
      else if (strategy.currentCommand === 'standard') {
        const posIdx = simState.positions.indexOf(strategy.driverId)
        if (posIdx > 10 && tire.wear > 50 && rng.chance(0.15)) {
          strategy.currentCommand = 'push'
        } else if (posIdx < 3 && tire.wear < 40 && rng.chance(0.2)) {
          strategy.currentCommand = 'conserve'
        }
      }
      // Reset push/conserve back to standard after a few laps
      else if (strategy.currentCommand === 'push' || strategy.currentCommand === 'conserve') {
        if (rng.chance(0.3)) strategy.currentCommand = 'standard'
      }
    }

    const { lapResults, commentary, incidents } = simulateLap(simState, rng)
    simState.results.push(lapResults)
    simState.incidents.push(...incidents)
    simState.commentary.push(...commentary)

    // Build timing tower
    const sorted = [...lapResults].sort((a, b) => a.position - b.position)
    const timing: TimingEntry[] = sorted.map(r => {
      const meta = metaMap.current.get(r.driverId)
      return {
        position: r.position,
        driverId: r.driverId,
        driverName: meta?.shortName ?? r.driverId.substring(0, 3).toUpperCase(),
        teamColor: meta?.teamColor ?? '#666666',
        isPlayer: meta?.isPlayer ?? false,
        gapToLeader: r.gapToLeader,
        lastLapTime: r.lapTime,
        tire: simState.tireStates[r.driverId]?.label ?? 'medium',
      }
    })

    // Calculate strategy options for player drivers
    const playerDriverIds = driverMeta.filter(d => d.isPlayer).map(d => d.id)
    let strategyOptions: StrategyOption[] = []
    for (const dId of playerDriverIds) {
      const ts = simState.tireStates[dId]
      if (ts) {
        strategyOptions = calculateStrategyOptions({
          currentLap: simState.currentLap,
          totalLaps: simState.totalLaps,
          tireWear: ts.wear,
          compound: ts.compound,
          circuitTireWear: simState.circuit.tireWear,
        })
        break
      }
    }

    // Build battle forecasts from close gaps
    const battles: BattleForecast[] = []
    for (let i = 1; i < sorted.length && battles.length < 3; i++) {
      const gap = Math.abs(sorted[i].gapToAhead)
      if (gap < 2.0) {
        const attacker = metaMap.current.get(sorted[i].driverId)
        const defender = metaMap.current.get(sorted[i - 1].driverId)
        if (attacker && defender) {
          const prob = Math.max(0.1, Math.min(0.9, 1 - gap / 2.0))
          battles.push({
            attackerId: attacker.shortName,
            defenderId: defender.shortName,
            overtakeProbability: prob,
            estimatedLaps: Math.max(1, Math.ceil(gap / 0.3)),
            description: gap < 0.5 ? 'DRS range' : gap < 1.0 ? 'Closing fast' : 'In striking distance',
          })
        }
      }
    }

    // Update wear history
    setState(prev => {
      const wearHistory = { ...prev.wearHistory }
      for (const [driverId, ts] of Object.entries(simState.tireStates)) {
        if (!wearHistory[driverId]) wearHistory[driverId] = []
        wearHistory[driverId] = [...wearHistory[driverId], ts.wear]
      }

      return {
        ...prev,
        currentLap: simState.currentLap,
        weather: simState.weather as WeatherForecast,
        safetyCar: simState.safetyCar,
        timing,
        tireStates: { ...simState.tireStates },
        strategies: strategyOptions,
        battles,
        commentary: [...simState.commentary],
        wearHistory,
      }
    })

    // Update sub-tick interpolation anchors
    const now = performance.now()
    lastTickTimeRef.current = now
    const interval = TICK_INTERVALS[String(speedRef.current)] ?? 2000
    nextTickTimeRef.current = now + interval

    // Set per-driver progress anchor using actual gap data.
    // Leader anchored at progress 0.0, followers offset proportionally
    // behind based on their time gap relative to a full lap time.
    const progressMap: Record<string, { progress: number; baseLapTime: number }> = {}
    const leaderLapTime = sorted.length > 0 ? sorted[0].lapTime : 90
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i]
      // Convert time gap to track distance: gap / lapTime gives fraction of lap behind leader
      // Minimum spacing of 2% per position prevents overlapping dots
      const gapFraction = Math.abs(r.gapToLeader) / Math.max(60, leaderLapTime)
      const minSpacing = i * 0.02
      const offset = Math.max(minSpacing, gapFraction)
      // Cap at 0.85 so the last car doesn't wrap past the leader
      const clampedOffset = Math.min(0.85, offset)
      progressMap[r.driverId] = {
        progress: ((1.0 - clampedOffset) % 1 + 1) % 1,
        baseLapTime: r.lapTime,
      }
    }
    lapProgressRef.current = progressMap

    // Schedule next lap
    tickRef.current = setTimeout(simulateNextLap, interval)
  }, [driverMeta, onRaceEnd])

  const startRace = useCallback((
    raceState: RaceState,
    strategies: RaceStrategy[],
    seed: number,
    raceDrivers: RaceDriver[],
    circuitInfo?: { tireWear: string; overtakingDifficulty: 'low' | 'medium' | 'high'; weatherVariability: string },
    startCompounds?: Record<string, TireCompound>,
  ) => {
    if (tickRef.current) clearTimeout(tickRef.current)

    const rng = createPRNG(seed)
    const weatherEngine = new WeatherEngine(
      raceState.weather.current,
      circuitInfo?.weatherVariability ?? 'medium',
      createPRNG(seed + 1),
    )

    // Initialize tire states — use per-driver start compound, label by position in circuit compounds
    const circuitCompounds = (circuitInfo as any)?.compounds as TireCompound[] | undefined
    const tireStates: Record<string, TireState> = {}
    for (const s of strategies) {
      const compound = startCompounds?.[s.driverId] ?? 'C3' as TireCompound
      let label: 'hard' | 'medium' | 'soft' = 'medium'
      if (circuitCompounds) {
        const idx = circuitCompounds.indexOf(compound)
        label = idx === 0 ? 'hard' : idx === 2 ? 'soft' : 'medium'
      }
      tireStates[s.driverId] = {
        compound,
        label,
        wear: 100,
        lapsFitted: 0,
      }
    }

    const simState: SimRaceState = {
      currentLap: 0,
      totalLaps: raceState.totalLaps,
      weather: raceState.weather,
      safetyCar: 'green',
      trackTemp: raceState.trackTemp,
      results: [],
      incidents: [],
      commentary: [],
      drivers: raceDrivers,
      circuit: circuitInfo ?? { tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'medium' },
      strategies: strategies.map(s => ({ ...s })),
      tireStates,
      positions: strategies.map(s => s.driverId),
    }

    simStateRef.current = simState
    rngRef.current = rng
    weatherEngineRef.current = weatherEngine
    pausedRef.current = false
    speedRef.current = 1
    lapProgressRef.current = {}
    lastTickTimeRef.current = performance.now()
    nextTickTimeRef.current = performance.now() + 500

    setState(prev => ({
      ...prev,
      phase: 'running',
      currentLap: 0,
      totalLaps: raceState.totalLaps,
      weather: raceState.weather,
      safetyCar: 'green',
      trackTemp: raceState.trackTemp,
      timing: [],
      tireStates: {},
      commentary: [],
      incidents: [],
      strategies: [],
      battles: [],
      finalResults: null,
      fastestLap: null,
      wearHistory: {},
      simSpeed: 1,
      carPositions: [],
    }))

    // Start interpolation loop and simulation
    interpolationActive.current = true
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(runInterpolation)
    tickRef.current = setTimeout(simulateNextLap, 500)
  }, [driverMeta, simulateNextLap])

  const setSpeed = useCallback((speed: SimSpeed) => {
    speedRef.current = speed
    setState(prev => ({ ...prev, simSpeed: speed }))
  }, [])

  const pause = useCallback(() => {
    pausedRef.current = true
    interpolationActive.current = false
    cancelAnimationFrame(rafRef.current)
    if (tickRef.current) clearTimeout(tickRef.current)
    setState(prev => ({ ...prev, phase: 'paused' }))
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    interpolationActive.current = true
    lastTickTimeRef.current = performance.now()
    const interval = TICK_INTERVALS[String(speedRef.current)] ?? 2000
    nextTickTimeRef.current = performance.now() + interval
    rafRef.current = requestAnimationFrame(runInterpolation)
    setState(prev => ({ ...prev, phase: 'running' }))
    simulateNextLap()
  }, [simulateNextLap, runInterpolation])

  const sendCommand = useCallback((driverId: string, command: DriverCommand) => {
    setState(prev => ({
      ...prev,
      driverCommands: { ...prev.driverCommands, [driverId]: command },
    }))
    // Update the live sim state
    if (simStateRef.current) {
      const strategy = simStateRef.current.strategies.find(s => s.driverId === driverId)
      if (strategy) {
        strategy.currentCommand = command
      }
    }
  }, [])

  /** Pit a driver with a specific compound */
  const pitWithCompound = useCallback((driverId: string, compound: TireCompound) => {
    if (simStateRef.current) {
      const strategy = simStateRef.current.strategies.find(s => s.driverId === driverId)
      if (strategy) {
        // Set the compound for the pit stop
        strategy.plannedStops = [{ lap: simStateRef.current.currentLap, compound }, ...strategy.plannedStops]
        strategy.currentCommand = 'pit'
        setState(prev => ({
          ...prev,
          driverCommands: { ...prev.driverCommands, [driverId]: 'pit' },
        }))
      }
    }
  }, [])

  return {
    state,
    startRace,
    setSpeed,
    pause,
    resume,
    sendCommand,
    pitWithCompound,
  }
}
