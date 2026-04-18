import type { CarPerformance } from '@/types/team'
import type { DriverAttributes } from '@/types/driver'
import type {
  TireCompound, TireState, LapResult, RaceStrategy,
  DriverCommand, CommentaryEntry, RaceIncident, WeatherState,
} from '@/types/race'
import type { CalibrationProfile } from '@/types/calibration'
import type { PRNG } from '@/engine/core/prng'
import { createPRNG } from '@/engine/core/prng'
import { getTirePerformance, degradeTire } from './tire-model'
import { calculateOvertakeProbability } from './overtake'
import { WeatherEngine } from './weather'
import { resolveCalibrationForCircuit } from '@/data/calibration'

export interface RaceDriver {
  id: string
  car: CarPerformance
  attributes: DriverAttributes
}

export interface SimRaceState {
  currentLap: number
  totalLaps: number
  weather: { current: WeatherState; rainProbability: number; changeInLaps: number | null }
  safetyCar: 'green' | 'vsc' | 'sc'
  trackTemp: number
  results: LapResult[][]
  incidents: RaceIncident[]
  commentary: CommentaryEntry[]
  drivers: RaceDriver[]
  circuit: { tireWear: string; overtakingDifficulty: 'low' | 'medium' | 'high'; weatherVariability: string; compounds?: [TireCompound, TireCompound, TireCompound] }
  calibration: CalibrationProfile
  strategies: RaceStrategy[]
  tireStates: Record<string, TireState>
  positions: string[] // driver IDs in position order
}

export interface RaceSetup {
  drivers: RaceDriver[]
  circuit: {
    id: string; name: string; laps: number
    tireWear: string; overtakingDifficulty: 'low' | 'medium' | 'high'
    weatherVariability: string
    compounds: [TireCompound, TireCompound, TireCompound]
  }
  strategies: RaceStrategy[]
  weather: WeatherState
  gridOrder: string[] // driver IDs in grid position order
  calibration?: CalibrationProfile
}

export interface LapSimResult {
  lapResults: LapResult[]
  commentary: CommentaryEntry[]
  incidents: RaceIncident[]
}

// Command modifiers: [pace_multiplier, tire_wear_multiplier]
const COMMAND_MODIFIERS: Record<DriverCommand, [number, number]> = {
  push: [1.02, 1.3],
  standard: [1.0, 1.0],
  conserve: [0.97, 0.7],
  overtake: [1.03, 1.4],
  defend: [0.99, 1.1],
  pit: [0.95, 1.0], // slowing down to pit
}

function calculateBaseLapTime(driver: RaceDriver, tirePerf: number, weather: WeatherState): number {
  const { car, attributes } = driver

  // Base time from car performance (90 seconds baseline for a mid-range car)
  const carAvg = (car.downforce + car.straightSpeed + car.braking + car.cornering) / 4
  const carTime = 95 - (carAvg / 100) * 10 // 85-95s range

  // Driver contribution: pace attribute shaves time
  const driverTime = -(attributes.pace / 100) * 2 // up to -2s

  // Tire performance
  const tireTime = (1 - tirePerf) * 5 // up to +5s penalty on dead tires

  // Weather penalty
  const weatherPenalty = weather === 'wet' ? 8 : weather === 'damp' ? 3 : 0

  return carTime + driverTime + tireTime + weatherPenalty
}

