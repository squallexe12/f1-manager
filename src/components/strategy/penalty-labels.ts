import type { OffenceType, SanctionType } from '@/types/race'

// ─── Label maps ───────────────────────────────────────────────────────────────
//
// Shared by the strategy stewards card, post-race stewards decisions panel,
// and the Driver Office penalty record section. Keep this module pure
// (no side effects on import) — it is read by client components only.

export const OFFENCE_LABELS: Record<OffenceType, string> = {
  'collision-minor':   'Collision (minor)',
  'collision-serious': 'Collision (serious)',
  'forcing-off':       'Forcing Off',
  'illegal-defending': 'Illegal Defending',
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
