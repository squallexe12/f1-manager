import type {
  WorkerInMessage, WorkerOutMessage, WorkerOutEvent, SimSpeed,
  TireState, TireCompound, RaceStrategy,
} from '@/types/race'
import { simulateLap, type SimRaceState } from '@/engine/race/race-simulator'
import { bootstrapRace } from '@/engine/race/race-bootstrap'
import { applyCommandEnvelopeToSim } from '@/engine/race/race-command-apply'
import { WeatherEngine } from '@/engine/race/weather'
import { createPRNG, type PRNG } from '@/engine/core/prng'
import { buildErrorEvent, isWorkerInMessage } from './race-worker-protocol'

let raceState: SimRaceState | null = null
let rng: PRNG | null = null
let weatherEngine: WeatherEngine | null = null
let simSpeed: SimSpeed = 1
let isPaused = false
let tickTimer: ReturnType<typeof setTimeout> | null = null

const TICK_INTERVALS: Record<SimSpeed | string, number> = {
  1: 2000,
  2: 1000,
  5: 400,
  max: 50,
}

function postEvent(msg: WorkerOutMessage): void {
  (self as unknown as Worker).postMessage(msg)
}

function emitError(event: WorkerOutEvent): void {
  postEvent(event)
}

function lastValidLap(): number {
  return raceState?.currentLap ?? 0
}

function resolveLabel(compound: TireCompound, compounds?: readonly TireCompound[]): TireState['label'] {
  if (!compounds) return 'medium'
  const idx = compounds.indexOf(compound)
  if (idx === 0) return 'hard'
  if (idx === 2) return 'soft'
  return 'medium'
}

function simulateNextLap(): void {
  if (!raceState || !rng || !weatherEngine || isPaused) return

  if (raceState.currentLap >= raceState.totalLaps) {
    const lastResults = raceState.results[raceState.results.length - 1] ?? []
    let fastestLap = { driverId: '', time: Infinity }
    for (const lapResults of raceState.results) {
      for (const result of lapResults) {
        if (result.lapTime < fastestLap.time) {
          fastestLap = { driverId: result.driverId, time: result.lapTime }
        }
      }
    }
    postEvent({
      type: 'raceEnd',
      finalResults: lastResults,
      fastestLap,
    })
    return
  }

  try {
    raceState.currentLap++
    weatherEngine.tick()
    raceState.weather = weatherEngine.getForecast(raceState.totalLaps - raceState.currentLap)

    const { lapResults, commentary, incidents } = simulateLap(raceState, rng)

    raceState.results.push(lapResults)
    raceState.incidents.push(...incidents)
    raceState.commentary.push(...commentary)

    postEvent({
      type: 'lapUpdate',
      lap: raceState.currentLap,
      results: lapResults,
      tireStates: { ...raceState.tireStates },
      weather: raceState.weather,
      safetyCar: raceState.safetyCar,
    })

    if (commentary.length > 0) {
      postEvent({ type: 'commentary', entries: commentary })
    }
    for (const incident of incidents) {
      postEvent({ type: 'incident', incident })
    }
  } catch (err) {
    emitError(buildErrorEvent(
      'runtime/simulation-failure',
      err instanceof Error ? err.message : String(err),
      true,
      { canRetry: false, lastValidLap: lastValidLap() },
    ))
    return
  }

  const interval = TICK_INTERVALS[String(simSpeed)] ?? 2000
  tickTimer = setTimeout(simulateNextLap, interval)
}

export function __handleMessage(msg: unknown): void {
  if (!isWorkerInMessage(msg)) {
    emitError(buildErrorEvent(
      'start/invalid-payload',
      'Inbound worker message failed schema validation',
      false,
    ))
    return
  }

  switch (msg.type) {
    case 'start': {
      const payload = msg.payload
      if (!payload.drivers || payload.drivers.length === 0) {
        emitError(buildErrorEvent(
          'start/missing-drivers',
          'start payload must include at least one driver',
          true,
        ))
        return
      }

      const boot = bootstrapRace({
        seed: payload.seed,
        round: payload.round,
        circuit: payload.circuit,
        isSprint: payload.isSprint,
        drivers: payload.drivers,
        strategies: payload.strategies,
      })

      rng = createPRNG(boot.raceSeed)
      weatherEngine = new WeatherEngine(
        boot.raceState.weather.current,
        boot.calibration.weather,
        createPRNG(boot.raceSeed + 1),
      )

      const tireStates: Record<string, TireState> = {}
      for (const s of boot.strategies) {
        const compound = boot.startCompounds[s.driverId] ?? boot.circuitInfo.compounds[1]
        tireStates[s.driverId] = {
          compound,
          label: resolveLabel(compound, boot.circuitInfo.compounds),
          wear: 100,
          lapsFitted: 0,
        }
      }

      const strategies: RaceStrategy[] = boot.strategies.map((s) => ({
        driverId: s.driverId,
        plannedStops: s.plannedStops.map((stop) => ({ ...stop })),
        currentCommand: s.currentCommand,
      }))

      raceState = {
        currentLap: boot.raceState.currentLap,
        totalLaps: boot.raceState.totalLaps,
        weather: boot.raceState.weather,
        safetyCar: boot.raceState.safetyCar,
        trackTemp: boot.raceState.trackTemp,
        results: [],
        incidents: [],
        commentary: [],
        drivers: boot.raceDrivers,
        circuit: {
          tireWear: boot.circuitInfo.tireWear,
          overtakingDifficulty: boot.circuitInfo.overtakingDifficulty,
          weatherVariability: boot.circuitInfo.weatherVariability,
          compounds: boot.circuitInfo.compounds,
        },
        calibration: boot.calibration,
        strategies,
        tireStates,
        positions: strategies.map((s) => s.driverId),
        cumulativeTimes: Object.fromEntries(strategies.map((s) => [s.driverId, 0])),
      }

      isPaused = false
      if (payload.simSpeed !== undefined) simSpeed = payload.simSpeed

      postEvent({
        type: 'ready',
        lap: raceState.currentLap,
        totalLaps: raceState.totalLaps,
      })

      simulateNextLap()
      return
    }

    case 'setSpeed':
      simSpeed = msg.speed
      return

    case 'pause':
      isPaused = true
      if (tickTimer) {
        clearTimeout(tickTimer)
        tickTimer = null
      }
      return

    case 'resume':
      if (!raceState) return
      isPaused = false
      simulateNextLap()
      return

    case 'command': {
      if (!raceState) {
        emitError(buildErrorEvent(
          'command/invalid-envelope',
          'command received before start',
          false,
        ))
        return
      }
      const result = applyCommandEnvelopeToSim(raceState, msg.envelope)
      if (!result.applied) {
        emitError(buildErrorEvent(
          'command/unknown-driver',
          `command for unknown driver ${msg.envelope.driverId}`,
          false,
        ))
      }
      return
    }
  }
}

export function __resetForTest(): void {
  if (tickTimer) clearTimeout(tickTimer)
  raceState = null
  rng = null
  weatherEngine = null
  simSpeed = 1
  isPaused = false
  tickTimer = null
}

// Wire to Web Worker global scope only when running inside a worker context.
// Unit tests import this module directly and drive __handleMessage instead.
if (typeof self !== 'undefined' && typeof (self as { onmessage?: unknown }).onmessage !== 'undefined') {
  ;(self as unknown as Worker).onmessage = (event: MessageEvent<WorkerInMessage>) => {
    __handleMessage(event.data)
  }
}
