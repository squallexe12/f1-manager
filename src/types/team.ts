export interface CarPerformance {
  downforce: number      // 0-100
  straightSpeed: number  // 0-100
  reliability: number    // 0-100
  tireManagement: number // 0-100
  braking: number        // 0-100
  cornering: number      // 0-100
}

export interface DepartmentHead {
  name: string
  role: 'technical-director' | 'race-engineer' | 'commercial-director' | 'team-manager'
  skill: number // 1-100
  currentFocus: string
  flaggedIssue: string | null
}

export interface RndUpgrade {
  id: string
  branch: 'chassis' | 'power-unit' | 'active-aero'
  name: string
  description: string
  progress: number    // 0-100
  status: 'locked' | 'available' | 'in-progress' | 'queued' | 'complete'
  cost: number
  developmentRaces: number // races to complete
  performanceDelta: Partial<CarPerformance>
  prerequisiteIds: string[]
}

export interface ComponentAllocation {
  element: 'ice' | 'turbo' | 'ers-battery' | 'gearbox'
  used: number
  limit: number
  failureProbability: number
}

export interface AiPersonality {
  aggressiveness: number  // 0-1
  financialDiscipline: number // 0-1
  driverFocus: number // 0-1
}

export interface Team {
  id: string
  name: string
  shortName: string
  color: string
  powerUnitSupplier: string
  driverIds: [string, string]
  reserveDriverId: string | null
  staff: DepartmentHead[]
  car: CarPerformance
  rndUpgrades: RndUpgrade[]
  components: ComponentAllocation[]
  windTunnelHoursUsed: number
  windTunnelHoursLimit: number
  cfdRunsUsed: number
  cfdRunsLimit: number
  morale: number
  aiPersonality: AiPersonality | null // null for player team
  constructorPoints: number
  constructorPosition: number
}
