import type { Driver } from '@/types/driver'

/**
 * Pure helper used by the qualifying flow to increment a driver's pole
 * counter in `seasonStats.poles`. Called by the phase that decides grid
 * position 1; post-race processing does not touch this field because fastest
 * lap ≠ pole position.
 *
 * Returns a new driver array. Never mutates its input.
 */
export function awardPole(drivers: Driver[], driverId: string): Driver[] {
  return drivers.map(driver => {
    if (driver.id !== driverId) return driver
    return {
      ...driver,
      seasonStats: {
        ...driver.seasonStats,
        poles: driver.seasonStats.poles + 1,
      },
    }
  })
}
