/** A single circuit corner relevant to track-state offences (Tier C). */
export interface CornerProfile {
  id: string            // e.g. 'turn-9'
  name: string          // human label, e.g. 'Copse'
  lapFraction: number   // 0..1 — position within the lap (ordering / timing)
  trackLimitMonitored: boolean   // FIA track-limits hotspot?
  rejoinRisk: 'low' | 'med' | 'high'   // used by IP-C3 rejoin-collision
  difficultyTier: 1 | 2 | 3      // 1 = rarely abused, 3 = frequently abused
}

export interface CircuitCornerProfile {
  circuitId: string
  corners: CornerProfile[]   // ~3–6 monitored hotspots per circuit
}
