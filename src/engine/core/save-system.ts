import { openDB, type IDBPDatabase } from 'idb'
import type { FullGameState } from './state-manager'
import type { ComponentAllocation } from '@/types/team'
import {
  DEFAULT_WT_HOURS_PER_CYCLE,
  DEFAULT_CFD_RUNS_PER_CYCLE,
} from '@/data/rnd-tree'
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
import { computeChampionshipSummary } from '@/engine/drivers/championship-summary'

const DB_NAME = 'mission-control-f1'
const DB_VERSION = 1
const STORE_SAVES = 'saves'
const STORE_META = 'meta'

export const SCHEMA_VERSION = 14
export const AUTO_SAVE_SLOT = 'auto-save'

export interface SaveRecord {
  slotId: string
  name: string
  timestamp: number
  schemaVersion: number
  data: FullGameState
}

export interface SlotInfo {
  slotId: string
  name: string
  timestamp: number
  schemaVersion: number
}

/**
 * Migration map. Each entry upgrades a save written at version `from` to
 * version `from + 1`. Migrations must be pure and idempotent.
 *
 * v1 → v2 (IP-08): adds `recommendations` and `stagedStrategies` as empty
 * collections. Both are repopulated on the next management-phase entry via
 * `processManagementEntry()`, so a legacy save remains playable with no
 * observable data loss.
 *
 * v2 → v3 (Paddock hero redesign): hydrates rolling form + trend snapshots
 * that power the new Paddock surfaces. Defaults are empty/zero so existing
 * saves render the hero panels with blank series on first load, then refill
 * after the next post-race processing pass.
 *   - `team.previousConstructorPosition` ← 0
 *   - `team.previousMorale`              ← team.morale
 *   - `team.seasonForm`                  ← []
 *   - `team.staff[*].contractEndSeason`  ← gameState.season + 3 (mid-band)
 *   - `driver.form`                      ← []
 *   - `driver.lastRaceResult`            ← null
 *   - `driver.seasonStats.poles`         ← 0
 *
 * v4 → v5 (Factory redesign — Phase B Wave 2): Adds `team.headquarters` as a
 * surfaced-on-UI field. Existing saves back-fill from the TEAM_HEADQUARTERS
 * map below; unknown team ids fall back to the team's `shortName`.
 *
 * v5 → v6 (Factory redesign — Phase B Wave 3): Adds `team.ovrHistory: []`
 * and `team.lastUpgradeRound: 0`. Both start empty/zero; the post-race
 * processor appends to `ovrHistory` on each round, and the orchestrator
 * stamps `lastUpgradeRound` when any R&D upgrade flips to `complete`.
 * Trend sparkline renders blank until at least two post-race writes land.
 *
 * v6 → v7 (Factory redesign — Phase B Wave 4): Expands the 4-element
 * power-unit allocation to a 5-element one by inserting an `mgu-k` row
 * into every `team.components` array when missing. Insertion order
 * (ICE → TURBO → MGU-K → ERS BATTERY → GEARBOX) matches the Factory card
 * layout. Any legacy `mgu-h` row from pre-release v7 dev saves is
 * dropped (MGU-H was removed for the 2026 regulation — see CLAUDE.md §7).
 * Existing rows in the canonical set are preserved verbatim; a save
 * that already carries all five rows is a no-op.
 *
 * v8 → v9 (Factory Box 1 — Car Performance real data): Adds
 * `team.fastestLapHistory: []` and `team.failureEvents: []`. Both start
 * empty; post-race processing appends to `fastestLapHistory` for the team
 * whose driver held the absolute race-wide fastest lap. `failureEvents`
 * trigger lands in a later phase. Both buffers are FIFO-capped (6 / 10
 * respectively) and cleared at season end.
 *
 * v9 → v10 (Factory Box 2 — Power Unit strategy): Adds
 * `team.penaltiesTaken: 0` and `team.pendingComponentSwaps: []` for the
 * new pre-weekend swap-election decision. `penaltiesTaken` increments
 * when a player-elected swap pushes a team-shared element counter past
 * its season limit; the named driver in the queued swap pays the grid
 * penalty via the existing Tier A `driver.nextRaceGridDrop` channel.
 * Both fields reset at season end.
 */
/**
 * Back-fill map for `team.headquarters` when migrating a save from v4 → v5.
 * Mirrors `src/data/teams.ts`; kept local here so `save-system.ts` stays the
 * single source of truth for every migration step (no external data deps).
 */
