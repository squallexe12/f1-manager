/**
 * Shared rolling-window helpers for season form series used on the Paddock
 * hero surfaces (driver sparkline, constructor form card).
 *
 * Pure functions. No side effects. Never mutate input arrays.
 */

/** Number of most-recent rounds retained in every form series. */
export const FORM_WINDOW = 7

/** Sentinel used to record a DNF inside a numeric form series. */
export const FORM_DNF = 21

/**
 * Append a new sample to a rolling form window, dropping the oldest entries
 * so the returned array holds at most `FORM_WINDOW` values.
 */
export function pushForm(series: readonly number[], value: number): number[] {
  const next = [...series, value]
  if (next.length <= FORM_WINDOW) return next
  return next.slice(next.length - FORM_WINDOW)
}
