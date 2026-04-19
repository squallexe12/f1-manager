import type { FinanceState } from '@/types/finance'
import type { Driver } from '@/types/driver'

const SPONSOR_SATISFACTION_BOOST = 10
const DRIVER_FRUSTRATION_DROP = 20

/**
 * Boost the lowest-satisfaction sponsor by a fixed amount (clamped at 100).
 * Pure — returns a new FinanceState without mutating the input. Returns the
 * same reference if the team has no sponsors, so callers can skip work.
 */
export function boostSponsorSatisfaction(finance: FinanceState): FinanceState {
  if (finance.sponsors.length === 0) return finance

  let targetIndex = 0
  let minSatisfaction = finance.sponsors[0].satisfaction
  for (let i = 1; i < finance.sponsors.length; i++) {
    if (finance.sponsors[i].satisfaction < minSatisfaction) {
      minSatisfaction = finance.sponsors[i].satisfaction
      targetIndex = i
    }
  }

  const next = finance.sponsors.map((s, i) =>
    i === targetIndex
      ? { ...s, satisfaction: Math.min(100, s.satisfaction + SPONSOR_SATISFACTION_BOOST) }
      : s,
  )

  return { ...finance, sponsors: next }
}

/**
 * Reduce a driver's frustration by a fixed amount (clamped at 0).
 * Pure — returns a new Driver[] without mutating the input. Returns the
 * same reference if the target driver is not present.
 */
export function reduceDriverFrustration(drivers: Driver[], driverId: string): Driver[] {
  const idx = drivers.findIndex(d => d.id === driverId)
  if (idx === -1) return drivers

  return drivers.map((d, i) =>
    i === idx
      ? { ...d, mood: { ...d.mood, frustration: Math.max(0, d.mood.frustration - DRIVER_FRUSTRATION_DROP) } }
      : d,
  )
}