const TEAM_HEADQUARTERS: Record<string, string> = {
  mclaren: 'Woking',
  'red-bull': 'Milton Keynes',
  ferrari: 'Maranello',
  mercedes: 'Brackley',
  'aston-martin': 'Silverstone',
  williams: 'Grove',
  'racing-bulls': 'Faenza',
  alpine: 'Enstone',
  haas: 'Kannapolis',
  audi: 'Hinwil',
  cadillac: 'Charlotte',
}

/**
 * Canonical ordering of the 5-element PU allocation, used by the v6 → v7
 * migration. Matches the Factory card row order so a visual diff before
 * and after migration looks identical except for the newly-added MGU-K
 * row. Note: MGU-H was intentionally excluded — the 2026 F1 regulation
 * removed it (see `CLAUDE.md` §7) and the Factory card now renders five
 * rows, not six.
 */
const PU_ELEMENT_ORDER: ComponentAllocation['element'][] = [
  'ice',
  'turbo',
  'mgu-k',
  'ers-battery',
  'gearbox',
]

/**
 * Default row for an element freshly introduced by migration. `limit` of 4
 * matches FIA 2026 allocation for MGU-K. The engine is element-agnostic on
 * limits, so this default is safe for any non-battery element.
 */
function defaultComponentRow(element: ComponentAllocation['element']): ComponentAllocation {
  return { element, used: 0, limit: 4, failureProbability: 0.03 }
}

/**
 * Normalise every team's components array to the canonical 5-element PU
 * layout. Preserves every existing row verbatim when the element is in
 * the canonical set; back-fills missing ones with `defaultComponentRow`;
 * drops any element not in the canonical set (e.g. a legacy `mgu-h` row
 * from an in-development v7 save that never shipped).
 */
function ensureCanonicalElements(components: ComponentAllocation[]): ComponentAllocation[] {
  const byElement = new Map<ComponentAllocation['element'], ComponentAllocation>()
  for (const c of components) byElement.set(c.element, c)
  return PU_ELEMENT_ORDER.map((el) => byElement.get(el) ?? defaultComponentRow(el))
}

