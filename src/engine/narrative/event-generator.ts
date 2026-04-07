import type { NarrativeEvent, EventConsequence } from '@/types/narrative'
import type { Driver } from '@/types/driver'
import type { Team } from '@/types/team'
import type { FinanceState } from '@/types/finance'
import { EVENT_TEMPLATES, type EventCondition, type EventTemplate } from '@/data/events/templates'
import type { PRNG } from '@/engine/core/prng'

export interface GameContext {
  currentRound: number
  playerTeamId: string
  drivers: Driver[]
  teams: Team[]
  finance: Record<string, FinanceState>
  recentResults: { driverId: string; position: number; dnf: boolean }[]
}

interface EventCooldowns {
  [templateId: string]: number // round when cooldown expires
}

/**
 * Check if a single condition is met in the current game context.
 */
function evaluateCondition(condition: EventCondition, ctx: GameContext): boolean {
  const playerTeam = ctx.teams.find(t => t.id === ctx.playerTeamId)!
  const playerDrivers = ctx.drivers.filter(d => d.teamId === ctx.playerTeamId)

  switch (condition.type) {
    case 'driver-frustration-high':
      return playerDrivers.some(d => d.mood.frustration >= (condition.threshold ?? 65))
    case 'driver-confidence-low':
      return playerDrivers.some(d => d.mood.confidence <= (condition.threshold ?? 40))
    case 'teammate-rivalry':
      return playerDrivers.some(d => d.rivalries.length > 0)
    case 'sponsor-unhappy': {
      const finance = ctx.finance[ctx.playerTeamId]
      return finance?.sponsors.some(s => s.satisfaction < 35) ?? false
    }
    case 'budget-cap-risk': {
      const finance = ctx.finance[ctx.playerTeamId]
      return finance?.budget.penaltyRisk ?? false
    }
    case 'consecutive-dnfs':
      return ctx.recentResults.filter(r => r.dnf).length >= 2
    case 'winning-streak':
      return ctx.recentResults.filter(r => r.position === 1).length >= 2
    case 'media-attention':
      return ctx.recentResults.filter(r => r.position <= 3).length >= 3
    case 'poaching-risk':
      return playerDrivers.some(d =>
        d.attributes.pace >= 85 && d.mood.motivation < 60
      )
    case 'staff-issue':
      return playerTeam.morale < 60
    case 'car-unreliable':
      return playerTeam.car.reliability < 70
    case 'driver-contract-expiring':
      return playerDrivers.some(d => d.contract && d.contract.termEndSeason <= 1)
    default:
      return false
  }
}

/**
 * Generate narrative events for the current round based on game state.
 */
export function generateEvents(
  ctx: GameContext,
  existingEvents: NarrativeEvent[],
  cooldowns: EventCooldowns,
  rng: PRNG,
): { newEvents: NarrativeEvent[]; updatedCooldowns: EventCooldowns } {
  const newEvents: NarrativeEvent[] = []
  const updatedCooldowns = { ...cooldowns }

  for (const template of EVENT_TEMPLATES) {
    // Check cooldown
    if (updatedCooldowns[template.id] && updatedCooldowns[template.id] > ctx.currentRound) {
      continue
    }

    // Check all conditions
    const conditionsMet = template.conditions.every(c => evaluateCondition(c, ctx))
    if (!conditionsMet) continue

    // Random chance (not every matching event fires — 40% chance)
    if (!rng.chance(0.4)) continue

    const event: NarrativeEvent = {
      id: `${template.id}-r${ctx.currentRound}`,
      thread: template.thread,
      severity: template.severity,
      headline: template.headline,
      body: template.body,
      options: template.options ? template.options.map(o => ({ ...o, consequences: [...o.consequences] })) : null,
      defaultOutcome: template.defaultOutcome ? [...template.defaultOutcome] : null,
      arcId: null,
      triggeredAtRound: ctx.currentRound,
      expiresAtRound: template.expiresAfterRaces
        ? ctx.currentRound + template.expiresAfterRaces
        : null,
      resolved: false,
    }

    newEvents.push(event)
    updatedCooldowns[template.id] = ctx.currentRound + template.cooldownRaces
  }

  return { newEvents, updatedCooldowns }
}

/**
 * Resolve expired events by applying their default outcomes.
 */
export function resolveExpiredEvents(
  events: NarrativeEvent[],
  currentRound: number,
): { resolved: NarrativeEvent[]; consequences: EventConsequence[] } {
  const consequences: EventConsequence[] = []
  const resolved = events.map(event => {
    if (!event.resolved && event.expiresAtRound && currentRound >= event.expiresAtRound) {
      if (event.defaultOutcome) {
        consequences.push(...event.defaultOutcome)
      }
      return { ...event, resolved: true }
    }
    return event
  })

  return { resolved, consequences }
}
