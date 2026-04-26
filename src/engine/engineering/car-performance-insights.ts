import type { Team } from '@/types/team'
import { deltaVsLeaderSeconds } from './factory-insights'

/**
 * Real-data derivations for the Factory car-performance card. Replaces the
 * heuristic-only `factory-insights.ts` helpers with grounded values from
 * the rolling buffers maintained by the post-race processor. Falls back to
 * the existing heuristic when buffer data is sparse — a team's first race
 * weekend, or any team that hasn't held a race-wide fastest lap yet.
 */

const MIN_HISTORY_ENTRIES = 3

/**
 * Rolling 3-race average of fastest-lap deltas between the player team and
 * the championship leader. Positive = player slower; 0 = player IS the
 * leader (or no leader located). Falls back to today's OVR-diff heuristic
 * when fewer than 3 rounds overlap between the player's and leader's
 * fastest-lap logs.
 */
export function deltaVsLeaderFromHistory(teams: Team[], playerTeamId: string): number {
  const player = teams.find((t) => t.id === playerTeamId)
  if (!player) return 0
  const leader = teams.find((t) => t.constructorPosition === 1)
  if (!leader || leader.id === playerTeamId) return 0

  const playerByRound = new Map(player.fastestLapHistory.map((e) => [e.round, e.lapMs]))
  const leaderByRound = new Map(leader.fastestLapHistory.map((e) => [e.round, e.lapMs]))

  // Rounds where BOTH teams posted a race-wide fastest lap. Take the most
  // recent MIN_HISTORY_ENTRIES of those.
  const sharedRounds = [...playerByRound.keys()]
    .filter((r) => leaderByRound.has(r))
    .sort((a, b) => b - a)
    .slice(0, MIN_HISTORY_ENTRIES)

  if (sharedRounds.length < MIN_HISTORY_ENTRIES) {
    return deltaVsLeaderSeconds(teams, playerTeamId)
  }

  const deltaMs = sharedRounds.reduce((acc, round) => {
    return acc + (playerByRound.get(round)! - leaderByRound.get(round)!)
  }, 0) / sharedRounds.length

  // Convert to seconds with two decimals — matches the existing readout
  // format on the Factory card.
  return Number((deltaMs / 1000).toFixed(2))
}
