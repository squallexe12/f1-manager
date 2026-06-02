import type { Sponsor } from '@/types/finance'
import type { SponsorMetricKind } from '@/data/sponsors'

/** Worst constructor position (11-team grid). Unranked (0) maps here. */
const FLOOR_POSITION = 11

export interface SponsorSeasonContext {
  constructorPosition: number // 1..11; 0 (unranked) treated as FLOOR_POSITION
  teamPoints: number
  teamWins: number
  teamPodiums: number
  driverMarketabilityAvg: number
  minDriverRaceFinishes: number
  bothDriversScored: 0 | 1
  capBreached: boolean
  teamDnfs: number
  currentRound: number
  totalRounds: number
}

export interface KpiEvaluation {
  current: number
  met: boolean
  /** Season-fraction-normalized progress 0..1 — feeds satisfaction. */
  pace01: number
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/**
 * Evaluate a single KPI. `met` is the hard achievement test (gates bonus).
 * `pace01` is the satisfaction input: for accumulating (gte) metrics it is
 * progress-vs-season-pace, so a mid-season half-target reads as "on track".
 */
export function evaluateSponsorKpi(
  kind: SponsorMetricKind,
  target: number,
  ctx: SponsorSeasonContext,
): KpiEvaluation {
  const frac = ctx.totalRounds > 0 ? ctx.currentRound / ctx.totalRounds : 1
  const seasonFrac = frac <= 0 ? 1 : frac

  // Accumulating "greater-or-equal toward a season target" helper.
  const gtePace = (current: number): KpiEvaluation => ({
    current,
    met: current >= target,
    pace01: target <= 0
      ? (current >= target ? 1 : 0)
      : clamp01((current / target) / seasonFrac),
  })

  switch (kind) {
    case 'teamPoints':
      return gtePace(ctx.teamPoints)
    case 'teamWins':
      return gtePace(ctx.teamWins)
    case 'teamPodiums':
      return gtePace(ctx.teamPodiums)
    case 'minDriverRaceFinishes':
      return gtePace(ctx.minDriverRaceFinishes)
    case 'driverMarketabilityAvg': {
      // Not season-accumulating — judged on current average vs target.
      const current = Math.round(ctx.driverMarketabilityAvg)
      return {
        current,
        met: current >= target,
        pace01: target <= 0 ? 1 : clamp01(current / target),
      }
    }
    case 'bothDriversScored': {
      const current = ctx.bothDriversScored
      const met = current >= target
      return { current, met, pace01: met ? 1 : 0 }
    }
    case 'noCapBreach': {
      const current = ctx.capBreached ? 0 : 1
      const met = current >= target
      return { current, met, pace01: met ? 1 : 0 }
    }
    case 'constructorPosition': {
      const pos = ctx.constructorPosition > 0 ? ctx.constructorPosition : FLOOR_POSITION
      const met = pos <= target
      const pace01 = met
        ? 1
        : clamp01((FLOOR_POSITION + 1 - pos) / (FLOOR_POSITION + 1 - target))
      return { current: pos, met, pace01 }
    }
    case 'teamDnfs': {
      const current = ctx.teamDnfs
      const met = current <= target
      const pace01 = met
        ? 1
        : clamp01(1 - (current - target) / Math.max(1, target + 2))
      return { current, met, pace01 }
    }
  }
}

/**
 * Evaluate all of a sponsor's KPIs against the season context and return a
 * new Sponsor with updated current/met values and a satisfaction score
 * (mean pace01 across KPIs, 0–100). `metrics[i]` aligns to `sponsor.kpis[i]`
 * (both derive 1:1 from the static template). Missing metric → KPI untouched.
 */
export function evaluateSponsorSeason(
  sponsor: Sponsor,
  metrics: (SponsorMetricKind | undefined)[],
  ctx: SponsorSeasonContext,
): Sponsor {
  const evals = sponsor.kpis.map((kpi, i) => {
    const kind = metrics[i]
    return kind
      ? evaluateSponsorKpi(kind, kpi.target, ctx)
      : { current: kpi.current, met: kpi.met, pace01: kpi.met ? 1 : 0 }
  })
  const kpis = sponsor.kpis.map((kpi, i) => ({
    ...kpi,
    current: evals[i].current,
    met: evals[i].met,
  }))
  const satisfaction = Math.round(
    (evals.reduce((sum, e) => sum + e.pace01, 0) / Math.max(1, evals.length)) * 100,
  )
  return { ...sponsor, kpis, satisfaction }
}
