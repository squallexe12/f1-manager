import type { TireCompound } from '@/types/race'
import type { TireCalibration } from '@/types/calibration'
import { DEFAULT_TIRE_CALIBRATION } from '@/types/calibration'

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
