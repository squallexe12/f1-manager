import type { TireCompound } from '@/types/race'
import type { StrategyOption } from '@/types/race'
import type { PitLossCalibration, StintCalibration } from '@/types/calibration'

interface PitStrategyInput {
  currentLap: number
  totalLaps: number
  tireWear: number        // current tire wear 0-100 (100 = new)
  compound: TireCompound
  circuitTireWear: string // 'low' | 'medium' | 'high' — legacy fallback
  /**
   * Optional circuit pit-loss calibration. When present, populates
   * `projectedPitLossSec` on each option and surfaces the cost in outcome copy.
   */
  pitLossProfile?: PitLossCalibration
  /**
   * Optional per-compound expected stint lengths. When present, the optimum
   * pit window is anchored to the compound's expected life instead of a
   * heuristic derived from the circuitTireWear enum.
   */
  stintProfile?: StintCalibration
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
  const {
    currentLap,
    totalLaps,
    tireWear,
    compound,
    circuitTireWear,
    pitLossProfile,
    stintProfile,
  } = input

  const wearRate = WEAR_RATE[circuitTireWear] ?? 1.0
  const remainingLaps = totalLaps - currentLap

  // Prefer the OpenF1-derived expected stint length when calibration is
  // available. It captures compound-specific realism (a Monaco C3 runs longer
  // than a Bahrain C3). Fall back to the legacy enum-driven heuristic when no
  // stint profile is supplied.
  const optimumOffset = stintProfile
    ? computeStintBasedOffset(tireWear, stintProfile.expectedLaps[compound], remainingLaps)
    : computeHeuristicOffset(tireWear, wearRate, remainingLaps)

  const optimumPitLap = currentLap + optimumOffset

  // Undercut: pit 3-5 laps before optimum
  const undercutOffset = Math.max(1, optimumOffset - 4)
  const undercutPitLap = currentLap + undercutOffset

  // Overcut: pit 3-5 laps after optimum
  const overcutOffset = Math.min(remainingLaps - 5, optimumOffset + 4)
  const overcutPitLap = currentLap + overcutOffset

  const newCompound = PIT_COMPOUND_MAP[compound]
  const pitLossSec = pitLossProfile?.meanLossSeconds
  const lossNote = pitLossSec != null ? ` (~${pitLossSec.toFixed(1)}s pit loss)` : ''

  return [
    {
      type: 'undercut',
      pitLap: undercutPitLap,
      newCompound,
      projectedOutcome: `Gain track position with fresh tire pace before rivals stop${lossNote}`,
      probability: 0.55 + (tireWear < 40 ? 0.1 : 0),
      risk: 'May lose time if tires still had life remaining',
      ...(pitLossSec != null ? { projectedPitLossSec: pitLossSec } : {}),
    },
    {
      type: 'optimum',
      pitLap: optimumPitLap,
      newCompound,
      projectedOutcome: `Balanced stop maximizing tire life without losing pace${lossNote}`,
      probability: 0.7,
      risk: 'Vulnerable to undercut from rivals',
      ...(pitLossSec != null ? { projectedPitLossSec: pitLossSec } : {}),
    },
    {
      type: 'overcut',
      pitLap: overcutPitLap,
      newCompound,
      projectedOutcome: `Extend stint for track position, benefit from clear air${lossNote}`,
      probability: 0.45 - (tireWear < 25 ? 0.15 : 0),
      risk: 'Tire cliff could cause significant time loss',
      ...(pitLossSec != null ? { projectedPitLossSec: pitLossSec } : {}),
    },
  ]
}

/**
 * Legacy offset derivation — preserved so callers without calibration data
 * keep their pre-IP-07 behavior.
 */
function computeHeuristicOffset(tireWear: number, wearRate: number, remainingLaps: number): number {
  const estimatedLifeRemaining = Math.max(1, Math.floor(tireWear / (1.5 * wearRate)))
  return Math.max(2, Math.min(estimatedLifeRemaining - 3, remainingLaps - 10))
}

/**
 * Calibration-aware offset derivation. Scales the compound's expected stint
 * length by the remaining tread fraction, then clamps against race length.
 */
function computeStintBasedOffset(tireWear: number, expectedStintLaps: number, remainingLaps: number): number {
  const treadFraction = Math.max(0, Math.min(1, tireWear / 100))
  const projectedRemaining = Math.max(1, Math.round(expectedStintLaps * treadFraction))
  // Pit a couple of laps before the cliff so fresh rubber is always ahead of
  // the tire's performance drop-off.
  const offset = Math.max(2, projectedRemaining - 2)
  return Math.min(offset, Math.max(2, remainingLaps - 5))
}
