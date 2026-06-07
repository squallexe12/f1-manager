import type { QualifyingResult } from '@/types/weekend'

/**
 * Build the race/sprint starting grid (pre-penalties) from an earned qualifying
 * classification.
 *
 * Pure. Deterministic — no PRNG, no side effects (this lives under
 * `src/engine/race/**`, so the determinism mandate applies; a seeded twice-run
 * test through `simulateQualifying` covers it).
 *
 * - `classification === null` → return a COPY of `inputOrder`. This defensive
 *   fallback only fires if qualifying was genuinely never run. Because the
 *   classification now lives in `world.weekendState` (persisted), a mid-weekend
 *   reload keeps the earned grid — the old roster-order fallback bug is
 *   structurally eliminated.
 * - otherwise → take `classification.gridOrder` (already P1..PN), keep only ids
 *   present in `inputOrder` (drops classified drivers absent post-substitution,
 *   e.g. a banned driver), then append any `inputOrder` ids not in the
 *   classification to the back, preserving input order (e.g. a reserve who never
 *   qualified). The classification order is authoritative; input order only
 *   decides the tail.
 */
export function buildQualifyingOrder(
  inputOrder: string[],
  classification: QualifyingResult | null,
): string[] {
  if (classification === null) return [...inputOrder]

  const inputSet = new Set(inputOrder)
  const fromGrid = classification.gridOrder.filter((id) => inputSet.has(id))
  const placed = new Set(fromGrid)
  const appended = inputOrder.filter((id) => !placed.has(id))
  return [...fromGrid, ...appended]
}
