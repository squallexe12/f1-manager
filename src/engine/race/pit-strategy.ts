import type { TireCompound } from '@/types/race'
import type { StrategyOption } from '@/types/race'

interface PitStrategyInput {
  currentLap: number
  totalLaps: number
  tireWear: number        // current tire wear 0-100
  compound: TireCompound
  circuitTireWear: string // 'low' | 'medium' | 'high'
}

const WEAR_RATE: Record<string, number> = {
  low: 0.7,
  medium: 1.0,
  high: 1.4,
}

// Softer compounds for fresh tires after pit
const PIT_COMPOUND_MAP: Record<TireCompound, TireCompound> = {
  C1: 'C2',
  C2: 'C3',
  C3: 'C2', // Medium → go to Hard
  C4: 'C3',
  C5: 'C3',
}

export function calculateStrategyOptions(input: PitStrategyInput): StrategyOption[] {
  const { currentLap, totalLaps, tireWear, compound, circuitTireWear } = input

  const wearRate = WEAR_RATE[circuitTireWear] ?? 1.0
  const remainingLaps = totalLaps - currentLap

  // Estimate laps of life remaining at current wear rate
  // Rough: wear per lap ≈ (100 - tireWear) / lapsFitted, assume ~1.5 avg
  const estimatedLifeRemaining = Math.max(1, Math.floor(tireWear / (1.5 * wearRate)))

  // Optimum pit lap: when tires will hit ~20% wear
  const optimumOffset = Math.max(2, Math.min(estimatedLifeRemaining - 3, remainingLaps - 10))
  const optimumPitLap = currentLap + optimumOffset

  // Undercut: pit 3-5 laps before optimum
  const undercutOffset = Math.max(1, optimumOffset - 4)
  const undercutPitLap = currentLap + undercutOffset

  // Overcut: pit 3-5 laps after optimum
  const overcutOffset = Math.min(remainingLaps - 5, optimumOffset + 4)
  const overcutPitLap = currentLap + overcutOffset

  const newCompound = PIT_COMPOUND_MAP[compound]

  return [
    {
      type: 'undercut',
      pitLap: undercutPitLap,
      newCompound,
      projectedOutcome: 'Gain track position with fresh tire pace before rivals stop',
      probability: 0.55 + (tireWear < 40 ? 0.1 : 0),
      risk: 'May lose time if tires still had life remaining',
    },
    {
      type: 'optimum',
      pitLap: optimumPitLap,
      newCompound,
      projectedOutcome: 'Balanced stop maximizing tire life without losing pace',
      probability: 0.7,
      risk: 'Vulnerable to undercut from rivals',
    },
    {
      type: 'overcut',
      pitLap: overcutPitLap,
      newCompound,
      projectedOutcome: 'Extend stint for track position, benefit from clear air',
      probability: 0.45 - (tireWear < 25 ? 0.15 : 0),
      risk: 'Tire cliff could cause significant time loss',
    },
  ]
}
