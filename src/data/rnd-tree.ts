import type { RndUpgrade } from '@/types/team'

type RndTemplate = Omit<RndUpgrade, 'progress' | 'status'>

/**
 * Per-cycle aerodynamic budget consumption for each upgrade. Calibrated so
 * a typical mid-season slate (one chassis + one aero in-progress) uses
 * ~30–50% of a mid-grid team's CDT window before reset, leaving room for
 * a third upgrade without immediate stall. Phase 3 (Box 3) reads these
 * values to drive `consumeAeroBudget`.
 *
 * Heuristic per branch:
 *  - chassis  → high WT, moderate CFD (real-world wind-tunnel-driven program)
 *  - power-unit → low WT, high CFD (engineering simulation, no aero work)
 *  - active-aero → high WT, high CFD (continuous correlation + simulation)
 */
export const RND_TREE: RndTemplate[] = [
  // === Chassis Branch ===
  {
    id: 'chassis-front-wing-v2', branch: 'chassis',
    name: 'Front Wing v2', description: 'Revised front wing endplates for improved outwash and Y250 vortex control.',
    cost: 8_000_000, developmentRaces: 3,
    performanceDelta: { downforce: 3, cornering: 2 },
    prerequisiteIds: [],
    wtHoursPerCycle: 22, cfdRunsPerCycle: 110,
  },
  {
    id: 'chassis-floor-upgrade', branch: 'chassis',
    name: 'Floor Upgrade', description: 'Enhanced Venturi tunnels and edge sealing for greater ground effect.',
    cost: 15_000_000, developmentRaces: 4,
    performanceDelta: { downforce: 5, cornering: 3, tireManagement: 1 },
    prerequisiteIds: ['chassis-front-wing-v2'],
    wtHoursPerCycle: 32, cfdRunsPerCycle: 160,
  },
  {
    id: 'chassis-rear-wing-active', branch: 'chassis',
    name: 'Active Rear Wing', description: 'Optimized rear wing actuation for better drag/downforce transition.',
    cost: 12_000_000, developmentRaces: 3,
    performanceDelta: { straightSpeed: 3, downforce: 2 },
    prerequisiteIds: ['chassis-front-wing-v2'],
    wtHoursPerCycle: 24, cfdRunsPerCycle: 130,
  },
  {
    id: 'chassis-sidepod-redesign', branch: 'chassis',
    name: 'Sidepod Redesign', description: 'Complete sidepod rethink with undercut geometry for improved airflow to rear.',
    cost: 20_000_000, developmentRaces: 5,
    performanceDelta: { downforce: 4, straightSpeed: 2, cornering: 3 },
    prerequisiteIds: ['chassis-floor-upgrade', 'chassis-rear-wing-active'],
    wtHoursPerCycle: 40, cfdRunsPerCycle: 200,
  },

  // === Power Unit Branch ===
  {
    id: 'pu-ers-efficiency', branch: 'power-unit',
    name: 'ERS Efficiency', description: 'Improved energy recovery software and battery cell chemistry.',
    cost: 10_000_000, developmentRaces: 3,
    performanceDelta: { straightSpeed: 2, reliability: 1 },
    prerequisiteIds: [],
    wtHoursPerCycle: 0, cfdRunsPerCycle: 90,
  },
  {
    id: 'pu-battery-capacity', branch: 'power-unit',
    name: 'Battery Capacity', description: 'Higher energy density cells for longer electric deployment zones.',
    cost: 14_000_000, developmentRaces: 4,
    performanceDelta: { straightSpeed: 3, tireManagement: 1 },
    prerequisiteIds: ['pu-ers-efficiency'],
    wtHoursPerCycle: 0, cfdRunsPerCycle: 120,
  },
  {
    id: 'pu-turbo-reliability', branch: 'power-unit',
    name: 'Turbo Reliability', description: 'Ceramic bearing upgrade and thermal management rework.',
    cost: 8_000_000, developmentRaces: 3,
    performanceDelta: { reliability: 5 },
    prerequisiteIds: ['pu-ers-efficiency'],
    wtHoursPerCycle: 0, cfdRunsPerCycle: 70,
  },
  {
    id: 'pu-ice-power-mode', branch: 'power-unit',
    name: 'ICE Power Mode', description: 'Aggressive combustion mapping for qualifying and overtake deployment.',
    cost: 18_000_000, developmentRaces: 5,
    performanceDelta: { straightSpeed: 5, reliability: -2 },
    prerequisiteIds: ['pu-battery-capacity', 'pu-turbo-reliability'],
    wtHoursPerCycle: 0, cfdRunsPerCycle: 180,
  },

  // === Active Aero Branch ===
  {
    id: 'aero-straight-mode-v2', branch: 'active-aero',
    name: 'Straight Mode v2', description: 'Refined low-drag configuration for DRS-replacement straight-line speed.',
    cost: 9_000_000, developmentRaces: 3,
    performanceDelta: { straightSpeed: 4 },
    prerequisiteIds: [],
    wtHoursPerCycle: 26, cfdRunsPerCycle: 140,
  },
  {
    id: 'aero-overtake-mode', branch: 'active-aero',
    name: 'Overtake Mode Efficiency', description: 'Faster wing transition with less turbulence for the following car.',
    cost: 12_000_000, developmentRaces: 4,
    performanceDelta: { straightSpeed: 2, braking: 2 },
    prerequisiteIds: ['aero-straight-mode-v2'],
    wtHoursPerCycle: 28, cfdRunsPerCycle: 150,
  },
  {
    id: 'aero-wing-sync', branch: 'active-aero',
    name: 'Wing Sync', description: 'Synchronized front/rear active aero for corner-entry balance.',
    cost: 11_000_000, developmentRaces: 3,
    performanceDelta: { cornering: 4, braking: 2 },
    prerequisiteIds: ['aero-straight-mode-v2'],
    wtHoursPerCycle: 24, cfdRunsPerCycle: 130,
  },
  {
    id: 'aero-adaptive-response', branch: 'active-aero',
    name: 'Adaptive Response', description: 'ML-tuned real-time wing angle adjustment across all speed ranges.',
    cost: 22_000_000, developmentRaces: 5,
    performanceDelta: { downforce: 3, straightSpeed: 3, cornering: 3, braking: 1 },
    prerequisiteIds: ['aero-overtake-mode', 'aero-wing-sync'],
    wtHoursPerCycle: 36, cfdRunsPerCycle: 220,
  },
]

/**
 * Default WT/CFD per-cycle costs for upgrades on legacy saves that pre-date
 * Phase 3. Picked at the lower-mid end of the range so a save migration
 * never accidentally pushes a team's running upgrades over the budget on
 * first load. Used by the v10 → v11 save migration.
 */
export const DEFAULT_WT_HOURS_PER_CYCLE = 2
export const DEFAULT_CFD_RUNS_PER_CYCLE = 80
