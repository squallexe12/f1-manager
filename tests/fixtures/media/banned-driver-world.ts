/**
 * banned-driver-world.ts — fixture factory for press-engine tests (IP-10)
 *
 * Returns a FullGameState where the chosen player driver (by index 0 or 1)
 * has exactly 12 penalty points, which exceeds banThreshold and triggers a
 * ban. banUntilRound is set so the driver is suspended for the current round.
 */
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'

function getPlayerDriverIds(world: FullGameState): string[] {
  return world.drivers
    .filter(d => d.teamId === world.gameState.playerTeamId && !d.isReserve)
    .map(d => d.id)
}

/**
 * Return a FullGameState where the chosen player driver (index 0 or 1) is
 * banned for the current round (banUntilRound === currentRound + 1) and
 * carries 12 penalty points.
 *
 * @param driverIndex - 0 for the first player driver, 1 for the second.
 */
export function bannedDriverWorld(driverIndex: 0 | 1): FullGameState {
  const world = initializeGame('mclaren', 'rebuild', 42)
  const playerDriverIds = getPlayerDriverIds(world)
  const targetDriverId = playerDriverIds[driverIndex]

  if (targetDriverId === undefined) {
    throw new Error(`No player driver at index ${driverIndex}`)
  }

  // Set the driver as banned until next round, with 12 penalty points
  const currentRound = world.gameState.currentRound
  return {
    ...world,
    drivers: world.drivers.map(d =>
      d.id === targetDriverId
        ? {
            ...d,
            banUntilRound: currentRound + 1,
            penaltyPoints: [
              {
                points: 12,
                issuedSeason: world.gameState.season,
                issuedRound: currentRound,
                offenceType: 'collision' as const,
                raceId: `r${currentRound}`,
              },
            ],
          }
        : d,
    ),
  }
}
