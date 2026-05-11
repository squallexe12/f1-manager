/**
 * dnf-result.ts — fixture factory for press-engine tests (IP-10)
 *
 * Returns a RaceResult[] where both given player drivers have DNF'd.
 */
import type { RaceResult } from '@/engine/core/post-race-processor'

/**
 * Create a RaceResult array where both player drivers DNF.
 *
 * @param playerDriverIds - Tuple of the two main player driver ids.
 */
export function bothDNFResult(playerDriverIds: [string, string]): RaceResult[] {
  return [
    {
      driverId: playerDriverIds[0],
      position: 21,
      dnf: true,
      fastestLap: false,
      appliedPenalties: [],
    },
    {
      driverId: playerDriverIds[1],
      position: 22,
      dnf: true,
      fastestLap: false,
      appliedPenalties: [],
    },
  ]
}