export type Migration = (data: FullGameState) => FullGameState
export const MIGRATIONS: Record<number, Migration> = {
  1: (data) => ({
    ...data,
    recommendations: [],
    stagedStrategies: {},
  }),
  2: (data) => {
    const fallbackContractSeason = (data.gameState?.season ?? 1) + 3
    return {
      ...data,
      teams: data.teams.map(team => ({
        ...team,
        previousConstructorPosition: team.previousConstructorPosition ?? 0,
        previousMorale: team.previousMorale ?? team.morale,
        seasonForm: team.seasonForm ?? [],
        staff: team.staff.map(head => ({
          ...head,
          contractEndSeason: head.contractEndSeason ?? fallbackContractSeason,
        })),
      })),
      drivers: data.drivers.map(driver => ({
        ...driver,
        form: driver.form ?? [],
        lastRaceResult: driver.lastRaceResult ?? null,
        seasonStats: {
          ...driver.seasonStats,
          poles: driver.seasonStats.poles ?? 0,
        },
      })),
    }
  },
  /**
   * v3 → v4 (Paddock stats double-count repair): Adds `lastProcessedRound`
   * idempotency markers to every driver and team. Also repairs corrupted
   * season stats on saves written before the guard existed: detects any
   * driver whose podium/win/dnf count exceeds the natural per-round
   * ceiling and resets their season counters to zero so the running-total
   * picks up cleanly from the next race. Points are recomputed as the
   * minimum of the stored value and the theoretical ceiling for the
   * rounds completed so far.
   */
  /**
   * v4 → v5 (Factory redesign — Phase B Wave 2): Adds `team.headquarters` as
   * a surfaced-on-UI field. Existing saves back-fill from the canonical
   * 2026 grid mapping below; unknown team ids fall back to the team's
   * `shortName` so the property is always a non-empty string.
   */
  4: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      headquarters: team.headquarters ?? TEAM_HEADQUARTERS[team.id] ?? team.shortName,
    })),
  }),
  /**
   * v5 → v6 (Factory redesign — Phase B Wave 3): Adds rolling history +
   * last-upgrade marker on every team. Defaults are empty/zero so the
   * Factory sparkline and "Last Upgrade" readout render blank on the first
   * post-migration load — both repopulate naturally as subsequent rounds
   * and R&D completions land.
   */
  5: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      ovrHistory: team.ovrHistory ?? [],
      lastUpgradeRound: team.lastUpgradeRound ?? 0,
    })),
  }),
  /**
   * v6 → v7 (Factory redesign — Phase B Wave 4): Inserts an `mgu-k` row
   * into each team's components array. Existing rows in the canonical
   * set keep their usage/limit/failureProbability values; the new row
   * starts fresh at 0/4 with a modest failure probability. Any legacy
   * `mgu-h` row is dropped (MGU-H is not part of the 2026 PU). Order is
   * normalised to ICE → TURBO → MGU-K → ERS BATTERY → GEARBOX to match
   * the Factory card layout.
   */
  6: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      components: ensureCanonicalElements(team.components ?? []),
    })),
  }),
  /**
   * v7 → v8 (IP-09 Penalty System Tier A): Adds the four persisted driver
   * fields used by the in-race penalty engine. All defaults are "blank
   * career" — no penalty points, no season warnings, no pending grid
   * drop, not banned. Existing fields are preserved verbatim.
   */
  7: (data) => ({
    ...data,
    drivers: data.drivers.map((d) => ({
      ...d,
      penaltyPoints: d.penaltyPoints ?? [],
      warningsThisSeason: d.warningsThisSeason ?? 0,
      nextRaceGridDrop: d.nextRaceGridDrop ?? 0,
      banUntilRound: d.banUntilRound ?? null,
    })),
  }),
  /**
   * v8 → v9 (Factory Box 1 — Car Performance real data): Adds two rolling
   * buffers to every team. `fastestLapHistory` (capped at 6) drives the
   * Δ-vs-Leader readout once a team has held a race-wide fastest lap;
   * `failureEvents` (capped at 10) is reserved for a future phase that
   * wires `checkMechanicalFailure` into the simulator. Both buffers are
   * cleared at season end. Defaults are `[]` so legacy saves render with
   * the heuristic fallback until enough rounds populate the lap log.
   */
  8: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      fastestLapHistory: team.fastestLapHistory ?? [],
      failureEvents: team.failureEvents ?? [],
    })),
  }),
  /**
   * v9 → v10 (Factory Box 2 — Power Unit strategy): Adds two persisted
   * team fields. `penaltiesTaken` is a running season counter; defaults
   * to 0. `pendingComponentSwaps` is the player-elected swap queue;
   * defaults to []. Existing values are preserved verbatim.
   */
  9: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      penaltiesTaken: team.penaltiesTaken ?? 0,
      pendingComponentSwaps: team.pendingComponentSwaps ?? [],
    })),
  }),
  /**
   * v10 → v11 (Factory Box 3 — Aero Testing real data): Adds two
   * persisted team buffers and back-fills WT/CFD per-cycle costs onto
   * existing R&D upgrades. `aeroBookings` (cap 14) is the per-day CDT
   * window booking ledger; `upgradeOutcomes` (cap 3) is the rolling
   * predicted-vs-actual upgrade outcome buffer. Both default to []. The
   * `wtHoursPerCycle` / `cfdRunsPerCycle` fields are static-data props on
   * `RndUpgrade` that pre-Phase-3 saves did not have; legacy upgrades on
   * disk get conservative defaults so existing in-progress upgrades do
   * not accidentally exceed the team's CDT budget on first load.
   */
  10: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      aeroBookings: team.aeroBookings ?? [],
      upgradeOutcomes: team.upgradeOutcomes ?? [],
      rndUpgrades: (team.rndUpgrades ?? []).map((u) => ({
        ...u,
        wtHoursPerCycle: u.wtHoursPerCycle ?? DEFAULT_WT_HOURS_PER_CYCLE,
        cfdRunsPerCycle: u.cfdRunsPerCycle ?? DEFAULT_CFD_RUNS_PER_CYCLE,
      })),
    })),
  }),
  /**
   * v11 → v12 (Tier B v2 — pit-crew staff schema): Adds the four persisted
   * staff fields to support Tier B's active-investment system. All defaults
   * are "no staff hired" — `pitCrewChief: null`, empty member roster, empty
   * staff market (regenerated by `generateTalentPool` on next session start
   * if the orchestrator detects an empty market), no open poaching attempts.
   * IP-B2 ships the schema; IP-B3 wires `aggregateCrewRatings` into the
   * race-simulator engine reads, so legacy saves run with the existing
   * neutral 70/70/70 behaviour until the player hires staff.
   */
  11: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      pitCrewChief: team.pitCrewChief ?? null,
      pitCrewMembers: team.pitCrewMembers ?? [],
    })),
    staffMarket: data.staffMarket ?? { chiefs: [], members: [], lastRefreshedSeason: 0 },
    poachingAttempts: data.poachingAttempts ?? [],
  }),
  /**
   * v12 → v13 (IP-09a Drivers redesign): Adds career stats (`careerWins`,
   * `careerPodiums`, `careerStarts`, `worldTitles`), narrative `pulse`,
   * `portraitUrl`, `scoutSignal`, and `scoutingReports` on every driver.
   * All counters default to 0 (existing saves do not retroactively get
   * real-world numbers — only fresh games seeded via `data/drivers.ts`).
   * After defaulting, runs `derivePulse` and `computeScoutSignal` so
   * loaded saves render correctly without waiting for the next
   * post-race tick. See spec §3.4.
   */
  12: (data) => {
    // Hydrate drivers with defaults first, including safe fallbacks for
    // older fixture fields that may be absent in pre-v8 saves that are
    // migrating all the way up to v13 in a single chain run.
    const drivers = data.drivers.map((d: any) => ({
      ...d,
      // Safe fallbacks for fields that earlier migrations may not have
      // ensured are present (e.g. form was added in v2→v3, penaltyPoints
      // in v7→v8, attributes always present but guard for test fixtures).
      attributes: d.attributes ?? { pace: 70, racecraft: 70, experience: 50, mentality: 70, marketability: 50, developmentPotential: 50 },
      form: d.form ?? [],
      penaltyPoints: d.penaltyPoints ?? [],
      seasonStats: d.seasonStats ?? { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
      mood: d.mood ?? { motivation: 70, frustration: 30, confidence: 70 },
      // New IP-09a fields
      careerWins: 0,
      careerPodiums: 0,
      careerStarts: 0,
      worldTitles: 0,
      pulse: { headline: '', detail: '' },
      portraitUrl: null,
      scoutSignal: 'available' as const,
      scoutingReports: 0,
    }))
    // Compute championship summary so pulse can branch on position/gap.
    // drivers is typed as any[] at this point (pre-migration fixture shape),
    // but computeChampionshipSummary only reads .isReserve / .teamId /
    // .seasonStats.points — all of which were present before v13.
    const championship = computeChampionshipSummary(drivers as Parameters<typeof computeChampionshipSummary>[0])
    const ctx: PulseContext = {
      championshipPositionByDriverId: championship.positionById,
      championshipGapByDriverId: championship.gapById,
      totalDriversInChampionship: drivers.length,
      currentRound: data.gameState?.currentRound ?? 1,
      currentSeason: data.gameState?.season ?? 1,
    }
    return {
      ...data,
      drivers: drivers.map((d: any) => ({
        ...d,
        pulse: derivePulse(d, ctx),
        scoutSignal: computeScoutSignal(d),
      })),
    }
  },
  /**
   * v13 → v14 (Sponsorship KPI cash banking): Adds `finance[*].bankedBonuses`
   * (career-cumulative banked bonus cash, default 0) and a per-sponsor
   * `bonusPaidSeason` latch (default null) that gates banking to once per
   * season per sponsor. Legacy saves start with an empty ledger / no latch and
   * accrue from the next post-race bonus that fires. Existing values preserved
   * verbatim. Pure and idempotent.
   */
  13: (data) => ({
    ...data,
    finance: Object.fromEntries(
      Object.entries(data.finance ?? {}).map(([teamId, fs]) => [
        teamId,
        {
          ...fs,
          bankedBonuses: fs.bankedBonuses ?? 0,
          sponsors: (fs.sponsors ?? []).map((s) => ({
            ...s,
            bonusPaidSeason: s.bonusPaidSeason ?? null,
          })),
        },
      ]),
    ),
  }),
  3: (data) => {
    const currentRound = Math.max(0, (data.gameState?.currentRound ?? 1) - 1)
    // Modern F1: P1=25 + FL bonus 1, P2=18. Team max per race = 44.
    const maxPointsPerRoundPerDriver = 26
    const maxPointsPerRoundPerTeam = 44

    const repairedDrivers = data.drivers.map(driver => {
      const s = driver.seasonStats
      const corrupted =
        (s.podiums ?? 0) > currentRound ||
        (s.wins ?? 0) > currentRound ||
        (s.points ?? 0) > currentRound * maxPointsPerRoundPerDriver
      const safeStats = corrupted
        ? {
          points: 0, wins: 0, podiums: 0, poles: s.poles ?? 0,
          dnfs: 0, penalties: s.penalties ?? 0,
          bestFinish: 0, averageFinish: 0,
          lastProcessedRound: 0,
        }
        : {
          ...s,
          poles: s.poles ?? 0,
          lastProcessedRound: s.lastProcessedRound ?? 0,
        }
      return { ...driver, seasonStats: safeStats }
    })

    const repairedTeams = data.teams.map(team => {
      const teamDrivers = repairedDrivers.filter(d =>
        d.teamId === team.id && !d.isReserve && !d.isF2,
      )
      const recomputedPoints = teamDrivers.reduce((sum, d) => sum + d.seasonStats.points, 0)
      const corrupted = (team.constructorPoints ?? 0) > currentRound * maxPointsPerRoundPerTeam
      return {
        ...team,
        constructorPoints: corrupted ? recomputedPoints : team.constructorPoints,
        seasonForm: corrupted ? [] : team.seasonForm,
        previousConstructorPosition: corrupted ? 0 : team.previousConstructorPosition,
        lastProcessedRound: team.lastProcessedRound ?? 0,
      }
    })

    return { ...data, drivers: repairedDrivers, teams: repairedTeams }
  },
}

