import type { OffenceType, SanctionType } from '@/types/race'

// ─── Label maps ───────────────────────────────────────────────────────────────
//
// Shared by the strategy stewards card, post-race stewards decisions panel,
// and the Driver Office penalty record section. Keep this module pure
// (no side effects on import) — it is read by client components only.

export const OFFENCE_LABELS: Record<OffenceType, string> = {
  'collision-minor':    'Collision (minor)',
  'collision-serious':  'Collision (serious)',
  'forcing-off':        'Forcing Off',
  'illegal-defending':  'Illegal Defending',
  'unsafe-release':     'Unsafe Release',
  'pit-lane-speeding':  'Pit-Lane Speeding',
  'failure-to-serve':   'Failure to Serve',
  'track-limits':       'Track Limits',
  'rejoin-collision':   'Unsafe Rejoin',
  'yellow-flag-breach': 'Yellow-Flag Breach',
  'sc-infraction':      'Safety-Car Infraction',
  'vsc-infraction':     'VSC Infraction',
  'red-flag-breach':    'Red-Flag Breach',
  'pit-line-crossing':  'Pit-Line Crossing',
}

export const SANCTION_LABELS: Record<SanctionType, string> = {
  'reprimand':      'Reprimand',
  'fine':           'Fine',
  '5s':             '+5s',
  '10s':            '+10s',
  'drive-through':  'Drive-Through',
  'stop-go':        'Stop-and-Go',
  'grid-drop':      'Grid Drop',
}

// ─── Penalty-point risk banding ───────────────────────────────────────────────
//
// Single source of truth for "how dangerous is this driver's active
// penalty-point total." Used by both the post-race Stewards Decisions panel
// and the Driver Office penalty record section so the same total renders
// the same colour and label everywhere.
//
// Thresholds anchor on the FIA framework: 5 active points starts to look
// risky, 9+ is one bad incident from a ban, 12 triggers the next-race ban.

export type PenaltyRiskBand = 'clean' | 'approaching' | 'warning' | 'critical'

export function bandForPoints(points: number): PenaltyRiskBand {
  if (points >= 12) return 'critical'
  if (points >= 9)  return 'warning'
  if (points >= 5)  return 'approaching'
  return 'clean'
}

/**
 * CSS colour for a band. Returns a `var(--…)` reference where possible so
 * theme switches (kinetic / broadcast) flow through without rewrites.
 *
 * `warning` uses `--sig-red-dk` — the darker red token — so it is visually
 * distinct from the ban tier (`--sig-red`). Without that distinction a
 * 9-point driver and a 12-point driver render identically, which is the
 * exact bug this helper exists to fix.
 */
export function colorForBand(band: PenaltyRiskBand): string {
  switch (band) {
    case 'clean':       return 'var(--sig-green)'
    case 'approaching': return 'var(--sig-amber)'
    case 'warning':     return 'var(--sig-red-dk)'
    case 'critical':    return 'var(--sig-red)'
  }
}

export function labelForBand(band: PenaltyRiskBand): string {
  switch (band) {
    case 'clean':       return 'CLEAN'
    case 'approaching': return 'WARNING'
    case 'warning':     return 'CRITICAL'
    case 'critical':    return 'BANNED'
  }
}
