export interface RegulationChange {
  id: string
  season: number
  category: 'budget-cap' | 'aero' | 'power-unit' | 'tires' | 'sporting' | 'components'
  title: string
  description: string
  impact: {
    budgetCapDelta?: number       // e.g. +5_000_000
    windTunnelLimitDelta?: number // hours
    cfdLimitDelta?: number        // runs
    componentLimitDelta?: Record<string, number>
    carPerformanceDelta?: Record<string, number> // applied to all teams
  }
}

export interface TechnicalDirective {
  id: string
  season: number
  round: number // mid-season round when it takes effect
  title: string
  description: string
  affectedArea: 'floor' | 'diffuser' | 'front-wing' | 'rear-wing' | 'suspension' | 'power-unit' | 'weight'
  performanceImpact: Record<string, number> // keyed by car performance attribute
}

export const REGULATION_CHANGES: RegulationChange[] = [
  // Season 2
  {
    id: 'reg-s2-budget', season: 2, category: 'budget-cap',
    title: 'Budget Cap Increase',
    description: 'FIA approves budget cap increase to $220M to account for inflation and new sustainability requirements.',
    impact: { budgetCapDelta: 5_000_000 },
  },
  {
    id: 'reg-s2-aero', season: 2, category: 'aero',
    title: 'Active Aero Refinement',
    description: 'Revised active aero regulations reduce maximum rear wing angle by 2 degrees, slightly lowering peak downforce benefit.',
    impact: { carPerformanceDelta: { downforce: -2 } },
  },
  {
    id: 'reg-s2-components', season: 2, category: 'components',
    title: 'ERS Battery Allocation Increase',
    description: 'Teams now receive one additional ERS battery allocation per season.',
    impact: { componentLimitDelta: { 'ers-battery': 1 } },
  },

  // Season 3
  {
    id: 'reg-s3-tires', season: 3, category: 'tires',
    title: 'New Tire Construction',
    description: 'Pirelli introduces revised tire construction with wider operating windows. Tire management becomes less of a differentiator.',
    impact: { carPerformanceDelta: { tireManagement: -3 } },
  },
  {
    id: 'reg-s3-budget', season: 3, category: 'budget-cap',
    title: 'Cost Cap Adjustment',
    description: 'Budget cap remains at $220M but power unit development cap rises to $140M.',
    impact: {},
  },
  {
    id: 'reg-s3-sporting', season: 3, category: 'sporting',
    title: 'Sprint Format Expansion',
    description: 'FIA expands sprint format to 8 weekends per season, increasing points-scoring opportunities.',
    impact: {},
  },

  // Season 4
  {
    id: 'reg-s4-aero-major', season: 4, category: 'aero',
    title: 'Major Aerodynamic Regulation Change',
    description: 'Significant floor dimension reduction and revised front wing regulations aim to improve overtaking. All teams lose development advantages.',
    impact: { carPerformanceDelta: { downforce: -5, cornering: -3, straightSpeed: 2 } },
  },
  {
    id: 'reg-s4-budget', season: 4, category: 'budget-cap',
    title: 'Budget Cap to $225M',
    description: 'Budget cap increases to $225M with new exception for sustainable technology investments.',
    impact: { budgetCapDelta: 5_000_000 },
  },
  {
    id: 'reg-s4-pu', season: 4, category: 'power-unit',
    title: 'Power Unit Freeze Partial Lift',
    description: 'ICE development freeze partially lifted — teams can update combustion chamber design once per season.',
    impact: {},
  },

  // Season 5
  {
    id: 'reg-s5-weight', season: 5, category: 'sporting',
    title: 'Minimum Weight Reduction',
    description: 'Minimum car weight reduced by 10kg, rewarding teams with superior lightweight engineering.',
    impact: { carPerformanceDelta: { straightSpeed: 1, braking: 1 } },
  },
  {
    id: 'reg-s5-wind-tunnel', season: 5, category: 'aero',
    title: 'Wind Tunnel Hour Rebalancing',
    description: 'Revised ATR sliding scale: championship leaders lose 10% more tunnel time, last-place teams gain 10% more.',
    impact: { windTunnelLimitDelta: -5 },
  },
]

export const TECHNICAL_DIRECTIVES: TechnicalDirective[] = [
  // Season 1
  {
    id: 'td-s1-floor', season: 1, round: 8,
    title: 'TD-001: Floor Flexibility Clarification',
    description: 'FIA issues clarification on maximum floor deflection under load. Teams with aggressive floor designs may see reduced performance.',
    affectedArea: 'floor',
    performanceImpact: { downforce: -1, cornering: -1 },
  },
  {
    id: 'td-s1-suspension', season: 1, round: 14,
    title: 'TD-002: Suspension Travel Limits',
    description: 'New limits on suspension heave travel to reduce porpoising. Affects low-ride-height setups.',
    affectedArea: 'suspension',
    performanceImpact: { downforce: -1 },
  },

  // Season 2
  {
    id: 'td-s2-diffuser', season: 2, round: 6,
    title: 'TD-003: Diffuser Edge Legality',
    description: 'Clarification on diffuser edge sealing. Some creative interpretations ruled illegal.',
    affectedArea: 'diffuser',
    performanceImpact: { downforce: -2, cornering: -1 },
  },
  {
    id: 'td-s2-front-wing', season: 2, round: 12,
    title: 'TD-004: Active Front Wing Activation Threshold',
    description: 'Minimum speed for active front wing reduced from 200km/h to 180km/h, benefiting mid-speed corners.',
    affectedArea: 'front-wing',
    performanceImpact: { cornering: 1, downforce: 1 },
  },

  // Season 3
  {
    id: 'td-s3-pu', season: 3, round: 5,
    title: 'TD-005: Energy Recovery Limits',
    description: 'Maximum energy harvest per lap capped at revised levels. ERS-heavy teams lose slight advantage.',
    affectedArea: 'power-unit',
    performanceImpact: { straightSpeed: -1 },
  },
  {
    id: 'td-s3-rear-wing', season: 3, round: 16,
    title: 'TD-006: Rear Wing Endplate Geometry',
    description: 'Revised endplate dimensions reduce vortex generation. Marginal drag reduction for all.',
    affectedArea: 'rear-wing',
    performanceImpact: { straightSpeed: 1, downforce: -1 },
  },
]
