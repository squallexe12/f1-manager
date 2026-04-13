import { openDB, type IDBPDatabase } from 'idb'
import type { FullGameState } from './state-manager'

const DB_NAME = 'mission-control-f1'
const DB_VERSION = 1
const STORE_SAVES = 'saves'
const STORE_META = 'meta'

export const SCHEMA_VERSION = 1
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
 * version `from + 1`. The map is empty for v1 because IP-04 chose Option A
 * (race runtime slice lives outside `world`), so no schema change was needed.
 *
 * Future shape bumps append an entry here. Migrations must be pure and idempotent.
 */
export type Migration = (data: FullGameState) => FullGameState
export const MIGRATIONS: Record<number, Migration> = {}

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
