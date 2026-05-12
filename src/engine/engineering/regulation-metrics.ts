import type { Team } from '@/types/team'

/**
 * Active Aero Maturity %.
 * Filters team.rndUpgrades to branch === 'active-aero'.
 * Completed upgrades contribute 1.0; in-progress contribute progress/100;
 * everything else (locked, available, queued) contributes 0.
 * Returns 0 when no aero upgrades exist (defensive guard).
 */
export function activeAeroMaturity(team: Team): number {
  const aero = team.rndUpgrades.filter((u) => u.branch === 'active-aero')
  if (aero.length === 0) return 0
  let sum = 0
  for (const u of aero) {
    if (u.status === 'complete') sum += 1
    else if (u.status === 'in-progress') sum += Math.max(0, Math.min(100, u.progress)) / 100
  }
  return Math.round((sum / aero.length) * 100)
}

const TOTAL_RACES_2026 = 22

/**
 * Hybrid Efficiency Score (0-100).
 * Composite: 50% PU-branch R&D maturity, 30% reliability proxy
 * (1 - penaltiesTaken / TOTAL_RACES_2026, clamped [0,1]), 20% normalized
 * straightSpeed axis (which is the closest car axis coupled to the 2026
 * power-unit changes). Returns a single integer 0-100.
 */
export function hybridEfficiencyScore(team: Team): number {
  const pu = team.rndUpgrades.filter((u) => u.branch === 'power-unit')
  let puSum = 0
  if (pu.length > 0) {
    for (const u of pu) {
      if (u.status === 'complete') puSum += 1
      else if (u.status === 'in-progress')
        puSum += Math.max(0, Math.min(100, u.progress)) / 100
    }
  }
  const puMaturity = pu.length === 0 ? 0 : puSum / pu.length

  const penaltyRatio = team.penaltiesTaken / TOTAL_RACES_2026
  const reliability = Math.max(0, Math.min(1, 1 - penaltyRatio))

  const raw = team.car.straightSpeed
  const powerAxis =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.max(0, Math.min(1, raw / 100))
      : 0

  const score = 0.5 * puMaturity + 0.3 * reliability + 0.2 * powerAxis
  return Math.max(0, Math.min(100, Math.round(score * 100)))
}
