import type { TireCompound } from '@/types/race'
import type { StrategyOption } from '@/types/race'
import type { PitLossCalibration, StintCalibration } from '@/types/calibration'
import type { PRNG } from '@/engine/core/prng'

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
  /**
   * M6 — the player's accumulated tire-deg read (0..100, default 50). Shapes
   * strategy-recommendation QUALITY, never which option wins: it scales the
   * displayed probabilities (confidence) and, when a seeded PRNG is supplied,
   * jitters the read of the optimum window.
   */
  tireDegReadAccuracy?: number
  /**
   * M6 — optional seeded PRNG for optimum-window noise. The live Strategy Room
   * passes NONE (noiseless → zero draws added to any stream); tests and the
   * balance harness pass a seeded source to exercise the read-error model.
   * Never `Math.random()`.
   */
  prng?: PRNG
}

/**
 * M6 — perturb the optimum-window offset by the player's read error. Noise is
 * applied ONLY when a seeded PRNG is supplied; a perfect read (accuracy 100) is
 * exact. Range is ±5 laps scaled by `1 - accuracy/100`. Pure given the PRNG;
 * never calls `Math.random()`.
 */
export function applyDegReadNoise(offset: number, accuracy: number, prng?: PRNG): number {
  if (!prng) return offset
  const a = Math.max(0, Math.min(100, accuracy))
  const noiseRange = 5 * (1 - a / 100)
  if (noiseRange === 0) return offset
  const noise = Math.round((prng.next() * 2 - 1) * noiseRange)
  return offset + noise
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
    prng,
  } = input

  const wearRate = WEAR_RATE[circuitTireWear] ?? 1.0
  const remainingLaps = totalLaps - currentLap

  // M6 — tire-deg read. Drives confidence (probability) scaling and, when a
  // PRNG is supplied, optimum-window noise. Clamp defensively to [0, 100].
  const accuracy = Math.max(0, Math.min(100, input.tireDegReadAccuracy ?? 50))
  // Confidence: a better read raises displayed probabilities. Applied uniformly
  // to every option so it NEVER reorders which strategy is best.
  const probScaleFactor = 0.8 + 0.2 * (accuracy / 100)
  const scaleProb = (p: number): number => Math.max(0, Math.min(1, p * probScaleFactor))

  // Prefer the OpenF1-derived expected stint length when calibration is
  // available. It captures compound-specific realism (a Monaco C3 runs longer
  // than a Bahrain C3). Fall back to the legacy enum-driven heuristic when no
  // stint profile is supplied.
  const optimumOffset = stintProfile
    ? computeStintBasedOffset(tireWear, stintProfile.expectedLaps[compound], remainingLaps)
    : computeHeuristicOffset(tireWear, wearRate, remainingLaps)

  // The team's READ of the optimum window. Noise applies only with a seeded
  // PRNG; the live Strategy Room passes none → noiseless. The pit-loss
  // calibration that ranks the options is unaffected — only the read moves.
  const readOffset = applyDegReadNoise(optimumOffset, accuracy, prng)

  const optimumPitLap = currentLap + readOffset

  // Undercut: pit 3-5 laps before optimum
  const undercutOffset = Math.max(1, readOffset - 4)
  const undercutPitLap = currentLap + undercutOffset

  // Overcut: pit 3-5 laps after optimum
  const overcutOffset = Math.min(remainingLaps - 5, readOffset + 4)
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
      probability: scaleProb(0.55 + (tireWear < 40 ? 0.1 : 0)),
      risk: 'May lose time if tires still had life remaining',
      ...(pitLossSec != null ? { projectedPitLossSec: pitLossSec } : {}),
    },
    {
      type: 'optimum',
      pitLap: optimumPitLap,
      newCompound,
      projectedOutcome: `Balanced stop maximizing tire life without losing pace${lossNote}`,
      probability: scaleProb(0.7),
      risk: 'Vulnerable to undercut from rivals',
      ...(pitLossSec != null ? { projectedPitLossSec: pitLossSec } : {}),
    },
    {
      type: 'overcut',
      pitLap: overcutPitLap,
      newCompound,
      projectedOutcome: `Extend stint for track position, benefit from clear air${lossNote}`,
      probability: scaleProb(0.45 - (tireWear < 25 ? 0.15 : 0)),
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
