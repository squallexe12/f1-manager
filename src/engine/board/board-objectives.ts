import type { BoardObjective } from '@/types/board'

/** Worst constructor position (11-team grid). Unranked (0) maps here. */
const FLOOR_POSITION = 11

export const OBJECTIVE_WEIGHTS = { constructorFinish: 0.5, pointsTarget: 0.3, beatRival: 0.2 } as const
export const RETAIN_BAR = 50
export const BAND_SECURE = 60   // confidence > 60 → secure
export const BAND_BRINK = 30    // confidence < 30 → on the brink (aligned to sponsor at-risk < 30)
export const CONFIDENCE_HISTORY_CAP = 24
const RIVAL_SOFTNESS = 0.25     // pace01 lost per grid slot behind the rival

export interface BoardContext {
  constructorPosition: number        // player 1..11 (0 → 11)
  constructorPoints: number
  rivalConstructorPosition: number   // 1..11 (0 → 11)
  rivalConstructorPoints: number
  currentRound: number
  totalRounds: number
}

// Mirrors KpiEvaluation in sponsor-kpi.ts — intentionally parallel; do not merge.
export interface ObjectiveEval { current: number; met: boolean; pace01: number }

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x }

/**
 * Evaluate a single board objective. `met` is the hard absolute test (drives
 * the season-end verdict). `pace01` is the live-confidence input: cumulative
 * point targets are season-fraction-normalized so a mid-season half-target
 * reads as "on track".
 */
export function evaluateObjective(obj: BoardObjective, ctx: BoardContext): ObjectiveEval {
  const frac = ctx.totalRounds > 0 ? ctx.currentRound / ctx.totalRounds : 1
  const seasonFrac = frac <= 0 ? 1 : frac
  switch (obj.kind) {
    case 'pointsTarget': {
      const current = ctx.constructorPoints
      return {
        current,
        met: current >= obj.target,
        pace01: obj.target <= 0 ? 1 : clamp01((current / obj.target) / seasonFrac),
      }
    }
    case 'constructorFinish': {
      const pos = ctx.constructorPosition > 0 ? ctx.constructorPosition : FLOOR_POSITION
      const met = pos <= obj.target
      const pace01 = met ? 1 : clamp01((FLOOR_POSITION + 1 - pos) / (FLOOR_POSITION + 1 - obj.target))
      return { current: pos, met, pace01 }
    }
    case 'beatRival': {
      const playerPos = ctx.constructorPosition > 0 ? ctx.constructorPosition : FLOOR_POSITION
      const rivalPos = ctx.rivalConstructorPosition > 0 ? ctx.rivalConstructorPosition : FLOOR_POSITION
      const ahead = playerPos < rivalPos
      return {
        current: ahead ? 1 : 0,
        met: ahead,
        pace01: ahead ? 1 : clamp01(1 - (playerPos - rivalPos) * RIVAL_SOFTNESS),
      }
    }
  }
}

/**
 * Recompute every objective's live value + the weighted board confidence
 * (0-100). Stateless: a pure function of the objectives and the current
 * season context — re-derivable each race, naturally idempotent.
 */
export function evaluateBoardConfidence(
  objectives: BoardObjective[],
  ctx: BoardContext,
): { objectives: BoardObjective[]; confidence: number } {
  const evals = objectives.map(o => evaluateObjective(o, ctx))
  const next = objectives.map((o, i) => ({ ...o, current: evals[i].current, met: evals[i].met }))
  const totalWeight = objectives.reduce((s, o) => s + o.weight, 0) || 1
  const weighted = objectives.reduce((s, o, i) => s + o.weight * evals[i].pace01, 0)
  const confidence = Math.round((weighted / totalWeight) * 100)
  return { objectives: next, confidence }
}

export function confidenceBand(confidence: number): 'secure' | 'pressure' | 'brink' {
  if (confidence > BAND_SECURE) return 'secure'
  if (confidence < BAND_BRINK) return 'brink'
  return 'pressure'
}

export interface BoardVerdict {
  verdict: 'retain' | 'warning' | 'sack'
  outcomeScore: number
  warningsIssued: number
  tenureStatus: 'active' | 'warned' | 'sacked'
  objectives: BoardObjective[]   // refreshed with final met/current for the recap
}

/**
 * Season-end verdict from FINAL standings (absolute `met`, not the smoothed
 * meter). Soft escalation: a miss is a warning the first time, a sack on the
 * second consecutive miss; a retain clears the warning counter.
 */
export function computeBoardVerdict(
  objectives: BoardObjective[],
  ctx: BoardContext,
  warningsIssued: number,
): BoardVerdict {
  const evals = objectives.map(o => evaluateObjective(o, ctx))
  const finalObjectives = objectives.map((o, i) => ({ ...o, current: evals[i].current, met: evals[i].met }))
  const totalWeight = objectives.reduce((s, o) => s + o.weight, 0) || 1
  const weightedMet = objectives.reduce((s, o, i) => s + (evals[i].met ? o.weight : 0), 0)
  const outcomeScore = Math.round((weightedMet / totalWeight) * 100)

  if (outcomeScore >= RETAIN_BAR) {
    return { verdict: 'retain', outcomeScore, warningsIssued: 0, tenureStatus: 'active', objectives: finalObjectives }
  }
  if (warningsIssued === 0) {
    return { verdict: 'warning', outcomeScore, warningsIssued: 1, tenureStatus: 'warned', objectives: finalObjectives }
  }
  return { verdict: 'sack', outcomeScore, warningsIssued, tenureStatus: 'sacked', objectives: finalObjectives }
}
