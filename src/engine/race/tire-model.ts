import type { TireCompound, TireState } from '@/types/race'

// Base degradation per lap for each compound (percentage of wear lost per lap)
const COMPOUND_DEGRADATION: Record<TireCompound, number> = {
  C1: 0.8,  // Hard — very durable
  C2: 1.1,
  C3: 1.5,  // Medium
  C4: 2.0,
  C5: 2.8,  // Soft — degrades fast
}

// Base grip performance for each compound (softer = more grip)
const COMPOUND_GRIP: Record<TireCompound, number> = {
  C1: 0.88,
  C2: 0.92,
  C3: 0.95,
  C4: 0.98,
  C5: 1.00,
}

const TIRE_WEAR_MULTIPLIER: Record<string, number> = {
  low: 0.7,
  medium: 1.0,
  high: 1.4,
}

/**
 * Calculate tire wear lost over a number of laps.
 * Returns the total wear percentage consumed (higher = more degradation).
 */
export function calculateDegradation(
  compound: TireCompound,
  laps: number,
  circuit: { tireWear: string },
  trackTemp: number = 35,
): number {
  const baseDeg = COMPOUND_DEGRADATION[compound]
  const circuitMul = TIRE_WEAR_MULTIPLIER[circuit.tireWear] ?? 1.0
  // Temperature effect: hotter = more degradation. Baseline at 35°C
  const tempMul = 1 + (trackTemp - 35) * 0.005
  return baseDeg * laps * circuitMul * Math.max(0.8, tempMul)
}

/**
 * Get the performance multiplier for a tire in its current state.
 * Returns a value between ~0.5 (destroyed) and 1.0 (fresh soft).
 * Features a "cliff" — performance drops sharply below 15% wear.
 */
export function getTirePerformance(tire: TireState): number {
  const baseGrip = COMPOUND_GRIP[tire.compound]
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
  circuit: { tireWear: string },
  trackTemp: number = 35,
): TireState {
  const lapDeg = calculateDegradation(tire.compound, 1, circuit, trackTemp)
  return {
    ...tire,
    wear: Math.max(0, tire.wear - lapDeg),
    lapsFitted: tire.lapsFitted + 1,
  }
}
