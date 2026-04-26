import type { Team, ComponentElement } from '@/types/team'

/**
 * Append a power-unit swap election to the team's pending queue. Idempotent
 * on (driverId, element) — re-electing the same swap is a no-op (returns
 * the same team reference unchanged). The first election wins; later
 * elections for the same pair are ignored. Used by the Factory page's
 * Component Strategy sub-section in response to `INTRODUCE NEW` clicks.
 */
export function electComponentSwap(
  team: Team,
  driverId: string,
  element: ComponentElement,
  currentRound: number,
): Team {
  const alreadyQueued = team.pendingComponentSwaps.some(
    (s) => s.driverId === driverId && s.element === element,
  )
  if (alreadyQueued) return team
  return {
    ...team,
    pendingComponentSwaps: [
      ...team.pendingComponentSwaps,
      { driverId, element, electedRound: currentRound },
    ],
  }
}
