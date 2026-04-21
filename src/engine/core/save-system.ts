import { openDB, type IDBPDatabase } from 'idb'
import type { FullGameState } from './state-manager'

const DB_NAME = 'mission-control-f1'
const DB_VERSION = 1
const STORE_SAVES = 'saves'
const STORE_META = 'meta'

export const SCHEMA_VERSION = 4
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
 */
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
