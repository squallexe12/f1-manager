import type {
  WorkerInMessage, WorkerOutMessage, SimSpeed,
  RaceStrategy, DriverCommand, LapResult, TireState,
} from '@/types/race'
import { simulateLap, type SimRaceState, type RaceDriver } from '@/engine/race/race-simulator'
import { WeatherEngine } from '@/engine/race/weather'
import { createPRNG, type PRNG } from '@/engine/core/prng'

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

function postMessage(msg: WorkerOutMessage) {
  (self as unknown as Worker).postMessage(msg)
}

function simulateNextLap() {
  if (!raceState || !rng || !weatherEngine || isPaused) return

  if (raceState.currentLap >= raceState.totalLaps) {
    // Race finished
    const finalResults = raceState.positions.map((driverId, idx) => ({
      driverId,
      position: idx + 1,
    }))

    // Find fastest lap
    let fastestLap = { driverId: '', time: Infinity }
    for (const lapResults of raceState.results) {
      for (const result of lapResults) {
        if (result.lapTime < fastestLap.time) {
          fastestLap = { driverId: result.driverId, time: result.lapTime }
        }
      }
    }

    postMessage({
      type: 'raceEnd',
      finalResults: raceState.results[raceState.results.length - 1] ?? [],
      fastestLap,
    })
    return
  }

  raceState.currentLap++
  weatherEngine.tick()
  raceState.weather = weatherEngine.getForecast(raceState.totalLaps - raceState.currentLap)

  const { lapResults, commentary, incidents } = simulateLap(raceState, rng)

  raceState.results.push(lapResults)
  raceState.incidents.push(...incidents)
  raceState.commentary.push(...commentary)

  // Gather tire states
  const tireStates: Record<string, TireState> = { ...raceState.tireStates }

  postMessage({
    type: 'lapUpdate',
    lap: raceState.currentLap,
    results: lapResults,
    tireStates,
    weather: raceState.weather,
    safetyCar: raceState.safetyCar,
  })

  if (commentary.length > 0) {
    postMessage({ type: 'commentary', entries: commentary })
  }

  for (const incident of incidents) {
    postMessage({ type: 'incident', incident })
  }

  // Schedule next lap
  const interval = TICK_INTERVALS[String(simSpeed)] ?? 2000
  tickTimer = setTimeout(simulateNextLap, interval)
}

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data

  switch (msg.type) {
    case 'start': {
      rng = createPRNG(msg.seed)
      weatherEngine = new WeatherEngine(
        msg.raceState.weather.current,
        'medium', // default variability
        createPRNG(msg.seed + 1),
      )

      raceState = {
        ...msg.raceState,
        strategies: msg.strategies,
        drivers: [] as RaceDriver[], // will be populated by main thread
        circuit: { tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'medium' },
        tireStates: {},
        positions: msg.strategies.map(s => s.driverId),
      } as unknown as SimRaceState

      isPaused = false
      simulateNextLap()
      break
    }

    case 'setSpeed':
      simSpeed = msg.speed
      break

    case 'pause':
      isPaused = true
      if (tickTimer) clearTimeout(tickTimer)
      break

    case 'resume':
      isPaused = false
      simulateNextLap()
      break

    case 'command':
      if (raceState) {
        const strategy = raceState.strategies.find(s => s.driverId === msg.driverId)
        if (strategy) {
          strategy.currentCommand = msg.command
        }
      }
      break

    case 'strategyChange':
      if (raceState) {
        const idx = raceState.strategies.findIndex(s => s.driverId === msg.driverId)
        if (idx >= 0) {
          raceState.strategies[idx] = msg.strategy
        }
      }
      break
  }
}
