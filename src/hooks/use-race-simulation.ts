'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppliedPenalty,
  SimSpeed,
  DriverCommand,
  LapResult,
  TireState,
  WeatherForecast,
  CommentaryEntry,
  RaceIncident,
  StrategyOption,
  BattleForecast,
  TireCompound,
  RaceWorkerStartPayload,
  RaceFlag,
} from '@/types/race'
import { calculateStrategyOptions } from '@/engine/race/pit-strategy'
import type { CalibrationProfile } from '@/types/calibration'
import { useGameStore } from '@/stores/game-store'
import {
  attachRaceWorker,
  createBrowserRaceWorkerHandle,
  type RaceWorkerAdapter,
  type RaceWorkerHandle,
} from '@/engine/race/race-worker-adapter'
import type { RaceSimPhase } from '@/stores/race-runtime-slice'

export type { RaceSimPhase }

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
  lapProgress: number
  baseLapTime: number
}

export interface RaceSimState {
  phase: RaceSimPhase
  currentLap: number
  totalLaps: number
  weather: WeatherForecast
  safetyCar: RaceFlag
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
  appliedPenaltiesByDriver: Record<string, AppliedPenalty[]>
  driverCommands: Record<string, DriverCommand>
  wearHistory: Record<string, number[]>
  compoundHistory: Record<string, TireCompound[]>
  carPositions: DriverLapProgress[]
  workerStatus: import('@/stores/race-runtime-slice').WorkerStatus
  workerError: import('@/stores/race-runtime-slice').RaceRuntimeError | null
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
  onRaceEnd?: (
    finalResults: LapResult[],
    fastestLap: { driverId: string; time: number },
    appliedPenaltiesByDriver: Record<string, AppliedPenalty[]>,
  ) => void
  workerHandleFactory?: () => RaceWorkerHandle
  /**
   * Optional circuit calibration. When provided, the hook feeds the
   * PitLossCalibration and StintCalibration into `calculateStrategyOptions`
   * so the pre-race strategy copy reflects the real circuit pit loss and
   * expected stint length.
   */
  calibration?: CalibrationProfile
}

const TICK_INTERVALS: Record<string, number> = {
  '1': 2000,
  '2': 1000,
  '5': 400,
  'max': 50,
}

