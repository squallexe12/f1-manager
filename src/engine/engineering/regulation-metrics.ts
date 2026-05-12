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
