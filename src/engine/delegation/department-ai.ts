import type { Team, RndUpgrade, DepartmentHead } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { FinanceState } from '@/types/finance'
import type { RaceStrategy, TireCompound } from '@/types/race'
import type { PRNG } from '@/engine/core/prng'
import type { Recommendation } from '@/types/delegation'
import type { FullGameState } from '@/engine/core/state-manager'

export interface DepartmentDecision {
  department: string
  action: string
  description: string
}

/**
 * Action prefixes that map to a store-level apply path. Used by the UI to
 * decide whether to render an Apply button (vs. treating the recommendation
 * as informational-only).
 */
const APPLICABLE_PREFIXES = ['start-rnd:', 'strategy:', 'sponsor-outreach', 'driver-talk:'] as const

export function classifyApplicable(action: string): boolean {
  return APPLICABLE_PREFIXES.some(prefix =>
    prefix.endsWith(':') ? action.startsWith(prefix) : action === prefix,
  )
}

const ROLE_FROM_DEPARTMENT: Record<string, DepartmentHead['role']> = {
  'Technical Director': 'technical-director',
  'Race Engineer': 'race-engineer',
  'Commercial Director': 'commercial-director',
  'Team Manager': 'team-manager',
}

/**
 * Technical Director AI: Pick the next R&D upgrade to research.
 * Higher skill = better choices (prioritizes high-value upgrades).
 */
export function technicalDirectorDecision(
  team: Team,
  rng: PRNG,
): DepartmentDecision {
  const available = team.rndUpgrades.filter(u => u.status === 'available')
  const inProgress = team.rndUpgrades.filter(u => u.status === 'in-progress')

  if (inProgress.length >= 2 || available.length === 0) {
    return { department: 'Technical Director', action: 'monitor', description: 'Monitoring current R&D progress' }
  }

  const td = team.staff.find(s => s.role === 'technical-director')
  const skill = td?.skill ?? 70

  // Higher skill = pick higher value (sum of performance delta) upgrades
  const scored = available.map(u => {
    const value = Object.values(u.performanceDelta).reduce((s, v) => s + (v ?? 0), 0)
    const efficiency = value / u.developmentRaces
    // Add randomness inversely proportional to skill
    const noise = rng.range(-2, 2) * (1 - skill / 100)
    return { upgrade: u, score: efficiency + noise }
  })

  scored.sort((a, b) => b.score - a.score)
  const chosen = scored[0].upgrade

  return {
    department: 'Technical Director',
    action: `start-rnd:${chosen.id}`,
    description: `Recommends starting: ${chosen.name}`,
  }
}

/**
 * Race Engineer AI: Suggest a race strategy.
 */
export function raceEngineerDecision(
  team: Team,
  drivers: Driver[],
  compounds: [TireCompound, TireCompound, TireCompound],
  totalLaps: number,
  rng: PRNG,
): DepartmentDecision {
  const re = team.staff.find(s => s.role === 'race-engineer')
  const skill = re?.skill ?? 70

  // Simple strategy: 1-stop with medium/hard
  const pitLap = Math.round(totalLaps * (skill > 80 ? 0.45 : 0.4))

  return {
    department: 'Race Engineer',
    action: `strategy:1-stop:lap-${pitLap}`,
    description: `Suggests 1-stop: ${compounds[1]} → ${compounds[0]} at lap ${pitLap}`,
  }
}

/**
 * Commercial Director AI: Handle minor sponsor decisions.
 */
export function commercialDirectorDecision(
  team: Team,
  finance: FinanceState,
  rng: PRNG,
): DepartmentDecision {
  const cd = team.staff.find(s => s.role === 'commercial-director')
  const skill = cd?.skill ?? 70

  const unhappySponsors = finance.sponsors.filter(s => s.satisfaction < 40)

  if (unhappySponsors.length > 0) {
    if (skill > 75) {
      return {
        department: 'Commercial Director',
        action: 'sponsor-outreach',
        description: `Proactively reaching out to ${unhappySponsors[0].name} to address concerns`,
      }
    }
    return {
      department: 'Commercial Director',
      action: 'sponsor-monitor',
      description: `Monitoring ${unhappySponsors[0].name} satisfaction levels`,
    }
  }

  return {
    department: 'Commercial Director',
    action: 'marketing',
    description: 'Running standard marketing campaigns',
  }
}

/**
 * Team Manager AI: Handle staff and morale issues.
 */
export function teamManagerDecision(
  team: Team,
  drivers: Driver[],
  rng: PRNG,
): DepartmentDecision {
  const tm = team.staff.find(s => s.role === 'team-manager')
  const skill = tm?.skill ?? 70

  // Check for frustrated drivers
  const frustrated = drivers.filter(d => d.teamId === team.id && d.mood.frustration > 60)

  if (frustrated.length > 0 && skill > 70) {
    return {
      department: 'Team Manager',
      action: `driver-talk:${frustrated[0].id}`,
      description: `Scheduling one-on-one with ${frustrated[0].firstName} to address concerns`,
    }
  }

  if (team.morale < 65) {
    return {
      department: 'Team Manager',
      action: 'team-building',
      description: 'Organizing team building activities to boost morale',
    }
  }

  return {
    department: 'Team Manager',
    action: 'operations',
    description: 'Managing day-to-day team operations',
  }
}

/**
 * Get all department recommendations for a management phase.
 */
export function getAllDepartmentDecisions(
  team: Team,
  drivers: Driver[],
  finance: FinanceState,
  compounds: [TireCompound, TireCompound, TireCompound],
  totalLaps: number,
  rng: PRNG,
): DepartmentDecision[] {
  return [
    technicalDirectorDecision(team, rng),
    raceEngineerDecision(team, drivers, compounds, totalLaps, rng),
    commercialDirectorDecision(team, finance, rng),
    teamManagerDecision(team, drivers, rng),
  ]
}

/**
 * Generate the full Recommendation[] surfaced to the player for the current
 * management phase. Pure — computed at orchestrator time only and persisted
 * in `world.recommendations`. Never call from a render path.
 */
export function generateRecommendations(
  world: FullGameState,
  rng: PRNG,
): Recommendation[] {
  const team = world.teams.find(t => t.id === world.gameState.playerTeamId)
  if (!team) return []

  const finance = world.finance[team.id]
  const nextRace = world.calendar[world.gameState.currentRound - 1]
  const compounds = (nextRace?.circuit.compounds ?? ['C1', 'C2', 'C3']) as [TireCompound, TireCompound, TireCompound]
  const totalLaps = nextRace?.circuit.laps ?? 60

  const decisions = getAllDepartmentDecisions(team, world.drivers, finance, compounds, totalLaps, rng)
  const round = world.gameState.currentRound

  return decisions.map((d): Recommendation => {
    const role = ROLE_FROM_DEPARTMENT[d.department] ?? 'team-manager'
    return {
      id: `${round}:${role}`,
      role,
      department: d.department,
      action: d.action,
      description: d.description,
      applicable: classifyApplicable(d.action),
      status: 'active',
      generatedAtRound: round,
    }
  })
}