export function useRaceSimulation({
  driverMeta,
  playerTeamId: _playerTeamId,
  onRaceEnd,
  workerHandleFactory,
  calibration,
}: UseRaceSimulationOptions) {
  const runtime = useGameStore((s) => s.raceRuntime)
  const resetRaceRuntime = useGameStore((s) => s.resetRaceRuntime)
  const setDriverCommand = useGameStore((s) => s.setDriverCommand)
  const requestPit = useGameStore((s) => s.requestPit)

  const adapterRef = useRef<RaceWorkerAdapter | null>(null)
  const raceEndFiredRef = useRef(false)

  // Sub-tick interpolation — presentation-only, stays out of the store.
  const rafRef = useRef<number>(0)
  const interpolationActive = useRef(false)
  const lastTickTimeRef = useRef(0)
  const nextTickTimeRef = useRef(0)
  const lapProgressRef = useRef<Record<string, { progress: number; baseLapTime: number }>>({})
  const carPositionsRef = useRef<DriverLapProgress[]>([])
  const lastSyncRef = useRef(0)
  const [carPositions, setCarPositions] = useState<DriverLapProgress[]>([])

  const metaMap = useRef(new Map<string, DriverMeta>())
  useEffect(() => {
    metaMap.current = new Map(driverMeta.map((d) => [d.id, d]))
  }, [driverMeta])

  // Build the derived timing tower from raw lap results.
  const timing: TimingEntry[] = useMemo(() => {
    if (runtime.lastLapResults.length === 0) return []
    const sorted = [...runtime.lastLapResults].sort((a, b) => a.position - b.position)
    return sorted.map((r) => {
      const meta = metaMap.current.get(r.driverId)
      return {
        position: r.position,
        driverId: r.driverId,
        driverName: meta?.shortName ?? r.driverId.substring(0, 3).toUpperCase(),
        teamColor: meta?.teamColor ?? '#666666',
        isPlayer: meta?.isPlayer ?? false,
        gapToLeader: r.gapToLeader,
        lastLapTime: r.lapTime,
        tire: runtime.tireStates[r.driverId]?.label ?? 'medium',
      }
    })
  }, [runtime.lastLapResults, runtime.tireStates])

  // Battle forecasts: pairs within 2s gap to the car ahead, capped at 3.
  const battles: BattleForecast[] = useMemo(() => {
    const out: BattleForecast[] = []
    const sorted = [...runtime.lastLapResults].sort((a, b) => a.position - b.position)
    for (let i = 1; i < sorted.length && out.length < 3; i++) {
      const gap = Math.abs(sorted[i].gapToAhead)
      if (gap < 2.0) {
        const attacker = metaMap.current.get(sorted[i].driverId)
        const defender = metaMap.current.get(sorted[i - 1].driverId)
        if (attacker && defender) {
          const prob = Math.max(0.1, Math.min(0.9, 1 - gap / 2.0))
          out.push({
            attackerId: attacker.shortName,
            defenderId: defender.shortName,
            overtakeProbability: prob,
            estimatedLaps: Math.max(1, Math.ceil(gap / 0.3)),
            description: gap < 0.5 ? 'DRS range' : gap < 1.0 ? 'Closing fast' : 'In striking distance',
          })
        }
      }
    }
    return out
  }, [runtime.lastLapResults])

  // Player pit strategy options derived from first player driver's tire state.
  const strategyOptions: StrategyOption[] = useMemo(() => {
    if (runtime.currentLap === 0) return []
    const firstPlayer = driverMeta.find((d) => d.isPlayer)
    if (!firstPlayer) return []
    const ts = runtime.tireStates[firstPlayer.id]
    if (!ts) return []
    return calculateStrategyOptions({
      currentLap: runtime.currentLap,
      totalLaps: runtime.totalLaps,
      tireWear: ts.wear,
      compound: ts.compound,
      circuitTireWear: 'medium',
      pitLossProfile: calibration?.pitLoss,
      stintProfile: calibration?.stint,
    })
  }, [runtime.currentLap, runtime.totalLaps, runtime.tireStates, driverMeta, calibration])

  // Update interpolation anchors whenever a new lap arrives.
  useEffect(() => {
    if (runtime.lastLapResults.length === 0) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    lastTickTimeRef.current = now
    const interval = TICK_INTERVALS[String(runtime.simSpeed)] ?? 2000
    nextTickTimeRef.current = now + interval

    const sorted = [...runtime.lastLapResults].sort((a, b) => a.position - b.position)
    const leaderLapTime = sorted.length > 0 ? sorted[0].lapTime : 90
    const progressMap: Record<string, { progress: number; baseLapTime: number }> = {}
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i]
      const gapFraction = Math.abs(r.gapToLeader) / Math.max(60, leaderLapTime)
      const minSpacing = i * 0.02
      const offset = Math.max(minSpacing, gapFraction)
      const clampedOffset = Math.min(0.85, offset)
      progressMap[r.driverId] = {
        progress: ((1.0 - clampedOffset) % 1 + 1) % 1,
        baseLapTime: r.lapTime,
      }
    }
    lapProgressRef.current = progressMap
  }, [runtime.lastLapResults, runtime.simSpeed])

  const runInterpolation = useCallback(() => {
    if (!interpolationActive.current) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const tickDuration = nextTickTimeRef.current - lastTickTimeRef.current
    const elapsed = now - lastTickTimeRef.current
    const tickFraction = tickDuration > 0 ? Math.min(1, elapsed / tickDuration) : 0

    const entries = Object.entries(lapProgressRef.current)
    if (entries.length > 0) {
      const positions: DriverLapProgress[] = entries.map(([driverId, info]) => {
        const meta = metaMap.current.get(driverId)
        const speedVariation = 90 / Math.max(80, info.baseLapTime)
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
      carPositionsRef.current = positions

      if (now - lastSyncRef.current > 100) {
        lastSyncRef.current = now
        const withPositions = positions.map((p) => {
          const t = timing.find((x) => x.driverId === p.driverId)
          return { ...p, position: t?.position ?? 0 }
        })
        withPositions.sort((a, b) => a.position - b.position)
        setCarPositions(withPositions)
      }
    }
    rafRef.current = requestAnimationFrame(runInterpolation)
  }, [timing])

  // Bridge runtime phase → interpolation loop.
  useEffect(() => {
    if (runtime.phase === 'running') {
      interpolationActive.current = true
      if (typeof requestAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(runInterpolation)
      }
    } else {
      interpolationActive.current = false
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [runtime.phase, runInterpolation])

  // Fire onRaceEnd exactly once per race when the worker reports completion.
  useEffect(() => {
    if (runtime.phase === 'finished' && runtime.finalResults && !raceEndFiredRef.current) {
      raceEndFiredRef.current = true
      onRaceEnd?.(
        runtime.finalResults,
        runtime.fastestLap ?? { driverId: '', time: Infinity },
        runtime.appliedPenaltiesByDriver,
      )
    }
  }, [runtime.phase, runtime.finalResults, runtime.fastestLap, runtime.appliedPenaltiesByDriver, onRaceEnd])

  // Teardown adapter + RAF on unmount.
  useEffect(() => {
    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafRef.current)
      }
      interpolationActive.current = false
      adapterRef.current?.dispose()
      adapterRef.current = null
    }
  }, [])

  const startRace = useCallback(
    (payload: RaceWorkerStartPayload) => {
      // Tear down any prior race and reset runtime slice before starting.
      adapterRef.current?.dispose()
      adapterRef.current = null
      resetRaceRuntime()
      raceEndFiredRef.current = false

      const factory = workerHandleFactory ?? createBrowserRaceWorkerHandle
      const handle = factory()
      const storeBinding = {
        applyRaceWorkerEvent: useGameStore.getState().applyRaceWorkerEvent,
        setRaceWorkerStatus: useGameStore.getState().setRaceWorkerStatus,
        setRacePhase: useGameStore.getState().setRacePhase,
        setRaceSimSpeed: useGameStore.getState().setRaceSimSpeed,
        setDriverCommandLocal: useGameStore.getState().setDriverCommandLocal,
        resetRaceRuntime: useGameStore.getState().resetRaceRuntime,
      }
      const adapter = attachRaceWorker({
        handle,
        store: storeBinding,
        commandBus: useGameStore.getState().raceCommandBus,
      })
      adapterRef.current = adapter
      adapter.start(payload)
    },
    [workerHandleFactory, resetRaceRuntime],
  )

  const setSpeed = useCallback((speed: SimSpeed) => {
    adapterRef.current?.setSpeed(speed)
  }, [])

  const pause = useCallback(() => {
    adapterRef.current?.pause()
  }, [])

  const resume = useCallback(() => {
    adapterRef.current?.resume()
  }, [])

  const sendCommand = useCallback(
    (driverId: string, command: DriverCommand) => {
      setDriverCommand(driverId, command)
    },
    [setDriverCommand],
  )

  const pitWithCompound = useCallback(
    (driverId: string, compound: TireCompound) => {
      requestPit(driverId, compound)
    },
    [requestPit],
  )

  const state: RaceSimState = useMemo(
    () => ({
      phase: runtime.phase,
      currentLap: runtime.currentLap,
      totalLaps: runtime.totalLaps,
      weather: runtime.weather,
      safetyCar: runtime.safetyCar,
      trackTemp: runtime.trackTemp,
      timing,
      tireStates: runtime.tireStates,
      commentary: runtime.commentary,
      incidents: runtime.incidents,
      strategies: strategyOptions,
      battles,
      simSpeed: runtime.simSpeed,
      finalResults: runtime.finalResults,
      fastestLap: runtime.fastestLap,
      appliedPenaltiesByDriver: runtime.appliedPenaltiesByDriver,
      driverCommands: runtime.driverCommands,
      wearHistory: runtime.wearHistory,
      compoundHistory: runtime.compoundHistory,
      carPositions,
      workerStatus: runtime.workerStatus,
      workerError: runtime.lastError,
    }),
    [runtime, timing, battles, strategyOptions, carPositions],
  )

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
