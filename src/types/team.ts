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
  /** Absolute season number at which the department head's contract expires. */
  contractEndSeason: number
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
  /**
   * Constructor position recorded before the most recent post-race update.
   * Used to render the ▲/▼ trend indicator on the Paddock hero. Initialized
   * to 0 (meaning "no prior round"); first update snapshots the pre-result
   * position so the indicator is meaningful from R02 onward.
   */
  previousConstructorPosition: number
  /**
   * Morale value captured before the most recent post-race morale pass, used
   * to render the weekly morale trend. Initialized to the team's starting
   * morale so the first-round delta is zero rather than undefined.
   */
  previousMorale: number
  /**
   * Rolling history of constructor positions for the most recent rounds of
   * the current season, ordered oldest → newest. Capped at FORM_WINDOW
   * entries (see `src/engine/drivers/form-history.ts`). Drives the
   * constructor-form sparkline on the Paddock hero.
   */
  seasonForm: number[]
  /**
   * Last race round number whose standings were folded into `seasonForm`
   * and the trend snapshots. Mirrors `SeasonStats.lastProcessedRound` and
   * serves the same idempotency purpose for team-level post-race writes.
   */
  lastProcessedRound: number
}