/**
 * Applies every registered migration from `fromVersion` up to `SCHEMA_VERSION`
 * in order. Throws if a save declares a version newer than the runtime knows
 * about — callers can surface this to the UI as an unsupported save.
 */
export function migrateToCurrent(
  data: FullGameState,
  fromVersion: number,
): { data: FullGameState; migrated: boolean } {
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(
      `Save schema version ${fromVersion} is newer than runtime version ${SCHEMA_VERSION}`,
    )
  }
  let migrated = false
  let current = data
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) {
      throw new Error(`No migration registered from schema version ${v} to ${v + 1}`)
    }
    current = step(current)
    migrated = true
  }
  return { data: current, migrated }
}

export class SaveSystem {
  private dbPromise: Promise<IDBPDatabase>

  constructor(dbName: string = DB_NAME) {
    this.dbPromise = openDB(dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SAVES)) {
          db.createObjectStore(STORE_SAVES, { keyPath: 'slotId' })
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' })
        }
      },
    })
  }

  async saveToSlot(slotId: string, name: string, state: FullGameState): Promise<void> {
    const db = await this.dbPromise
    const record: SaveRecord = {
      slotId,
      name,
      timestamp: Date.now(),
      schemaVersion: SCHEMA_VERSION,
      data: state,
    }
    await db.put(STORE_SAVES, record)
  }

  async loadFromSlot(slotId: string): Promise<FullGameState> {
    const db = await this.dbPromise
    const record: SaveRecord | undefined = await db.get(STORE_SAVES, slotId)
    if (!record) {
      throw new Error(`No save found in slot: ${slotId}`)
    }
    const version = record.schemaVersion ?? 1
    const { data, migrated } = migrateToCurrent(record.data, version)
    if (migrated) {
      await this.saveToSlot(slotId, record.name, data)
    }
    return data
  }

  async listSlots(): Promise<SlotInfo[]> {
    const db = await this.dbPromise
    const records: SaveRecord[] = await db.getAll(STORE_SAVES)
    return records.map(r => ({
      slotId: r.slotId,
      name: r.name,
      timestamp: r.timestamp,
      schemaVersion: r.schemaVersion ?? 1,
    }))
  }

  async deleteSlot(slotId: string): Promise<void> {
    const db = await this.dbPromise
    await db.delete(STORE_SAVES, slotId)
  }

  async exportSave(slotId: string): Promise<string> {
    const db = await this.dbPromise
    const record: SaveRecord | undefined = await db.get(STORE_SAVES, slotId)
    if (!record) {
      throw new Error(`No save found in slot: ${slotId}`)
    }
    return JSON.stringify(record.data)
  }

  async importSave(slotId: string, name: string, json: string): Promise<void> {
    const data = JSON.parse(json) as FullGameState
    await this.saveToSlot(slotId, name, data)
  }

  async autoSave(state: FullGameState): Promise<void> {
    await this.saveToSlot(AUTO_SAVE_SLOT, 'Auto Save', state)
  }
}
