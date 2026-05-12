export type RegId =
  | 'active-aero'
  | 'no-mgu-h'
  | 'hybrid-50-50'
  | 'sustainable-fuel'
  | 'narrower-wheelbase'
  | 'cost-cap-2026'
  | 'cadillac-entry'
  | 'audi-entry'
  | 'no-drs'
  | 'pu-allocation-2026'

export type RegCardKey = 'aero' | 'power-unit' | 'car-performance'

export type RegTerm =
  | 'atr-coefficient'
  | 'correlation-delta'
  | 'wt-cfd'
  | 'ers'
  | 'mgu-h'
  | 'active-aero-mode'
  | 'sustainable-fuel'

export interface RegEntry {
  id: RegId
  ribbon: string
  cards: RegCardKey[]
  briefing: string
  citation?: { label: string; url: string }
}

export interface TermEntry {
  term: RegTerm
  label: string
  explainer: string
  seeAlso?: RegId
}

export const REG_2026: Record<RegId, RegEntry> = {
  'active-aero': {
    id: 'active-aero',
    ribbon: 'ACTIVE AERO',
    cards: ['aero'],
    briefing:
      'Front and rear wings adjust during the lap. Straight Mode trims drag on full-throttle zones; Overtake Mode unleashes extra electric deployment for attack. DRS is gone.',
  },
  'no-mgu-h': {
    id: 'no-mgu-h',
    ribbon: 'NO MGU-H',
    cards: ['power-unit'],
    briefing:
      'The motor-generator heat unit is removed for 2026. Energy recovery now leans entirely on MGU-K braking regen and battery sizing.',
  },
  'hybrid-50-50': {
    id: 'hybrid-50-50',
    ribbon: '50/50 HYBRID SPLIT',
    cards: ['power-unit'],
    briefing:
      'Power split is roughly 50/50 between the 1.6L V6 ICE and electric. Energy management across a lap is decisive — burn it wrong and the tail of the straight bleeds.',
  },
  'sustainable-fuel': {
    id: 'sustainable-fuel',
    ribbon: 'SUSTAINABLE FUEL',
    cards: ['power-unit'],
    briefing:
      'Fully sustainable advanced fuels are mandatory in 2026. Formulation affects burn efficiency and reliability margins.',
  },
  'narrower-wheelbase': {
    id: 'narrower-wheelbase',
    ribbon: '3400mm WHEELBASE',
    cards: ['car-performance'],
    briefing:
      'Cars are narrower and lighter; the wheelbase is capped at 3400mm. Mechanical grip and weight transfer are more sensitive to setup choices.',
  },
  'cost-cap-2026': {
    id: 'cost-cap-2026',
    ribbon: 'COST CAP IN EFFECT',
    cards: [],
    briefing:
      '$215M operations cap and $130M power-unit cap. Overruns are real: points deductions and wind-tunnel-hour reductions follow.',
  },
  'cadillac-entry': {
    id: 'cadillac-entry',
    ribbon: 'CADILLAC GRID ENTRY',
    cards: [],
    briefing:
      'Cadillac joins as the 11th constructor in 2026, with Ferrari power until its own PU programme is ready.',
  },
  'audi-entry': {
    id: 'audi-entry',
    ribbon: 'AUDI POWER UNIT',
    cards: [],
    briefing:
      'Audi takes over the former Sauber slot in 2026 with its own homologated power-unit programme.',
  },
  'no-drs': {
    id: 'no-drs',
    ribbon: 'DRS REPLACED',
    cards: [],
    briefing:
      'Drag Reduction System retired. Active-aero Straight Mode and a deployable Overtake Mode replace it.',
  },
  'pu-allocation-2026': {
    id: 'pu-allocation-2026',
    ribbon: 'PU ALLOCATION',
    cards: ['power-unit'],
    briefing:
      'Each driver gets a fixed allocation of power-unit elements per season. Exceeding it costs grid positions.',
  },
}

export const REG_TERMS: Record<RegTerm, TermEntry> = {
  'atr-coefficient': {
    term: 'atr-coefficient',
    label: 'ATR Coefficient',
    explainer:
      'Aerodynamic Testing Restriction multiplier — higher constructor positions get fewer wind-tunnel and CFD allocations under the FIA sliding scale.',
  },
  'correlation-delta': {
    term: 'correlation-delta',
    label: 'Correlation Delta',
    explainer:
      'Rolling gap between simulator-predicted upgrade gain and the gain measured on track. A widening Δ signals a tunnel-to-track correlation drift.',
    seeAlso: 'active-aero',
  },
  'wt-cfd': {
    term: 'wt-cfd',
    label: 'WT / CFD',
    explainer:
      'Wind Tunnel hours and Computational Fluid Dynamics runs — the two FIA-capped aero-testing budgets that pace your development pipeline.',
  },
  'ers': {
    term: 'ers',
    label: 'ERS',
    explainer:
      'Energy Recovery System. For 2026 it is entirely braking-regen (MGU-K) plus battery, with the heat unit retired.',
    seeAlso: 'no-mgu-h',
  },
  'mgu-h': {
    term: 'mgu-h',
    label: 'MGU-H',
    explainer:
      'Motor-Generator-Heat — the turbo-driven recovery unit. Removed in 2026 to simplify the PU and lower costs.',
    seeAlso: 'no-mgu-h',
  },
  'active-aero-mode': {
    term: 'active-aero-mode',
    label: 'Active Aero Mode',
    explainer:
      'A wing-position state — Straight Mode for low drag on full-throttle zones, or Overtake Mode for attacking deployment.',
    seeAlso: 'active-aero',
  },
  'sustainable-fuel': {
    term: 'sustainable-fuel',
    label: 'Sustainable Fuel',
    explainer:
      'Fully sustainable advanced fuel mandated for the 2026 regulations. Formulation affects burn efficiency and reliability margins.',
    seeAlso: 'sustainable-fuel',
  },
}

const CARD_ORDER: Record<RegCardKey, RegId[]> = {
  aero: ['active-aero'],
  'power-unit': ['no-mgu-h', 'hybrid-50-50', 'sustainable-fuel', 'pu-allocation-2026'],
  'car-performance': ['narrower-wheelbase'],
}

export function regsForCard(card: RegCardKey): RegEntry[] {
  return CARD_ORDER[card].map((id) => REG_2026[id])
}
