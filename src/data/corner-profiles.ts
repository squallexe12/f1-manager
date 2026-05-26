import type { CircuitCornerProfile } from '@/types/corner'

/**
 * Per-circuit FIA track-limits hotspot corners (Tier C).
 *
 * Corner data sourced from FIA event notes, track-limits bulletins, and
 * historical enforcement patterns:
 *   - High-abuse circuits (tier-3 corners, more hotspots): spielberg, austin,
 *     silverstone, imola, mexico, qatar, abu-dhabi, barcelona.
 *   - Low-abuse circuits (walls/kerbs deter running wide): monaco, singapore,
 *     monza, zandvoort, montreal, baku, jeddah, las-vegas.
 *   - Medium: all others.
 *
 * lapFraction is a 0–1 position within the lap; corners are listed in lap order.
 * difficultyTier 3 = frequently abused (wide runoff, FIA camera always present).
 * difficultyTier 1 = rarely abused (concrete/walls discourage it).
 */

/** Neutral fallback for circuits without a hand-entered profile (no monitored corners → no track-limits events). */
export const DEFAULT_CORNER_PROFILE: CircuitCornerProfile = { circuitId: '__default__', corners: [] }

export const CORNER_PROFILES: Record<string, CircuitCornerProfile> = {
  // ── HIGH ABUSE ─────────────────────────────────────────────────────────────

  'spielberg': {
    circuitId: 'spielberg',
    corners: [
      { id: 'turn-9',  name: 'Rindt',    lapFraction: 0.78, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 3 },
      { id: 'turn-10', name: 'Turn 10',  lapFraction: 0.86, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'turn-6',  name: 'Turn 6',   lapFraction: 0.55, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
      { id: 'turn-1',  name: 'Niki Lauda', lapFraction: 0.08, trackLimitMonitored: false, rejoinRisk: 'med', difficultyTier: 1 },
    ],
  },

  'austin': {
    circuitId: 'austin',
    corners: [
      { id: 'turn-19', name: 'Turn 19',   lapFraction: 0.92, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 3 },
      { id: 'turn-9',  name: 'Esses Exit', lapFraction: 0.45, trackLimitMonitored: true, rejoinRisk: 'low',  difficultyTier: 2 },
      { id: 'turn-12', name: 'Turn 12',   lapFraction: 0.60, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 3 },
      { id: 'turn-15', name: 'Turn 15',   lapFraction: 0.72, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
      { id: 'turn-1',  name: 'Turn 1',    lapFraction: 0.06, trackLimitMonitored: false, rejoinRisk: 'high', difficultyTier: 2 },
    ],
  },

  'silverstone': {
    circuitId: 'silverstone',
    corners: [
      { id: 'turn-9',  name: 'Copse',  lapFraction: 0.30, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 2 },
      { id: 'turn-15', name: 'Stowe',  lapFraction: 0.70, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-18', name: 'Club',   lapFraction: 0.92, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'turn-7',  name: 'Maggotts', lapFraction: 0.38, trackLimitMonitored: true, rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'turn-8',  name: 'Becketts', lapFraction: 0.42, trackLimitMonitored: true, rejoinRisk: 'med',  difficultyTier: 3 },
    ],
  },

  'imola': {
    circuitId: 'imola',
    corners: [
      { id: 'piratella',   name: 'Piratella',      lapFraction: 0.42, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'variante-alta', name: 'Variante Alta', lapFraction: 0.58, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'tamburello',  name: 'Tamburello',     lapFraction: 0.12, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'tosa',        name: 'Tosa',           lapFraction: 0.22, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'rivazza',     name: 'Rivazza',        lapFraction: 0.88, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
    ],
  },

  'mexico': {
    circuitId: 'mexico',
    corners: [
      { id: 'peraltada',   name: 'Peraltada',     lapFraction: 0.90, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'turn-1',      name: 'Turn 1',        lapFraction: 0.05, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'esses',       name: 'Esses',         lapFraction: 0.35, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 3 },
      { id: 'turn-13',     name: 'Turn 13',       lapFraction: 0.68, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'hairpin',     name: 'Hairpin',       lapFraction: 0.20, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'qatar': {
    circuitId: 'qatar',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.05, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 3 },
      { id: 'turn-12',  name: 'Turn 12',   lapFraction: 0.62, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'turn-14',  name: 'Turn 14',   lapFraction: 0.72, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-16',  name: 'Turn 16',   lapFraction: 0.85, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'turn-6',   name: 'Turn 6',    lapFraction: 0.30, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'abu-dhabi': {
    circuitId: 'abu-dhabi',
    corners: [
      { id: 'turn-5',   name: 'Turn 5',    lapFraction: 0.25, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
      { id: 'turn-9',   name: 'Turn 9',    lapFraction: 0.48, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 3 },
      { id: 'turn-11',  name: 'Turn 11',   lapFraction: 0.56, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'turn-17',  name: 'Turn 17',   lapFraction: 0.82, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-20',  name: 'Turn 20',   lapFraction: 0.94, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'barcelona': {
    circuitId: 'barcelona',
    corners: [
      { id: 'turn-3',   name: 'Turn 3',    lapFraction: 0.18, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 3 },
      { id: 'turn-9',   name: 'Turn 9',    lapFraction: 0.55, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 3 },
      { id: 'turn-12',  name: 'Turn 12',   lapFraction: 0.72, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-16',  name: 'Turn 16',   lapFraction: 0.92, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.05, trackLimitMonitored: false, rejoinRisk: 'med',  difficultyTier: 1 },
    ],
  },

  // ── MEDIUM ABUSE ───────────────────────────────────────────────────────────

  'melbourne': {
    circuitId: 'melbourne',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.06, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-9',   name: 'Turn 9',    lapFraction: 0.42, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
      { id: 'turn-13',  name: 'Turn 13',   lapFraction: 0.65, trackLimitMonitored: false, rejoinRisk: 'med',  difficultyTier: 1 },
      { id: 'turn-15',  name: 'Turn 15',   lapFraction: 0.80, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
    ],
  },

  'shanghai': {
    circuitId: 'shanghai',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.05, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-6',   name: 'Turn 6',    lapFraction: 0.38, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 2 },
      { id: 'turn-11',  name: 'Turn 11',   lapFraction: 0.60, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-16',  name: 'Turn 16',   lapFraction: 0.85, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'suzuka': {
    circuitId: 'suzuka',
    corners: [
      { id: 'turn-130r', name: '130R',     lapFraction: 0.72, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 2 },
      { id: 'turn-spoon', name: 'Spoon Curve', lapFraction: 0.62, trackLimitMonitored: true, rejoinRisk: 'med', difficultyTier: 2 },
      { id: 'turn-1',    name: 'Turn 1',   lapFraction: 0.04, trackLimitMonitored: false, rejoinRisk: 'med',  difficultyTier: 1 },
      { id: 'esses',     name: 'Esses',    lapFraction: 0.22, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
    ],
  },

  'bahrain': {
    circuitId: 'bahrain',
    corners: [
      { id: 'turn-4',   name: 'Turn 4',    lapFraction: 0.20, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
      { id: 'turn-10',  name: 'Turn 10',   lapFraction: 0.55, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-14',  name: 'Turn 14',   lapFraction: 0.78, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'miami': {
    circuitId: 'miami',
    corners: [
      { id: 'turn-11',  name: 'Turn 11',   lapFraction: 0.52, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-14',  name: 'Turn 14',   lapFraction: 0.68, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 2 },
      { id: 'turn-4',   name: 'Turn 4',    lapFraction: 0.18, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'turn-17',  name: 'Turn 17',   lapFraction: 0.82, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
    ],
  },

  'hungary': {
    circuitId: 'hungary',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.06, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-4',   name: 'Turn 4',    lapFraction: 0.28, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 2 },
      { id: 'turn-11',  name: 'Turn 11',   lapFraction: 0.62, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-14',  name: 'Turn 14',   lapFraction: 0.82, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'spa': {
    circuitId: 'spa',
    corners: [
      { id: 'raidillon', name: 'Raidillon',  lapFraction: 0.18, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 2 },
      { id: 'pouhon',    name: 'Pouhon',     lapFraction: 0.48, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'blanchimont', name: 'Blanchimont', lapFraction: 0.78, trackLimitMonitored: true, rejoinRisk: 'high', difficultyTier: 2 },
      { id: 'turn-1',    name: 'La Source',  lapFraction: 0.04, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'interlagos': {
    circuitId: 'interlagos',
    corners: [
      { id: 'senna-s',  name: 'Senna S',    lapFraction: 0.08, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-4',   name: 'Turn 4',     lapFraction: 0.32, trackLimitMonitored: true,  rejoinRisk: 'high', difficultyTier: 2 },
      { id: 'turn-11',  name: 'Turn 11',    lapFraction: 0.68, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'junção',   name: 'Junção',     lapFraction: 0.88, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
    ],
  },

  // ── LOW ABUSE (walls / barriers / tight kerbs deter running wide) ──────────

  'monaco': {
    circuitId: 'monaco',
    corners: [
      { id: 'sainte-devote', name: 'Sainte-Dévote', lapFraction: 0.06, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'casino',        name: 'Casino',         lapFraction: 0.28, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'mirabeau',      name: 'Mirabeau',       lapFraction: 0.42, trackLimitMonitored: false, rejoinRisk: 'med',  difficultyTier: 1 },
      { id: 'rascasse',      name: 'Rascasse',       lapFraction: 0.85, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'singapore': {
    circuitId: 'singapore',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.04, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'turn-10',  name: 'Turn 10',   lapFraction: 0.42, trackLimitMonitored: false, rejoinRisk: 'med',  difficultyTier: 1 },
      { id: 'turn-18',  name: 'Turn 18',   lapFraction: 0.78, trackLimitMonitored: true,  rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'monza': {
    circuitId: 'monza',
    corners: [
      { id: 'turn-1',   name: 'Variante del Rettifilo', lapFraction: 0.08, trackLimitMonitored: false, rejoinRisk: 'med',  difficultyTier: 1 },
      { id: 'lesmo-1',  name: 'Lesmo 1',   lapFraction: 0.38, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'ascari',   name: 'Ascari',    lapFraction: 0.60, trackLimitMonitored: false, rejoinRisk: 'high', difficultyTier: 1 },
      { id: 'parabolica', name: 'Parabolica', lapFraction: 0.88, trackLimitMonitored: true, rejoinRisk: 'med', difficultyTier: 2 },
    ],
  },

  'zandvoort': {
    circuitId: 'zandvoort',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.06, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'hugenholtz', name: 'Hugenholtzbocht', lapFraction: 0.42, trackLimitMonitored: false, rejoinRisk: 'low', difficultyTier: 1 },
      { id: 'turn-11',  name: 'Scheivlak', lapFraction: 0.68, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'arie-luyendyk', name: 'Arie Luyendykbocht', lapFraction: 0.85, trackLimitMonitored: false, rejoinRisk: 'low', difficultyTier: 1 },
    ],
  },

  'montreal': {
    circuitId: 'montreal',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.06, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'hairpin',  name: 'Hairpin',   lapFraction: 0.48, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'wall-of-champions', name: 'Wall of Champions', lapFraction: 0.88, trackLimitMonitored: false, rejoinRisk: 'high', difficultyTier: 1 },
    ],
  },

  'baku': {
    circuitId: 'baku',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.04, trackLimitMonitored: false, rejoinRisk: 'high', difficultyTier: 1 },
      { id: 'turn-8',   name: 'Turn 8',    lapFraction: 0.42, trackLimitMonitored: false, rejoinRisk: 'med',  difficultyTier: 1 },
      { id: 'castle-corner', name: 'Castle Corner', lapFraction: 0.55, trackLimitMonitored: true, rejoinRisk: 'med', difficultyTier: 2 },
      { id: 'turn-20',  name: 'Turn 20',   lapFraction: 0.90, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },

  'jeddah': {
    circuitId: 'jeddah',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.04, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'turn-13',  name: 'Turn 13',   lapFraction: 0.50, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-22',  name: 'Turn 22',   lapFraction: 0.88, trackLimitMonitored: false, rejoinRisk: 'high', difficultyTier: 1 },
    ],
  },

  'las-vegas': {
    circuitId: 'las-vegas',
    corners: [
      { id: 'turn-1',   name: 'Turn 1',    lapFraction: 0.05, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
      { id: 'turn-4',   name: 'Turn 4',    lapFraction: 0.28, trackLimitMonitored: true,  rejoinRisk: 'med',  difficultyTier: 2 },
      { id: 'turn-12',  name: 'Turn 12',   lapFraction: 0.75, trackLimitMonitored: false, rejoinRisk: 'low',  difficultyTier: 1 },
    ],
  },
}

/** Lookup with fallback (mirrors pitLaneForCircuit). */
export function cornersForCircuit(circuitId: string, fallback: CircuitCornerProfile): CircuitCornerProfile {
  return CORNER_PROFILES[circuitId] ?? fallback
}
