import type { Team } from '@/types/team'
import type { FinanceState } from '@/types/finance'
import {
  REGULATION_CHANGES, TECHNICAL_DIRECTIVES,
  type RegulationChange, type TechnicalDirective,
} from '@/data/regulations'

/**
 * Get all regulation changes that apply to a given season.
 */
export function getRegulationsForSeason(season: number): RegulationChange[] {
  return REGULATION_CHANGES.filter(r => r.season === season)
}

/**
 * Get all regulation changes up to and including a given season (cumulative).
 */
export function getAllRegulationsUpTo(season: number): RegulationChange[] {
  return REGULATION_CHANGES.filter(r => r.season <= season)
}

/**
 * Get technical directives for a given season and round.
 * If round is provided, returns only those active at that round.
 * If round is omitted, returns all for the season.
 */
export function getTechnicalDirectives(season: number, round?: number): TechnicalDirective[] {
  return TECHNICAL_DIRECTIVES.filter(td =>
    td.season === season && (round === undefined || td.round <= round)
  )
}

/**
 * Get upcoming (not yet active) technical directives for a season.
 */
export function getUpcomingDirectives(season: number, currentRound: number): TechnicalDirective[] {
  return TECHNICAL_DIRECTIVES.filter(td =>
    td.season === season && td.round > currentRound
  )
}

/**
 * Apply season-start regulation changes to all teams.
 * Returns updated teams and finance state.
 */
export function applySeasonRegulations(
  teams: Team[],
  finance: Record<string, FinanceState>,
  season: number,
): { teams: Team[]; finance: Record<string, FinanceState> } {
  const changes = getRegulationsForSeason(season)

  let updatedTeams = [...teams]
  let updatedFinance = { ...finance }

  for (const change of changes) {
    const { impact } = change

    // Budget cap changes
    if (impact.budgetCapDelta) {
      const newFinance: Record<string, FinanceState> = {}
      for (const [teamId, fs] of Object.entries(updatedFinance)) {
        newFinance[teamId] = {
          ...fs,
          budget: {
            ...fs.budget,
            cap: fs.budget.cap + impact.budgetCapDelta,
          },
        }
      }
      updatedFinance = newFinance
    }

    // Component limit changes
    if (impact.componentLimitDelta) {
      updatedTeams = updatedTeams.map(team => ({
        ...team,
        components: team.components.map(comp => {
          const delta = impact.componentLimitDelta?.[comp.element] ?? 0
          return delta !== 0 ? { ...comp, limit: comp.limit + delta } : comp
        }),
      }))
    }

    // Wind tunnel / CFD changes
    if (impact.windTunnelLimitDelta) {
      updatedTeams = updatedTeams.map(team => ({
        ...team,
        windTunnelHoursLimit: Math.max(0, team.windTunnelHoursLimit + (impact.windTunnelLimitDelta ?? 0)),
      }))
    }
    if (impact.cfdLimitDelta) {
      updatedTeams = updatedTeams.map(team => ({
        ...team,
        cfdRunsLimit: Math.max(0, team.cfdRunsLimit + (impact.cfdLimitDelta ?? 0)),
      }))
    }

    // Car performance changes (applied to all teams)
    if (impact.carPerformanceDelta) {
      updatedTeams = updatedTeams.map(team => {
        const car = { ...team.car }
        for (const [attr, delta] of Object.entries(impact.carPerformanceDelta!)) {
          const key = attr as keyof typeof car
          if (key in car) {
            car[key] = Math.max(0, Math.min(100, car[key] + delta))
          }
        }
        return { ...team, car }
      })
    }
  }

  return { teams: updatedTeams, finance: updatedFinance }
}

/**
 * Apply a mid-season technical directive to all teams.
 */
export function applyTechnicalDirective(
  teams: Team[],
  directive: TechnicalDirective,
): Team[] {
  return teams.map(team => {
    const car = { ...team.car }
    for (const [attr, delta] of Object.entries(directive.performanceImpact)) {
      const key = attr as keyof typeof car
      if (key in car) {
        car[key] = Math.max(0, Math.min(100, car[key] + delta))
      }
    }
    return { ...team, car }
  })
}
