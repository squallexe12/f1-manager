import type { Driver } from '@/types/driver'
import { computeScoutSignal } from './scout-signal'

/**
 * File one scouting report on a driver: increment the counter and recompute
 * the signal. Pure function — returns a new Driver, does not mutate.
 *
 * The store action `fileScoutingReport` is the only caller; it gates
 * eligibility (free agent or F2 only) before invoking this helper.
 */
export function applyScoutingReport(driver: Driver): Driver {
  const next = { ...driver, scoutingReports: driver.scoutingReports + 1 }
  return { ...next, scoutSignal: computeScoutSignal(next) }
}
