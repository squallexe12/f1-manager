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
  element: 'ice' | 'turbo' | 'mgu-k' | 'ers-battery' | 'gearbox'
  used: number
  limit: number
  failureProbability: number
}

/**
 * Named alias for the PU element union. `ComponentAllocation` remains the
 * single source of truth; this alias gives consumers (FailureEvent,
 * Phase 2's PendingComponentSwap, future imports) a clean named type.
 */
export type ComponentElement = ComponentAllocation['element']

/**
 * One entry in the rolling fastest-lap log used by the Factory car-performance
 * card to compute Δ vs Leader. Captures only the absolute race-wide fastest
 * lap when one of this team's drivers held it that round.
 */
export interface FastestLapEntry {
  round: number
  lapMs: number
}

/**
 * One mechanical-failure event recorded against a team during a race. The
 * trigger (`checkMechanicalFailure`) is currently defined but not yet wired
 * into the simulator — Phase 1 ships the buffer + read path so the MTBF
 * derivation can graduate to real data without a follow-up schema change.
 */
export interface FailureEvent {
  round: number
  lap: number
  element: ComponentElement
  driverId: string
}

/**
 * One queued power-unit element swap election made by the player during the
 * management phase. Drained by `applyPendingSwaps` at the management →
 * practice transition. The named driver is the one who pays the grid
 * penalty if the swap pushes the team-shared element counter past its
 * season limit (real F1 model: each car carries its own ICE history, but
 * we simplify to a team pool plus a per-driver penalty target).
 */
export interface PendingComponentSwap {
  driverId: string
  element: ComponentElement
  electedRound: number
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
  /** Factory / team headquarters city. Surfaced on the Factory page header. */
  headquarters: string
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
  /**
   * Rolling history of the team's OVR car rating, ordered oldest → newest.
   * Capped at OVR_HISTORY_WINDOW entries. Appended in `processPostRace`
   * under the same idempotency guard as `seasonForm`. Drives the 6-race
   * trend sparkline on the Factory car-performance card.
   */
  ovrHistory: number[]
  /**
   * Round number of the most recently completed R&D upgrade. 0 means "no
   * upgrade shipped yet this season". Updated by the orchestrator when
   * `processRnDCycle` flips any upgrade from `in-progress` to `complete`.
   */
  lastUpgradeRound: number
  /**
   * Rolling log of race-wide fastest laps held by this team's drivers,
   * ordered oldest → newest. Capped at 6 entries (FIFO trim on append).
   * Cleared at season end. Drives the Factory Δ-vs-Leader readout.
   */
  fastestLapHistory: FastestLapEntry[]
  /**
   * Rolling log of mechanical-failure events this season, ordered
   * oldest → newest. Capped at 10 entries (FIFO trim on append). Cleared
   * at season end. Currently unwritten (trigger lands in a later phase);
   * the read path falls back to a per-element-wear heuristic when empty.
   */
  failureEvents: FailureEvent[]
  /**
   * Running season counter of grid-penalty events incurred from elected
   * component swaps. Increments by one each time `applyPendingSwaps` drains
   * a swap whose post-increment `used > limit` (i.e., the player elected to
   * take a penalty here rather than risk a worse circuit later). Reset at
   * season end.
   */
  penaltiesTaken: number
  /**
   * Queue of player-elected component swaps awaiting the management →
   * practice transition. Each entry names the driver who will pay any
   * grid penalty. Idempotent on append (one entry per driver × element);
   * drained by `applyPendingSwaps`. Reset at season end.
   */
  pendingComponentSwaps: PendingComponentSwap[]
}
