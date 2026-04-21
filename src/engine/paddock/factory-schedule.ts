import type { FullGameState } from '@/engine/core/state-manager'
import type { RndUpgrade } from '@/types/team'
import type { Sponsor } from '@/types/finance'

/** Narrowest world-slice the schedule generator actually reads. */
export type WeeklyScheduleWorld = Pick<FullGameState, 'teams' | 'finance' | 'gameState' | 'calendar'>

export type WeeklyDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI'

export interface WeeklyScheduleItem {
  when: WeeklyDay
  label: string
}

/**
 * Derive the five-day factory calendar shown on the Paddock "This Week"
 * panel from the player team's world state. Entries are composed from:
 *   - the next unresolved sponsor with an underperforming KPI (media day)
 *   - the most-advanced in-progress R&D upgrade (review slot)
 *   - a board walkthrough mid-week (always present, anchors the layout)
 *   - freight-departure slot on Thursday (operational constant)
 *   - Friday practice session for the upcoming race weekend
 *
 * Pure function. No PRNG. Output length is always 5 — UI relies on this.
 */
export function generateWeeklySchedule(world: WeeklyScheduleWorld): WeeklyScheduleItem[] {
  const { teams, finance, gameState, calendar } = world
  const playerTeam = teams.find(t => t.id === gameState.playerTeamId)
  const playerFinance = finance[gameState.playerTeamId]
  const nextRace = calendar[gameState.currentRound - 1]

  const sponsorLabel = pickSponsorFocus(playerFinance?.sponsors ?? [])
  const rndLabel = pickRndFocus(playerTeam?.rndUpgrades ?? [])
  const practiceLabel = nextRace
    ? `FP1 · ${nextRace.circuit.name.split(' ')[0]} · 13:30 local`
    : 'FP1 briefing'

  return [
    { when: 'MON', label: sponsorLabel },
    { when: 'TUE', label: rndLabel },
    { when: 'WED', label: 'Factory walk-through with board' },
    { when: 'THU', label: 'Freight departs · 09:00' },
    { when: 'FRI', label: practiceLabel },
  ]
}

function pickSponsorFocus(sponsors: Sponsor[]): string {
  // Prefer a sponsor with the lowest satisfaction (most in need of attention).
  const ranked = [...sponsors].sort((a, b) => a.satisfaction - b.satisfaction)
  const focus = ranked[0]
  if (!focus) return 'Commercial planning session'
  return `Sponsor media day · ${focus.name}`
}

function pickRndFocus(upgrades: RndUpgrade[]): string {
  const inProgress = upgrades
    .filter(u => u.status === 'in-progress')
    .sort((a, b) => b.progress - a.progress)
  const focus = inProgress[0]
  if (focus) return `R&D review · ${focus.name}`
  const queued = upgrades.find(u => u.status === 'queued')
  if (queued) return `R&D kickoff · ${queued.name}`
  return 'R&D planning session'
}
