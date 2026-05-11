/**
 * podium-result.ts — fixture factory for press-engine tests (IP-10)
 *
 * Returns a minimal RaceResult[] array with the given player driver in a
 * podium position (1–3) and their teammate in a reasonable non-podium position.
 */
import type { RaceResult } from '@/engine/core/post-race-processor'

/**
 * Create a RaceResult array where `playerDriverId` finishes on the podium.
 *
 * @param playerDriverId  - The first player driver id (the podium finisher).
 * @param teammateDriverId - The second player driver id.
 * @param position        - 1, 2 or 3.
 */
export function podiumResult(
  playerDriverId: string,
  teammateDriverId: string,
  position: 1 | 2 | 3,
): RaceResult[] {
  return [
    {
      driverId: playerDriverId,
      position,
      dnf: false,
      fastestLap: position === 1,
      appliedPenalties: [],
    },
    {
      driverId: teammateDriverId,
      position: position + 3,
      dnf: false,
      fastestLap: false,
      appliedPenalties: [],
    },
  ]
}
