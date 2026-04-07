import type { Team, RndUpgrade } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { PRNG } from '@/engine/core/prng'
import { processRnDCycle, startUpgrade } from '@/engine/engineering/rnd-engine'

/**
 * Simplified AI decision-making for non-player teams.
 * Called once per management phase for each AI team.
 */
export function aiTeamManagementPhase(
  team: Team,
  drivers: Driver[],
  rng: PRNG,
): { updatedTeam: Team; updatedDrivers: Driver[] } {
  let upgrades = [...team.rndUpgrades.map(u => ({ ...u }))]

  // 1. Advance existing R&D
  upgrades = processRnDCycle(upgrades)

  // 2. Start new R&D based on personality
  const inProgress = upgrades.filter(u => u.status === 'in-progress').length
  const available = upgrades.filter(u => u.status === 'available')

  if (inProgress < 2 && available.length > 0) {
    const personality = team.aiPersonality!

    // Pick upgrade based on personality weights
    const scored = available.map(u => {
      let score = 0
      const delta = u.performanceDelta

      // Aggressive teams prioritize raw speed
      if (delta.straightSpeed) score += (delta.straightSpeed ?? 0) * personality.aggressiveness
      if (delta.downforce) score += (delta.downforce ?? 0) * personality.aggressiveness * 0.8

      // Financial discipline = prefer cheaper upgrades
      score += (1 - u.cost / 25_000_000) * personality.financialDiscipline * 3

      // Driver-focused teams prefer tire management + cornering
      if (delta.tireManagement) score += (delta.tireManagement ?? 0) * personality.driverFocus
      if (delta.cornering) score += (delta.cornering ?? 0) * personality.driverFocus * 0.5

      // Reliability-focused
      if (delta.reliability) score += (delta.reliability ?? 0) * personality.financialDiscipline * 0.5

      // Add noise
      score += rng.range(-1, 1)

      return { upgrade: u, score }
    })

    scored.sort((a, b) => b.score - a.score)
    upgrades = startUpgrade(upgrades, scored[0].upgrade.id)
  }

  // 3. Simplified driver mood drift (AI drivers trend toward stable moods)
  const updatedDrivers = drivers.map(d => {
    if (d.teamId !== team.id) return d
    return {
      ...d,
      mood: {
        motivation: d.mood.motivation + (70 - d.mood.motivation) * 0.05,
        frustration: d.mood.frustration + (25 - d.mood.frustration) * 0.05,
        confidence: d.mood.confidence + (70 - d.mood.confidence) * 0.05,
      },
    }
  })

  return {
    updatedTeam: { ...team, rndUpgrades: upgrades },
    updatedDrivers,
  }
}

/**
 * Run AI management for all non-player teams.
 */
export function processAllAITeams(
  teams: Team[],
  drivers: Driver[],
  playerTeamId: string,
  rng: PRNG,
): { teams: Team[]; drivers: Driver[] } {
  let updatedDrivers = [...drivers]
  const updatedTeams = teams.map(team => {
    if (team.id === playerTeamId || !team.aiPersonality) return team

    const teamDrivers = updatedDrivers.filter(d => d.teamId === team.id)
    const result = aiTeamManagementPhase(team, teamDrivers, rng)

    // Merge updated drivers back
    updatedDrivers = updatedDrivers.map(d => {
      const updated = result.updatedDrivers.find(ud => ud.id === d.id)
      return updated ?? d
    })

    return result.updatedTeam
  })

  return { teams: updatedTeams, drivers: updatedDrivers }
}