export function simulateLap(state: SimRaceState, rng: PRNG): LapSimResult {
  const lapResults: LapResult[] = []
  const commentary: CommentaryEntry[] = []
  const incidents: RaceIncident[] = []

  const positions = [...state.positions]
  const tireCal = state.calibration.tires
  const overtakeCal = state.calibration.overtake

  for (let posIdx = 0; posIdx < positions.length; posIdx++) {
    const driverId = positions[posIdx]
    const driver = state.drivers.find(d => d.id === driverId)!
    const strategy = state.strategies.find(s => s.driverId === driverId)!
    const tire = state.tireStates[driverId]
    const tirePerf = getTirePerformance(tire, tireCal)

    // Auto-trigger planned pit stop when the current lap reaches the next scheduled stop.
    // Deterministic — driven purely by state, no PRNG involved.
    const nextPlannedStop = strategy.plannedStops[0]
    if (
      nextPlannedStop !== undefined &&
      state.currentLap >= nextPlannedStop.lap &&
      strategy.currentCommand !== 'pit'
    ) {
      strategy.currentCommand = 'pit'
    }

    const [paceMod, tireMod] = COMMAND_MODIFIERS[strategy.currentCommand]

    // Base lap time
    let lapTime = calculateBaseLapTime(driver, tirePerf, state.weather.current)

    // Apply command modifier (push = faster = lower time, divide by paceMod)
    lapTime = lapTime / paceMod

    // Add randomness (±0.3s variation)
    lapTime += (rng.next() - 0.5) * 0.6

    // Experience reduces variance
    const consistencyBonus = (driver.attributes.experience / 100) * 0.1
    lapTime -= consistencyBonus

    // Sector split (rough 35/30/35 distribution)
    const s1Frac = 0.35 + (rng.next() - 0.5) * 0.02
    const s2Frac = 0.30 + (rng.next() - 0.5) * 0.02
    const s3Frac = 1 - s1Frac - s2Frac

    // Handle pit stop — swap tires to fresh compound
    let pitted = false
    if (strategy.currentCommand === 'pit') {
      const nextStop = strategy.plannedStops[0]
      const newCompound = nextStop?.compound ?? 'C2'
      // Derive label from position in circuit's compound array (hardest→softest)
      const circuitCompounds = state.circuit.compounds
      let label: 'hard' | 'medium' | 'soft' = 'medium'
      if (circuitCompounds) {
        const idx = circuitCompounds.indexOf(newCompound)
        label = idx === 0 ? 'hard' : idx === 2 ? 'soft' : 'medium'
      }
      state.tireStates[driverId] = {
        compound: newCompound,
        label,
        wear: 100,
        lapsFitted: 0,
      }
      // Add pit stop time penalty (~22 seconds)
      lapTime += 22
      pitted = true
      // Reset command back to standard after pitting
      strategy.currentCommand = 'standard'
      // Remove used stop
      if (strategy.plannedStops.length > 0) {
        strategy.plannedStops = strategy.plannedStops.slice(1)
      }
      commentary.push({
        lap: state.currentLap,
        text: `${driverId.toUpperCase()} pits for ${newCompound} tires`,
        severity: 'highlight',
      })
    } else {
      // Degrade tires for this lap
      const newTire = degradeTire(tire, tireCal, state.trackTemp)
      // Apply extra tire wear from command
      newTire.wear = Math.max(0, newTire.wear - (tireMod - 1) * 1.5)
      state.tireStates[driverId] = newTire
    }

    const currentTire = state.tireStates[driverId]

    lapResults.push({
      lap: state.currentLap,
      driverId,
      lapTime,
      sector1: lapTime * s1Frac,
      sector2: lapTime * s2Frac,
      sector3: lapTime * s3Frac,
      position: posIdx + 1,
      gapToLeader: 0, // calculated after sorting
      gapToAhead: 0,
      tire: { ...currentTire },
      pitted,
    })
  }

  // Sort by cumulative time (use lap time as proxy for position changes)
  // Simple position model: compare consecutive drivers for overtakes
  for (let i = 1; i < positions.length; i++) {
    const aheadId = positions[i - 1]
    const behindId = positions[i]
    const aheadResult = lapResults.find(r => r.driverId === aheadId)!
    const behindResult = lapResults.find(r => r.driverId === behindId)!
    const behindDriver = state.drivers.find(d => d.id === behindId)!

    // If car behind is significantly faster this lap, check overtake
    const timeDelta = aheadResult.lapTime - behindResult.lapTime
    if (timeDelta > 0.15) {
      const overtakeResult = calculateOvertakeProbability({
        performanceDelta: timeDelta,
        racecraft: behindDriver.attributes.racecraft,
        calibration: overtakeCal,
        tireDelta: (state.tireStates[behindId].wear - state.tireStates[aheadId].wear),
      })

      if (rng.chance(overtakeResult.probability)) {
        // Swap positions
        positions[i - 1] = behindId
        positions[i] = aheadId
        commentary.push({
          lap: state.currentLap,
          text: `${behindId.toUpperCase()} overtakes ${aheadId.toUpperCase()} for P${i}!`,
          severity: 'highlight',
        })
      }
    }
  }

  // Update positions in results
  for (let i = 0; i < positions.length; i++) {
    const result = lapResults.find(r => r.driverId === positions[i])!
    result.position = i + 1
    result.gapToLeader = i === 0 ? 0 : result.lapTime - lapResults.find(r => r.driverId === positions[0])!.lapTime
    result.gapToAhead = i === 0 ? 0 : result.lapTime - lapResults.find(r => r.driverId === positions[i - 1])!.lapTime
  }

  // Update state positions
  state.positions = positions

  return { lapResults, commentary, incidents }
}

