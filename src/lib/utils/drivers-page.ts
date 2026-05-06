import type { Driver, DriverAttributes } from '@/types/driver'
import type { Team } from '@/types/team'

/**
 * Average each attribute across active, non-reserve, contracted drivers.
 * Used to render the peer-comparison overlay on the attributes radar.
 *
 * Returns zeroed attributes if the input has no eligible drivers (avoids
 * NaN poisoning the UI).
 */
export function computePeerAttributes(drivers: Driver[]): DriverAttributes {
  const active = drivers.filter(d => !d.isReserve && d.teamId !== null)
  if (active.length === 0) {
    return { pace: 0, racecraft: 0, experience: 0, mentality: 0, marketability: 0, developmentPotential: 0 }
  }
  const sum = active.reduce<DriverAttributes>(
    (acc, d) => ({
      pace: acc.pace + d.attributes.pace,
      racecraft: acc.racecraft + d.attributes.racecraft,
      experience: acc.experience + d.attributes.experience,
      mentality: acc.mentality + d.attributes.mentality,
      marketability: acc.marketability + d.attributes.marketability,
      developmentPotential: acc.developmentPotential + d.attributes.developmentPotential,
    }),
    { pace: 0, racecraft: 0, experience: 0, mentality: 0, marketability: 0, developmentPotential: 0 },
  )
  const n = active.length
  return {
    pace: Math.round(sum.pace / n),
    racecraft: Math.round(sum.racecraft / n),
    experience: Math.round(sum.experience / n),
    mentality: Math.round(sum.mentality / n),
    marketability: Math.round(sum.marketability / n),
    developmentPotential: Math.round(sum.developmentPotential / n),
  }
}

export interface ChampionshipSummary {
  positionById: Record<string, number>
  gapById: Record<string, number>
}

/**
 * Rank active drivers by points and build per-driver position + gap maps.
 * Leader's gap = points clear of P2. Others = points behind leader (negative).
 */
export function computeChampionshipSummary(drivers: Driver[]): ChampionshipSummary {
  const sorted = [...drivers]
    .filter(d => !d.isReserve && d.teamId !== null)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)
  const positionById: Record<string, number> = {}
  const gapById: Record<string, number> = {}
  const leaderPts = sorted[0]?.seasonStats.points ?? 0
  const p2Pts = sorted[1]?.seasonStats.points ?? 0
  sorted.forEach((d, i) => {
    positionById[d.id] = i + 1
    gapById[d.id] = i === 0 ? leaderPts - p2Pts : d.seasonStats.points - leaderPts
  })
  return { positionById, gapById }
}

export interface RivalryDisplay {
  code: string
  name: string
  teamName: string
}

/**
 * Resolve `Driver.rivalries[*].targetDriverId` to display-ready strings by
 * looking up the target driver and their team. Returns a flat index keyed
 * by targetDriverId for fast component-level resolution.
 */
export function buildRivalryIndex(drivers: Driver[], teams: Team[]): Record<string, RivalryDisplay> {
  const driverById = new Map(drivers.map(d => [d.id, d]))
  const teamById = new Map(teams.map(t => [t.id, t]))
  const idx: Record<string, RivalryDisplay> = {}
  for (const d of drivers) {
    for (const r of d.rivalries) {
      if (idx[r.targetDriverId]) continue
      const target = driverById.get(r.targetDriverId)
      if (!target) continue
      const team = target.teamId ? teamById.get(target.teamId) : null
      idx[r.targetDriverId] = {
        code: target.shortName,
        name: `${target.firstName.charAt(0)}. ${target.lastName}`,
        teamName: team?.name ?? 'Free Agent',
      }
    }
  }
  return idx
}

/**
 * Composite score for sorting the scout pool. Higher = more interesting.
 * Pure presentation — does not affect engine state.
 */
export function scoutScore(driver: Driver): number {
  return driver.attributes.pace + driver.attributes.developmentPotential
}
