import type { TireCompound } from '@/types/race'
import type { CalibrationProfile, PitLossCalibration, PitLaneCalibration, StintCalibration, TireCalibration } from '@/types/calibration'
import {
  DEFAULT_PITLOSS_CALIBRATION,
  DEFAULT_PITLANE_CALIBRATION,
  DEFAULT_STINT_CALIBRATION,
  DEFAULT_TIRE_CALIBRATION,
} from '@/types/calibration'
import { pitLaneForCircuit } from '@/data/pit-lane-circuits'

const COMPOUND_ORDER: readonly TireCompound[] = ['C1', 'C2', 'C3', 'C4', 'C5']

/**
 * Repair degenerate OpenF1-derived tire calibration values.
 *
 * The OpenF1 sync pipeline occasionally emits a 0.1 "no-signal" floor for
 * compounds with insufficient stint samples, or produces non-monotonic
 * orderings (e.g. a C4 that degrades faster than C5). Those values break
 * pit strategy because drivers can run an entire race on the starting
 * compound without reaching the performance cliff.
 *
 * Rules applied:
 *  1. Each compound's degradation rate is floored at the DEFAULT_TIRE_CALIBRATION
 *     rate for that compound. OpenF1 signal above the default is preserved.
 *  2. Monotonic ordering is enforced: softer compounds must degrade at least
 *     as fast as harder ones (C1 ≤ C2 ≤ C3 ≤ C4 ≤ C5).
 */
export function sanitizeTireCalibration(tires: TireCalibration): TireCalibration {
  const rates: Record<TireCompound, number> = { ...tires.degradationRates }
  const defaults = DEFAULT_TIRE_CALIBRATION.degradationRates

  for (const c of COMPOUND_ORDER) {
    rates[c] = Math.max(rates[c], defaults[c])
  }

  for (let i = 1; i < COMPOUND_ORDER.length; i++) {
    const prev = rates[COMPOUND_ORDER[i - 1]]
    if (rates[COMPOUND_ORDER[i]] < prev) {
      rates[COMPOUND_ORDER[i]] = prev
    }
  }

  return {
    ...tires,
    degradationRates: rates,
    gripLevels: { ...tires.gripLevels },
  }
}

/**
 * Ensure a PitLossCalibration shape is valid. Fills missing fields with
 * defaults so legacy JSON profiles (pre-IP-07) load cleanly, and floors
 * implausible values (negative mean or stddev).
 */
export function sanitizePitLossCalibration(
  pitLoss: Partial<PitLossCalibration> | undefined,
): PitLossCalibration {
  if (!pitLoss) return { ...DEFAULT_PITLOSS_CALIBRATION }

  const meanLossSeconds =
    typeof pitLoss.meanLossSeconds === 'number' && pitLoss.meanLossSeconds > 0
      ? pitLoss.meanLossSeconds
      : DEFAULT_PITLOSS_CALIBRATION.meanLossSeconds

  const stddevSeconds =
    typeof pitLoss.stddevSeconds === 'number' && pitLoss.stddevSeconds >= 0
      ? pitLoss.stddevSeconds
      : DEFAULT_PITLOSS_CALIBRATION.stddevSeconds

  const sampleCount =
    typeof pitLoss.sampleCount === 'number' && pitLoss.sampleCount >= 0
      ? Math.floor(pitLoss.sampleCount)
      : 0

  return { meanLossSeconds, stddevSeconds, sampleCount }
}

/**
 * Ensure a StintCalibration shape is valid. Floors absurdly short per-compound
 * stint lengths (timing glitches like a 2-lap C5) at a realistic minimum, and
 * caps absurdly long ones (OpenF1 samples can report a 61-lap C3 at Monaco)
 * at a realistic maximum.
 */
const STINT_MIN_REALISTIC_LAPS = 5
const STINT_MAX_REALISTIC_LAPS = 60

