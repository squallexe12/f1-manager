import type { Team, ComponentAllocation } from '@/types/team'
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

const MIN_FAILURE_EVENTS = 2
const CROSS_ROUND_GAP_PROXY_LAPS = 50

/**
 * Mean time between failures (laps). When 2+ failure events are recorded
 * in `team.failureEvents`, returns the average gap between adjacent events
 * (chronologically by round, then lap). Otherwise falls back to a heuristic
 * grounded in `car.reliability` and the team's *worst* per-element wear
 * ratio — a single nearly-dead component drags MTBF down even if the rest
 * of the fleet is fresh.
 *
 * Note: in Phase 1 the failure-event log stays empty (`checkMechanicalFailure`
 * is defined but not yet wired into the simulator), so this function
 * effectively always returns the heuristic. The infrastructure ships now so
 * MTBF can graduate to real-data without a follow-up schema change.
 */
export function mtbfFromFailureLog(team: Team): number {
  if (team.failureEvents.length >= MIN_FAILURE_EVENTS) {
    return mtbfFromEvents(team.failureEvents)
  }
  return mtbfHeuristicWorstWear(team.car.reliability, team.components)
}

function mtbfFromEvents(
  events: ReadonlyArray<{ round: number; lap: number }>,
): number {
  // Sort chronologically: round asc, then lap asc.
  const sorted = [...events].sort((a, b) =>
    a.round === b.round ? a.lap - b.lap : a.round - b.round,
  )
  let totalGap = 0
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]
    const b = sorted[i]
    totalGap += a.round === b.round
      ? Math.max(1, b.lap - a.lap)
      : CROSS_ROUND_GAP_PROXY_LAPS
  }
  const gaps = sorted.length - 1
  return Number(Math.max(1, totalGap / gaps).toFixed(1))
}

function mtbfHeuristicWorstWear(
  reliability: number,
  components: ComponentAllocation[],
): number {
  const rel = Math.max(0, Math.min(100, reliability)) / 100
  if (components.length === 0) {
    return Number((6 + rel * 24).toFixed(1))
  }
  const worstWear = components.reduce(
    (acc, c) => Math.max(acc, c.used / Math.max(1, c.limit)),
    0,
  )
  const base = 6 + rel * 24 // 6 → 30 over reliability range
  const wearPenalty = 1 - worstWear * 0.5 // 1.0 → 0.5
  return Number(Math.max(1, base * wearPenalty).toFixed(1))
}
