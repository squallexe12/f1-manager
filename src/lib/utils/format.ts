/**
 * Formats a salary/bonus number as $XM, e.g. $55M or $2.2M.
 * Whole millions for >= $10M, one decimal place below that.
 */
export function formatM(n: number): string {
  return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
}

/**
 * Formats a duration in seconds as a `m:ss` clock (e.g. 3600 → "60:00",
 * 90 → "1:30"). Negative inputs clamp to 0. Used by the practice live-screen
 * chrome / hero / budget meter for the session countdown.
 */
export function formatClock(seconds: number): string {
  const total = Math.max(0, seconds)
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
