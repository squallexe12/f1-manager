import type { TireCompound, TireState } from '@/types/race'
import type { TireCalibration } from '@/types/calibration'

/**
 * Calculate tire wear lost over a number of laps.
 * Returns the total wear percentage consumed (higher = more degradation).
 */
export function calculateDegradation(
  compound: TireCompound,
  laps: number,
  calibration: TireCalibration,
  trackTemp?: number,
): number {
  const baseDeg = calibration.degradationRates[compound]
  const baseTemp = calibration.baseTrackTemp
  const temp = trackTemp ?? baseTemp
  // Temperature effect: hotter than baseline = more degradation
  const tempMul = 1 + (temp - baseTemp) * 0.005
  return baseDeg * laps * calibration.wearMultiplier * Math.max(0.8, tempMul)
}

/**
 * Get the performance multiplier for a tire in its current state.
 * Returns a value between ~0.5 (destroyed) and 1.0 (fresh soft).
 * Features a "cliff" — performance drops sharply below 15% wear.
 */
export function getTirePerformance(tire: TireState, calibration: TireCalibration): number {
  const baseGrip = calibration.gripLevels[tire.compound]
  const wearFraction = tire.wear / 100

  // Linear degradation component
  const linearComponent = 0.85 + 0.15 * wearFraction

  // Cliff: below 15% wear, performance drops dramatically
  let cliffPenalty = 0
  if (wearFraction < 0.15) {
    cliffPenalty = (0.15 - wearFraction) * 12 // up to 1.8 penalty at 0%
  }

  return Math.max(0.2, baseGrip * linearComponent - cliffPenalty)
}

/**
 * Apply one lap of degradation to a tire state.
 */
export function degradeTire(
  tire: TireState,
  calibration: TireCalibration,
  trackTemp?: number,
): TireState {
  const lapDeg = calculateDegradation(tire.compound, 1, calibration, trackTemp)
  return {
    ...tire,
    wear: Math.max(0, tire.wear - lapDeg),
    lapsFitted: tire.lapsFitted + 1,
  }
}
