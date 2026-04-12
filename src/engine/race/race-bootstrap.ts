import type {
  Circuit, RaceState, RaceStrategy, TireCompound, DriverCommand,
  BootstrapDriverInput, BootstrapStrategyInput, RaceBootstrapInput,
} from '@/types/race'
import type { RaceDriver } from './race-simulator'
import { createPRNG } from '@/engine/core/prng'

export type { BootstrapDriverInput, BootstrapStrategyInput, RaceBootstrapInput }

export interface RaceBootstrapOutput {
  raceState: RaceState
  raceDrivers: RaceDriver[]
  strategies: RaceStrategy[]
  startCompounds: Record<string, TireCompound>
  circuitInfo: {
    tireWear: Circuit['tireWear']
    overtakingDifficulty: Circuit['overtakingDifficulty']
    weatherVariability: Circuit['weatherVariability']
    compounds: Circuit['compounds']
  }
  raceSeed: number
}

const MIN_TRACK_TEMP = 35
const MAX_TRACK_TEMP = 50

export function deriveRaceSeed(seed: number, round: number): number {
  return (seed + round) | 0
}

export function bootstrapRace(input: RaceBootstrapInput): RaceBootstrapOutput {
  const { seed, round, circuit, drivers, strategies } = input

  const raceSeed = deriveRaceSeed(seed, round)
  const prng = createPRNG(raceSeed ^ 0x9e3779b9)
  const trackTemp = MIN_TRACK_TEMP + prng.next() * (MAX_TRACK_TEMP - MIN_TRACK_TEMP)

  const raceState: RaceState = {
    currentLap: 0,
    totalLaps: circuit.laps,
    weather: { current: 'dry', rainProbability: 0.15, changeInLaps: null },
    safetyCar: 'green',
    trackTemp,
    results: [],
    incidents: [],
    commentary: [],
  }

  const defaultStops = [{ lap: Math.floor(circuit.laps * 0.45), compound: circuit.compounds[0] }]
  const strategyMap = new Map(strategies?.map((s) => [s.driverId, s]) ?? [])

  const outStrategies: RaceStrategy[] = drivers.map((d) => {
    const plan = strategyMap.get(d.id)
    return {
      driverId: d.id,
      plannedStops: plan?.stops ?? defaultStops,
      currentCommand: 'standard' as DriverCommand,
    }
  })

  const raceDrivers: RaceDriver[] = drivers.map((d) => ({
    id: d.id,
    car: { ...d.car },
    attributes: { ...d.attributes },
  }))

  const startCompounds: Record<string, TireCompound> = {}
  for (const d of drivers) {
    const plan = strategyMap.get(d.id)
    startCompounds[d.id] = plan?.startCompound ?? circuit.compounds[1]
  }

  return {
    raceState,
    raceDrivers,
    strategies: outStrategies,
    startCompounds,
    circuitInfo: {
      tireWear: circuit.tireWear,
      overtakingDifficulty: circuit.overtakingDifficulty,
      weatherVariability: circuit.weatherVariability,
      compounds: circuit.compounds,
    },
    raceSeed,
  }
}
