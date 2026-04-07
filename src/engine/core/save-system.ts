import { openDB, type IDBPDatabase } from 'idb'
import type { FullGameState } from './state-manager'

const DB_NAME = 'mission-control-f1'
const DB_VERSION = 1
const STORE_SAVES = 'saves'
const STORE_META = 'meta'

const SCHEMA_VERSION = 1

interface SaveRecord {
  slotId: string
  name: string
  timestamp: number
  schemaVersion: number
  data: FullGameState
}

interface SlotInfo {
  slotId: string
  name: string
  timestamp: number
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
    return record.data
  }

  async listSlots(): Promise<SlotInfo[]> {
    const db = await this.dbPromise
    const records: SaveRecord[] = await db.getAll(STORE_SAVES)
    return records.map(r => ({
      slotId: r.slotId,
      name: r.name,
      timestamp: r.timestamp,
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
    await this.saveToSlot('auto-save', 'Auto Save', state)
  }
}
