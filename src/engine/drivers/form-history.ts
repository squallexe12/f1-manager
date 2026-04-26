/**
 * Shared rolling-window helpers for season form series used on the Paddock
 * hero surfaces (driver sparkline, constructor form card).
 *
 * Pure functions. No side effects. Never mutate input arrays.
 */

/** Number of most-recent rounds retained in every form series. */
export const FORM_WINDOW = 7

/**
 * Number of most-recent rounds retained in a team's OVR history. Sized so
 * the Factory 6-race trend sparkline has headroom to render a rolling line
 * even after skipped or compacted rounds.
 */
export const OVR_HISTORY_WINDOW = 12

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

/**
 * Append an OVR sample to a team's rolling history, bounded to
 * `OVR_HISTORY_WINDOW` entries. Shares the immutable semantics of
 * `pushForm` — never mutates the input array.
 */
export function pushOvrSample(series: readonly number[], value: number): number[] {
  const next = [...series, value]
  if (next.length <= OVR_HISTORY_WINDOW) return next
  return next.slice(next.length - OVR_HISTORY_WINDOW)
}

/**
 * Maximum entries kept in a team's rolling fastest-lap log. Sized so the
 * Δ-vs-Leader derivation has at least 3 (its required minimum) and a few
 * extra to absorb rounds where the leader didn't post a race-wide fastest.
 */
export const FASTEST_LAP_WINDOW = 6

/**
 * Append a fastest-lap entry to a team's rolling history, bounded to
 * `FASTEST_LAP_WINDOW` entries. Same immutable semantics as `pushForm`.
 */
export function pushFastestLap<T>(series: readonly T[], entry: T): T[] {
  const next = [...series, entry]
  if (next.length <= FASTEST_LAP_WINDOW) return next
  return next.slice(next.length - FASTEST_LAP_WINDOW)
}