export interface RaceResult {
  finalPositions: string[]
  lapData: LapResult[][]
  commentary: CommentaryEntry[]
  incidents: RaceIncident[]
  fastestLap: { driverId: string; time: number }
}

export function simulateRace(setup: RaceSetup, seed: number): RaceResult {
  const rng = createPRNG(seed)
  const calibration = setup.calibration ?? resolveCalibrationForCircuit({
    id: setup.circuit.id,
    name: setup.circuit.name,
    country: '',
    laps: setup.circuit.laps,
    downforceLevel: 'medium',
    tireWear: setup.circuit.tireWear as 'low' | 'medium' | 'high',
    overtakingDifficulty: setup.circuit.overtakingDifficulty,
    weatherVariability: setup.circuit.weatherVariability as 'low' | 'medium' | 'high',
    sectorCount: 3,
    compounds: setup.circuit.compounds,
  })
  const weatherEngine = new WeatherEngine(setup.weather, calibration.weather, createPRNG(seed + 1))

  // Initialize tire states (start on first compound in strategy)
  const tireStates: Record<string, TireState> = {}
  for (const strategy of setup.strategies) {
    const compound = strategy.plannedStops.length > 0
      ? setup.circuit.compounds[2] // start on softest available
      : setup.circuit.compounds[1]
    tireStates[strategy.driverId] = {
      compound,
      label: 'medium',
      wear: 100,
      lapsFitted: 0,
    }
  }

  const state: SimRaceState = {
    currentLap: 0,
    totalLaps: setup.circuit.laps,
    weather: weatherEngine.getForecast(setup.circuit.laps),
    safetyCar: 'green',
    trackTemp: 35 + rng.range(-5, 10),
    results: [],
    incidents: [],
    commentary: [],
    drivers: setup.drivers,
    circuit: setup.circuit,
    calibration,
    strategies: setup.strategies.map(s => ({ ...s })),
    tireStates,
    positions: setup.gridOrder || setup.drivers.map(d => d.id),
  }

  const allLapData: LapResult[][] = []
  const allCommentary: CommentaryEntry[] = []
  const allIncidents: RaceIncident[] = []
  let fastestLap = { driverId: '', time: Infinity }

  for (let lap = 1; lap <= setup.circuit.laps; lap++) {
    state.currentLap = lap
    weatherEngine.tick()
    state.weather = weatherEngine.getForecast(setup.circuit.laps - lap)

    const { lapResults, commentary, incidents } = simulateLap(state, rng)

    allLapData.push(lapResults)
    allCommentary.push(...commentary)
    allIncidents.push(...incidents)

    // Track fastest lap
    for (const result of lapResults) {
      if (result.lapTime < fastestLap.time) {
        fastestLap = { driverId: result.driverId, time: result.lapTime }
      }
    }
  }

  return {
    finalPositions: [...state.positions],
    lapData: allLapData,
    commentary: allCommentary,
    incidents: allIncidents,
    fastestLap,
  }
}
