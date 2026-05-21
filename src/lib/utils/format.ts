/**
 * Formats a salary/bonus number as $XM, e.g. $55M or $2.2M.
 * Whole millions for >= $10M, one decimal place below that.
 */
export function formatM(n: number): string {
  return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
}
