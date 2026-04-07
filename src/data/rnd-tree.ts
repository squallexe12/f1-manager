import type { RndUpgrade } from '@/types/team'

type RndTemplate = Omit<RndUpgrade, 'progress' | 'status'>

export const RND_TREE: RndTemplate[] = [
  // === Chassis Branch ===
  {
    id: 'chassis-front-wing-v2', branch: 'chassis',
    name: 'Front Wing v2', description: 'Revised front wing endplates for improved outwash and Y250 vortex control.',
    cost: 8_000_000, developmentRaces: 3,
    performanceDelta: { downforce: 3, cornering: 2 },
    prerequisiteIds: [],
  },
  {
    id: 'chassis-floor-upgrade', branch: 'chassis',
    name: 'Floor Upgrade', description: 'Enhanced Venturi tunnels and edge sealing for greater ground effect.',
    cost: 15_000_000, developmentRaces: 4,
    performanceDelta: { downforce: 5, cornering: 3, tireManagement: 1 },
    prerequisiteIds: ['chassis-front-wing-v2'],
  },
  {
    id: 'chassis-rear-wing-active', branch: 'chassis',
    name: 'Active Rear Wing', description: 'Optimized rear wing actuation for better drag/downforce transition.',
    cost: 12_000_000, developmentRaces: 3,
    performanceDelta: { straightSpeed: 3, downforce: 2 },
    prerequisiteIds: ['chassis-front-wing-v2'],
  },
  {
    id: 'chassis-sidepod-redesign', branch: 'chassis',
    name: 'Sidepod Redesign', description: 'Complete sidepod rethink with undercut geometry for improved airflow to rear.',
    cost: 20_000_000, developmentRaces: 5,
    performanceDelta: { downforce: 4, straightSpeed: 2, cornering: 3 },
    prerequisiteIds: ['chassis-floor-upgrade', 'chassis-rear-wing-active'],
  },

  // === Power Unit Branch ===
  {
    id: 'pu-ers-efficiency', branch: 'power-unit',
    name: 'ERS Efficiency', description: 'Improved energy recovery software and battery cell chemistry.',
    cost: 10_000_000, developmentRaces: 3,
    performanceDelta: { straightSpeed: 2, reliability: 1 },
    prerequisiteIds: [],
  },
  {
    id: 'pu-battery-capacity', branch: 'power-unit',
    name: 'Battery Capacity', description: 'Higher energy density cells for longer electric deployment zones.',
    cost: 14_000_000, developmentRaces: 4,
    performanceDelta: { straightSpeed: 3, tireManagement: 1 },
    prerequisiteIds: ['pu-ers-efficiency'],
  },
  {
    id: 'pu-turbo-reliability', branch: 'power-unit',
    name: 'Turbo Reliability', description: 'Ceramic bearing upgrade and thermal management rework.',
    cost: 8_000_000, developmentRaces: 3,
    performanceDelta: { reliability: 5 },
    prerequisiteIds: ['pu-ers-efficiency'],
  },
  {
    id: 'pu-ice-power-mode', branch: 'power-unit',
    name: 'ICE Power Mode', description: 'Aggressive combustion mapping for qualifying and overtake deployment.',
    cost: 18_000_000, developmentRaces: 5,
    performanceDelta: { straightSpeed: 5, reliability: -2 },
    prerequisiteIds: ['pu-battery-capacity', 'pu-turbo-reliability'],
  },

  // === Active Aero Branch ===
  {
    id: 'aero-straight-mode-v2', branch: 'active-aero',
    name: 'Straight Mode v2', description: 'Refined low-drag configuration for DRS-replacement straight-line speed.',
    cost: 9_000_000, developmentRaces: 3,
    performanceDelta: { straightSpeed: 4 },
    prerequisiteIds: [],
  },
  {
    id: 'aero-overtake-mode', branch: 'active-aero',
    name: 'Overtake Mode Efficiency', description: 'Faster wing transition with less turbulence for the following car.',
    cost: 12_000_000, developmentRaces: 4,
    performanceDelta: { straightSpeed: 2, braking: 2 },
    prerequisiteIds: ['aero-straight-mode-v2'],
  },
  {
    id: 'aero-wing-sync', branch: 'active-aero',
    name: 'Wing Sync', description: 'Synchronized front/rear active aero for corner-entry balance.',
    cost: 11_000_000, developmentRaces: 3,
    performanceDelta: { cornering: 4, braking: 2 },
    prerequisiteIds: ['aero-straight-mode-v2'],
  },
  {
    id: 'aero-adaptive-response', branch: 'active-aero',
    name: 'Adaptive Response', description: 'ML-tuned real-time wing angle adjustment across all speed ranges.',
    cost: 22_000_000, developmentRaces: 5,
    performanceDelta: { downforce: 3, straightSpeed: 3, cornering: 3, braking: 1 },
    prerequisiteIds: ['aero-overtake-mode', 'aero-wing-sync'],
  },
]
