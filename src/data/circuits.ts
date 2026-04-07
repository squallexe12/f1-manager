import type { Circuit } from '@/types/race'

export const CIRCUITS: Circuit[] = [
  {
    id: 'melbourne', name: 'Australian Grand Prix', country: 'Australia', laps: 58,
    downforceLevel: 'medium', tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'high',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'shanghai', name: 'Chinese Grand Prix', country: 'China', laps: 56,
    downforceLevel: 'medium', tireWear: 'high', overtakingDifficulty: 'medium', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'suzuka', name: 'Japanese Grand Prix', country: 'Japan', laps: 53,
    downforceLevel: 'high', tireWear: 'high', overtakingDifficulty: 'high', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C1', 'C2', 'C3'],
  },
  {
    id: 'bahrain', name: 'Bahrain Grand Prix', country: 'Bahrain', laps: 57,
    downforceLevel: 'medium', tireWear: 'high', overtakingDifficulty: 'low', weatherVariability: 'low',
    sectorCount: 3, compounds: ['C1', 'C2', 'C3'],
  },
  {
    id: 'jeddah', name: 'Saudi Arabian Grand Prix', country: 'Saudi Arabia', laps: 50,
    downforceLevel: 'low', tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'miami', name: 'Miami Grand Prix', country: 'USA', laps: 57,
    downforceLevel: 'medium', tireWear: 'high', overtakingDifficulty: 'medium', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'imola', name: 'Emilia Romagna Grand Prix', country: 'Italy', laps: 63,
    downforceLevel: 'high', tireWear: 'medium', overtakingDifficulty: 'high', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'monaco', name: 'Monaco Grand Prix', country: 'Monaco', laps: 78,
    downforceLevel: 'high', tireWear: 'low', overtakingDifficulty: 'high', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C3', 'C4', 'C5'],
  },
  {
    id: 'montreal', name: 'Canadian Grand Prix', country: 'Canada', laps: 70,
    downforceLevel: 'low', tireWear: 'medium', overtakingDifficulty: 'low', weatherVariability: 'high',
    sectorCount: 3, compounds: ['C3', 'C4', 'C5'],
  },
  {
    id: 'barcelona', name: 'Spanish Grand Prix', country: 'Spain', laps: 66,
    downforceLevel: 'high', tireWear: 'high', overtakingDifficulty: 'medium', weatherVariability: 'low',
    sectorCount: 3, compounds: ['C1', 'C2', 'C3'],
  },
  {
    id: 'spielberg', name: 'Austrian Grand Prix', country: 'Austria', laps: 71,
    downforceLevel: 'low', tireWear: 'medium', overtakingDifficulty: 'low', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'silverstone', name: 'British Grand Prix', country: 'Great Britain', laps: 52,
    downforceLevel: 'high', tireWear: 'high', overtakingDifficulty: 'medium', weatherVariability: 'high',
    sectorCount: 3, compounds: ['C1', 'C2', 'C3'],
  },
  {
    id: 'spa', name: 'Belgian Grand Prix', country: 'Belgium', laps: 44,
    downforceLevel: 'medium', tireWear: 'medium', overtakingDifficulty: 'low', weatherVariability: 'high',
    sectorCount: 3, compounds: ['C1', 'C2', 'C3'],
  },
  {
    id: 'zandvoort', name: 'Dutch Grand Prix', country: 'Netherlands', laps: 72,
    downforceLevel: 'high', tireWear: 'medium', overtakingDifficulty: 'high', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C1', 'C2', 'C3'],
  },
  {
    id: 'monza', name: 'Italian Grand Prix', country: 'Italy', laps: 53,
    downforceLevel: 'low', tireWear: 'medium', overtakingDifficulty: 'low', weatherVariability: 'low',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'baku', name: 'Azerbaijan Grand Prix', country: 'Azerbaijan', laps: 51,
    downforceLevel: 'low', tireWear: 'medium', overtakingDifficulty: 'low', weatherVariability: 'low',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'singapore', name: 'Singapore Grand Prix', country: 'Singapore', laps: 62,
    downforceLevel: 'high', tireWear: 'high', overtakingDifficulty: 'high', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C3', 'C4', 'C5'],
  },
  {
    id: 'austin', name: 'United States Grand Prix', country: 'USA', laps: 56,
    downforceLevel: 'medium', tireWear: 'high', overtakingDifficulty: 'medium', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'mexico', name: 'Mexico City Grand Prix', country: 'Mexico', laps: 71,
    downforceLevel: 'high', tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'interlagos', name: 'São Paulo Grand Prix', country: 'Brazil', laps: 71,
    downforceLevel: 'medium', tireWear: 'high', overtakingDifficulty: 'low', weatherVariability: 'high',
    sectorCount: 3, compounds: ['C1', 'C2', 'C3'],
  },
  {
    id: 'las-vegas', name: 'Las Vegas Grand Prix', country: 'USA', laps: 50,
    downforceLevel: 'low', tireWear: 'medium', overtakingDifficulty: 'low', weatherVariability: 'low',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
  {
    id: 'abu-dhabi', name: 'Abu Dhabi Grand Prix', country: 'UAE', laps: 58,
    downforceLevel: 'medium', tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low',
    sectorCount: 3, compounds: ['C2', 'C3', 'C4'],
  },
]
