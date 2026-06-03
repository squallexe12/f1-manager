import type { Team } from '@/types/team'
import type { Scenario } from '@/data/scenarios'
import type { BoardObjective } from '@/types/board'
import { calculateOverallRating } from '@/engine/engineering/car-performance'
import { OBJECTIVE_WEIGHTS } from '@/engine/board/board-objectives'

/** Baseline season points a constructor at position [1..11] is expected to score
 *  over a 22-race season. Index 0 is unused. Tunable. */
export const TARGET_POINTS_BY_POS = [0, 440, 360, 290, 220, 160, 110, 72, 46, 26, 12, 4]

function clampPos(p: number): number { return p < 1 ? 1 : p > 11 ? 11 : p }

/**
 * Derive the season's board mandate. Targets come from the player's car-OVR
 * rank among the field (constructorPosition is 0/unranked at season start),
 * shifted by the scenario's board expectation. Pure, deterministic.
 */
export function deriveBoardObjectives(
  playerTeamId: string,
  teams: Team[],
  scenario: Scenario,
  totalRaces: number,
): { objectives: BoardObjective[]; rivalTeamId: string } {
  const ranked = [...teams].sort(
    (a, b) => calculateOverallRating(b.car) - calculateOverallRating(a.car),
  )
  // 0-based rank. Contract: playerTeamId is always a member of `teams` (it comes
  // from world.gameState.playerTeamId over the full grid). An unknown id is a
  // caller bug; we intentionally degrade gracefully to rank 0 (top-car strength)
  // rather than throw, because this runs inside initializeGame / season-end and a
  // crash there is worse UX than a slightly-off mandate.
  const playerRank = Math.max(0, ranked.findIndex(t => t.id === playerTeamId))
  const baseTargetPos = playerRank + 1
  const exp = scenario.boardExpectation
  const targetPos = clampPos(baseTargetPos + exp.positionDelta)
  const pointsTarget = Math.round(
    TARGET_POINTS_BY_POS[targetPos] * exp.pointsFactor * (totalRaces / 22),
  )
  // Rival = the car immediately above the player (or just below if strongest).
  // The `??` is a defensive fallback that only fires for a degenerate <2-team grid.
  const rivalIndex = playerRank > 0 ? playerRank - 1 : playerRank + 1
  const rival = ranked[rivalIndex] ?? ranked.find(t => t.id !== playerTeamId)!

  const objectives: BoardObjective[] = [
    {
      kind: 'constructorFinish',
      label: `Finish P${targetPos} or better in the Constructors'`,
      target: targetPos, weight: OBJECTIVE_WEIGHTS.constructorFinish, current: 0, met: false,
    },
    {
      kind: 'pointsTarget',
      label: `Score ${pointsTarget} points`,
      target: pointsTarget, weight: OBJECTIVE_WEIGHTS.pointsTarget, current: 0, met: false,
    },
    {
      kind: 'beatRival',
      label: `Finish ahead of ${rival.name}`,
      target: 1, weight: OBJECTIVE_WEIGHTS.beatRival, current: 0, met: false,
    },
  ]
  return { objectives, rivalTeamId: rival.id }
}
