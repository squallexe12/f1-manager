import type { SponsorTier } from '@/types/finance'
import type { PrestigeRating } from '@/types/finance'

export type SponsorMetricKind =
  | 'teamPoints'
  | 'teamWins'
  | 'teamPodiums'
  | 'constructorPosition'
  | 'driverMarketabilityAvg'
  | 'minDriverRaceFinishes'
  | 'bothDriversScored'
  | 'noCapBreach'
  | 'teamDnfs'

export const SPONSOR_METRIC_KINDS: readonly SponsorMetricKind[] = [
  'teamPoints', 'teamWins', 'teamPodiums', 'constructorPosition',
  'driverMarketabilityAvg', 'minDriverRaceFinishes', 'bothDriversScored',
  'noCapBreach', 'teamDnfs',
]

export interface SponsorTemplate {
  id: string
  name: string
  tier: SponsorTier
  annualValue: number
  bonusValue: number
  kpiTemplates: { description: string; target: number; metric: SponsorMetricKind }[]
  minimumPrestige: PrestigeRating
  contractLength: number // seasons
}

export const SPONSORS: SponsorTemplate[] = [
  // === Title Sponsors ===
  {
    id: 'sp-petrox', name: 'PetroX Energy', tier: 'title',
    annualValue: 45_000_000, bonusValue: 10_000_000,
    kpiTemplates: [
      { description: 'Finish in top 3 constructors', target: 3, metric: 'constructorPosition' },
      { description: 'Win at least 3 races', target: 3, metric: 'teamWins' },
    ],
    minimumPrestige: 'A', contractLength: 3,
  },
  {
    id: 'sp-nexatech', name: 'NexaTech', tier: 'title',
    annualValue: 40_000_000, bonusValue: 8_000_000,
    kpiTemplates: [
      { description: 'Finish in top 4 constructors', target: 4, metric: 'constructorPosition' },
      { description: 'Score at least 300 points', target: 300, metric: 'teamPoints' },
    ],
    minimumPrestige: 'A', contractLength: 2,
  },
  {
    id: 'sp-velociti', name: 'Velociti Sportswear', tier: 'title',
    annualValue: 35_000_000, bonusValue: 7_000_000,
    kpiTemplates: [
      { description: 'Finish in top 5 constructors', target: 5, metric: 'constructorPosition' },
      { description: 'At least 8 podiums combined', target: 8, metric: 'teamPodiums' },
    ],
    minimumPrestige: 'B+', contractLength: 2,
  },

  // === Major Sponsors ===
  {
    id: 'sp-quantumcloud', name: 'QuantumCloud', tier: 'major',
    annualValue: 18_000_000, bonusValue: 4_000_000,
    kpiTemplates: [
      { description: 'Finish in top 6 constructors', target: 6, metric: 'constructorPosition' },
    ],
    minimumPrestige: 'B+', contractLength: 2,
  },
  {
    id: 'sp-solarvolt', name: 'SolarVolt', tier: 'major',
    annualValue: 15_000_000, bonusValue: 3_000_000,
    kpiTemplates: [
      { description: 'Score at least 150 points', target: 150, metric: 'teamPoints' },
    ],
    minimumPrestige: 'B', contractLength: 2,
  },
  {
    id: 'sp-carbonedge', name: 'CarbonEdge Materials', tier: 'major',
    annualValue: 14_000_000, bonusValue: 3_000_000,
    kpiTemplates: [
      { description: 'At least 5 podium finishes', target: 5, metric: 'teamPodiums' },
    ],
    minimumPrestige: 'B', contractLength: 2,
  },
  {
    id: 'sp-skynet-air', name: 'SkyNet Air', tier: 'major',
    annualValue: 12_000_000, bonusValue: 2_500_000,
    kpiTemplates: [
      { description: 'Finish in top 7 constructors', target: 7, metric: 'constructorPosition' },
    ],
    minimumPrestige: 'C+', contractLength: 2,
  },
  {
    id: 'sp-hyperion', name: 'Hyperion Drinks', tier: 'major',
    annualValue: 11_000_000, bonusValue: 2_000_000,
    kpiTemplates: [
      { description: 'Score at least 100 points', target: 100, metric: 'teamPoints' },
    ],
    minimumPrestige: 'C+', contractLength: 1,
  },
  {
    id: 'sp-meridian', name: 'Meridian Insurance', tier: 'major',
    annualValue: 10_000_000, bonusValue: 2_000_000,
    kpiTemplates: [
      { description: 'Both drivers finish at least 18 races', target: 18, metric: 'minDriverRaceFinishes' },
    ],
    minimumPrestige: 'C', contractLength: 2,
  },
  {
    id: 'sp-aurum', name: 'Aurum Watches', tier: 'major',
    annualValue: 13_000_000, bonusValue: 3_000_000,
    kpiTemplates: [
      { description: 'Win at least 1 race', target: 1, metric: 'teamWins' },
    ],
    minimumPrestige: 'B', contractLength: 1,
  },

  // === Minor Sponsors ===
  {
    id: 'sp-gridlink', name: 'GridLink Telecom', tier: 'minor',
    annualValue: 5_000_000, bonusValue: 1_000_000,
    kpiTemplates: [
      { description: 'Score at least 50 points', target: 50, metric: 'teamPoints' },
    ],
    minimumPrestige: 'C', contractLength: 1,
  },
  {
    id: 'sp-apex-nutrition', name: 'Apex Nutrition', tier: 'minor',
    annualValue: 4_000_000, bonusValue: 800_000,
    kpiTemplates: [
      { description: 'At least 2 podium finishes', target: 2, metric: 'teamPodiums' },
    ],
    minimumPrestige: 'C', contractLength: 1,
  },
  {
    id: 'sp-turboshift', name: 'TurboShift Gaming', tier: 'minor',
    annualValue: 3_500_000, bonusValue: 700_000,
    kpiTemplates: [
      { description: 'Driver marketability average above 70', target: 70, metric: 'driverMarketabilityAvg' },
    ],
    minimumPrestige: 'D', contractLength: 1,
  },
  {
    id: 'sp-ironclad', name: 'Ironclad Security', tier: 'minor',
    annualValue: 3_000_000, bonusValue: 500_000,
    kpiTemplates: [
      { description: 'Finish season without budget cap breach', target: 1, metric: 'noCapBreach' },
    ],
    minimumPrestige: 'D', contractLength: 1,
  },
  {
    id: 'sp-driftline', name: 'Driftline Apparel', tier: 'minor',
    annualValue: 2_500_000, bonusValue: 500_000,
    kpiTemplates: [
      { description: 'Score at least 20 points', target: 20, metric: 'teamPoints' },
    ],
    minimumPrestige: 'D', contractLength: 1,
  },
  {
    id: 'sp-nova-fuels', name: 'Nova Sustainable Fuels', tier: 'minor',
    annualValue: 4_500_000, bonusValue: 1_000_000,
    kpiTemplates: [
      { description: 'No engine-related DNFs', target: 0, metric: 'teamDnfs' },
    ],
    minimumPrestige: 'C+', contractLength: 2,
  },
  {
    id: 'sp-blitz', name: 'Blitz Energy', tier: 'minor',
    annualValue: 2_000_000, bonusValue: 400_000,
    kpiTemplates: [
      { description: 'Both drivers score points at least once', target: 1, metric: 'bothDriversScored' },
    ],
    minimumPrestige: 'F', contractLength: 1,
  },
]