export function sanitizeStintCalibration(
  stint: Partial<StintCalibration> | undefined,
): StintCalibration {
  if (!stint || !stint.expectedLaps) {
    return {
      expectedLaps: { ...DEFAULT_STINT_CALIBRATION.expectedLaps },
      sampleCount: DEFAULT_STINT_CALIBRATION.sampleCount,
    }
  }

  const expectedLaps: Record<TireCompound, number> = {
    C1: DEFAULT_STINT_CALIBRATION.expectedLaps.C1,
    C2: DEFAULT_STINT_CALIBRATION.expectedLaps.C2,
    C3: DEFAULT_STINT_CALIBRATION.expectedLaps.C3,
    C4: DEFAULT_STINT_CALIBRATION.expectedLaps.C4,
    C5: DEFAULT_STINT_CALIBRATION.expectedLaps.C5,
  }

  for (const c of COMPOUND_ORDER) {
    const v = stint.expectedLaps[c]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1) continue
    const rounded = Math.round(v)
    if (rounded < STINT_MIN_REALISTIC_LAPS) {
      // Keep the default for this compound — a <5-lap stint is a timing anomaly.
      continue
    }
    if (rounded > STINT_MAX_REALISTIC_LAPS) {
      expectedLaps[c] = STINT_MAX_REALISTIC_LAPS
      continue
    }
    expectedLaps[c] = rounded
  }

  const sampleCount =
    typeof stint.sampleCount === 'number' && stint.sampleCount >= 0
      ? Math.floor(stint.sampleCount)
      : 0

  return { expectedLaps, sampleCount }
}

/**
 * Ensure a PitLaneCalibration shape is valid (Tier B). When the loaded
 * profile lacks a `pitLane` block — every legacy JSON profile predates
 * Tier B and won't have one — fall back to the per-circuit table in
 * `src/data/pit-lane-circuits.ts`, then to `DEFAULT_PITLANE_CALIBRATION`.
 */
export function sanitizePitLaneCalibration(
  pitLane: Partial<PitLaneCalibration> | undefined,
  circuitId: string,
): PitLaneCalibration {
  const tableEntry = pitLaneForCircuit(circuitId, DEFAULT_PITLANE_CALIBRATION)
  if (!pitLane) return { ...tableEntry }

  const lengthMeters =
    typeof pitLane.lengthMeters === 'number' && pitLane.lengthMeters > 0
      ? pitLane.lengthMeters
      : tableEntry.lengthMeters
  const speedLimitKph =
    typeof pitLane.speedLimitKph === 'number' && pitLane.speedLimitKph > 0
      ? pitLane.speedLimitKph
      : tableEntry.speedLimitKph
  const entryDecelMeters =
    typeof pitLane.entryDecelMeters === 'number' && pitLane.entryDecelMeters > 0
      ? pitLane.entryDecelMeters
      : tableEntry.entryDecelMeters
  const exitAccelMeters =
    typeof pitLane.exitAccelMeters === 'number' && pitLane.exitAccelMeters > 0
      ? pitLane.exitAccelMeters
      : tableEntry.exitAccelMeters
  return { lengthMeters, speedLimitKph, entryDecelMeters, exitAccelMeters }
}

/**
 * Fill in required post-IP-07 / Tier B calibration sections (pitLoss, stint,
 * pitLane) on a legacy profile that predates each schema extension. Existing
 * sections are left untouched; missing ones get defaults or per-circuit
 * overrides as appropriate.
 */
export function sanitizeCalibrationProfile(profile: CalibrationProfile): CalibrationProfile {
  return {
    ...profile,
    tires: sanitizeTireCalibration(profile.tires),
    pitLoss: sanitizePitLossCalibration(profile.pitLoss),
    stint: sanitizeStintCalibration(profile.stint),
    pitLane: sanitizePitLaneCalibration(profile.pitLane, profile.circuitId),
  }
}
