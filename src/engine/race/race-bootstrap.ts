import type {
  Circuit, RaceState, RaceStrategy, TireCompound, DriverCommand,
  BootstrapDriverInput, BootstrapStrategyInput, RaceBootstrapInput,
} from '@/types/race'
import type { CalibrationProfile } from '@/types/calibration'
import type { RaceDriver } from './race-simulator'
import { createPRNG } from '@/engine/core/prng'
import { resolveCalibrationForCircuit } from '@/data/calibration'

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
  calibration: CalibrationProfile
  raceSeed: number
}

const MIN_TRACK_TEMP = 35
const MAX_TRACK_TEMP = 50

export function deriveRaceSeed(seed: number, round: number): number {
  return (seed + round) | 0
}

export function bootstrapRace(input: RaceBootstrapInput): RaceBootstrapOutput {
  const { seed, round, circuit, drivers, strategies, calibration: calibrationOverride } = input

  const raceSeed = deriveRaceSeed(seed, round)
  const prng = createPRNG(raceSeed ^ 0x9e3779b9)
  const trackTemp = MIN_TRACK_TEMP + prng.next() * (MAX_TRACK_TEMP - MIN_TRACK_TEMP)

  const calibration: CalibrationProfile = calibrationOverride
    ? JSON.parse(JSON.stringify(calibrationOverride)) as CalibrationProfile
    : resolveCalibrationForCircuit(circuit)

  const raceState: RaceState = {
    currentLap: 0,
    totalLaps: circuit.laps,
    weather: { current: 'dry', rainProbability: calibration.weather.baseRainProbability, changeInLaps: null },
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
    shortName: d.shortName,
    teamId: d.teamId,
    car: { ...d.car },
    attributes: { ...d.attributes },
    mood: { ...d.mood },
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
    calibration,
    raceSeed,
  }
}

// ---------------------------------------------------------------------------
// Ban substitution helpers
// ---------------------------------------------------------------------------

export interface BanSubstitutionInput {
  id: string
  teamId: string
  banUntilRound: number | null
  isReserve: boolean
}

export interface BanSubstitutionTeam {
  id: string
  reserveDriverId: string | null
}

export interface BanSubstitutionResult<T extends BanSubstitutionInput> {
  drivers: T[]
  substitutions: { bannedId: string; substituteId: string | null; teamId: string }[]
}

/**
 * For each banned driver in the lineup whose banUntilRound covers the current
 * round, substitute the team reserve (lookup by team.reserveDriverId, then
 * fall through to the first roster member with isReserve=true). If no reserve
 * is available, the banned driver is dropped (one-car team). Pure.
 */
export function applyBanSubstitution<T extends BanSubstitutionInput>(
  lineup: T[],
  roster: T[],
  teams: BanSubstitutionTeam[],
  currentRound: number,
): BanSubstitutionResult<T> {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const drivers: T[] = []
  const substitutions: BanSubstitutionResult<T>['substitutions'] = []
  for (const driver of lineup) {
    const isBanned = driver.banUntilRound !== null && currentRound <= driver.banUntilRound
    if (!isBanned) {
      drivers.push(driver)
      continue
    }
    const team = teamById.get(driver.teamId)
    let substitute: T | undefined
    if (team?.reserveDriverId) {
      substitute = roster.find((d) => d.id === team.reserveDriverId)
    }
    if (!substitute) {
      substitute = roster.find((d) => d.teamId === driver.teamId && d.isReserve)
    }
    if (substitute) {
      drivers.push(substitute)
      substitutions.push({ bannedId: driver.id, substituteId: substitute.id, teamId: driver.teamId })
    } else {
      substitutions.push({ bannedId: driver.id, substituteId: null, teamId: driver.teamId })
    }
  }
  return { drivers, substitutions }
}

// ---------------------------------------------------------------------------
// Grid drop helpers
// ---------------------------------------------------------------------------

/**
 * Applies grid-position drops after qualifying. Pure: returns a new array.
 * Drops that would push a driver past the back of the grid clamp to the last
 * position. Multiple drops are resolved by a stable sort pass.
 *
 * Tiebreak order when two drivers share a target slot:
 *   1. Non-penalised before penalised (a penalised driver yielding to
 *      whoever naturally qualified there)
 *   2. Within the same penalty-status group, lower original qualifying
 *      position wins (stable sort)
 */
export function applyGridDrops(
  qualifiedOrder: string[],
  drops: Record<string, number>,
): { gridOrder: string[] } {
  const gridSize = qualifiedOrder.length
  const indexed = qualifiedOrder.map((id, i) => {
    const drop = drops[id] ?? 0
    const penalised = drop > 0
    // Clamp target index to [0, gridSize - 1]
    const target = Math.min(i + drop, gridSize - 1)
    return { id, target, original: i, penalised }
  })
  // Stable sort:
  //   primary   — target position (ascending)
  //   secondary — non-penalised before penalised (false < true)
  //   tertiary  — original qualifying order (ascending, stable)
  indexed.sort((a, b) => {
    if (a.target !== b.target) return a.target - b.target
    if (a.penalised !== b.penalised) return a.penalised ? 1 : -1
    return a.original - b.original
  })
  return { gridOrder: indexed.map((x) => x.id) }
}
