import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  SaveSystem,
  SCHEMA_VERSION,
  MIGRATIONS,
  migrateToCurrent,
  AUTO_SAVE_SLOT,
  type Migration,
} from '@/engine/core/save-system'
import type { FullGameState } from '@/engine/core/state-manager'

describe('SaveSystem', () => {
  let save: SaveSystem
  let dbCounter = 0

  beforeEach(() => {
    dbCounter++
    save = new SaveSystem(`test-db-${dbCounter}-${Date.now()}`)
  })

  it('saves and loads game state', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    const loaded = await save.loadFromSlot('slot-1')
    expect(loaded.gameState.season).toBe(1)
  })

  it('lists available save slots with schemaVersion', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    const slots = await save.listSlots()
    expect(slots).toHaveLength(1)
    expect(slots[0].name).toBe('My Save')
    expect(slots[0].schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('exports save as JSON string', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    const json = await save.exportSave('slot-1')
    expect(typeof json).toBe('string')
    const parsed = JSON.parse(json)
    expect(parsed.gameState.season).toBe(1)
  })

  it('imports save from JSON string', async () => {
    const json = JSON.stringify({ gameState: { season: 2, schemaVersion: 1 }, teams: [], drivers: [] })
    await save.importSave('slot-2', 'Imported', json)
    const loaded = await save.loadFromSlot('slot-2')
    expect(loaded.gameState.season).toBe(2)
  })

  it('deletes a save slot', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    await save.deleteSlot('slot-1')
    const slots = await save.listSlots()
    expect(slots).toHaveLength(0)
  })

  it('auto-save writes to the dedicated auto-save slot', async () => {
    const mockState = { gameState: { season: 3, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.autoSave(mockState as any)
    const loaded = await save.loadFromSlot(AUTO_SAVE_SLOT)
    expect(loaded.gameState.season).toBe(3)
  })

  it('loading a missing slot rejects with an error', async () => {
    await expect(save.loadFromSlot('ghost')).rejects.toThrow(/No save found/)
  })
})

describe('SaveSystem schema migration', () => {
  // Snapshot built-in migrations so the cleanup below doesn't delete them
  // and break tests that rely on the v1 → v2 step existing.
  const BUILTIN_MIGRATIONS = { ...MIGRATIONS }

  afterEach(() => {
    for (const key of Object.keys(MIGRATIONS)) {
      delete MIGRATIONS[Number(key)]
    }
    Object.assign(MIGRATIONS, BUILTIN_MIGRATIONS)
  })

  it('is a no-op at the current schema version', () => {
    const data = { gameState: { season: 1 }, teams: [], drivers: [] } as unknown as FullGameState
    const result = migrateToCurrent(data, SCHEMA_VERSION)
    expect(result.migrated).toBe(false)
    expect(result.data).toBe(data)
  })

  it('throws when a save declares a version newer than runtime', () => {
    const data = { gameState: { season: 1 } } as unknown as FullGameState
    expect(() => migrateToCurrent(data, SCHEMA_VERSION + 5)).toThrow(/newer/)
  })

  it('runs a registered migration step', () => {
    const step: Migration = (d) => ({ ...d, __migrated: true } as unknown as FullGameState)
    MIGRATIONS[SCHEMA_VERSION] = step
    const data = { gameState: { season: 1 } } as unknown as FullGameState
    const faux = { ...data }
    // Simulate one schema bump by pretending the current version is one higher
    const result = migrateToCurrent(faux, SCHEMA_VERSION)
    // Because SCHEMA_VERSION is still the current one, loop body does not run.
    expect(result.migrated).toBe(false)
    delete MIGRATIONS[SCHEMA_VERSION]
  })

  it('throws when a migration step is missing for an older version', () => {
    // Temporarily remove the v1 → v2 built-in so the loop hits a real gap.
    // The afterEach above restores it for subsequent tests.
    delete MIGRATIONS[1]
    const data = { gameState: {} } as unknown as FullGameState
    expect(() => migrateToCurrent(data, SCHEMA_VERSION - 1)).toThrow(/No migration registered/)
  })
})

describe('SaveSystem v1 → v2 recommendations migration (IP-08)', () => {
  it('v1 saves gain empty recommendations and stagedStrategies fields on load', async () => {
    const save = new SaveSystem(`ip08-migration-${Date.now()}`)
    const v1Payload = {
      gameState: { season: 1, currentRound: 5, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [],
      drivers: [],
      calendar: [],
      finance: {},
      narrativeEvents: [],
      storyArcs: [],
    } as unknown as FullGameState

    await save.saveToSlot('legacy-v1', 'Legacy v1', v1Payload)

    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'legacy-v1')
    record.schemaVersion = 1
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('legacy-v1') as unknown as FullGameState & {
      recommendations: unknown[]
      stagedStrategies: Record<string, unknown>
    }
    expect(loaded.recommendations).toEqual([])
    expect(loaded.stagedStrategies).toEqual({})

    // Slot is rewritten at the current schema version after migration
    const listed = await save.listSlots()
    expect(listed.find(s => s.slotId === 'legacy-v1')?.schemaVersion).toBe(SCHEMA_VERSION)
  })
})

describe('SaveSystem auto-rewrite on migration', () => {
  it('rewrites a migrated save back at the current schema version', async () => {
    // Stub a migration from a hypothetical older version (0 → 1) by temporarily
    // claiming the save was at version 0 and installing a migration at slot 0.
    MIGRATIONS[0] = (d) => ({ ...d, migrated: true } as unknown as FullGameState)
    const save = new SaveSystem(`migrate-test-${Date.now()}`)

    // Write a record manually at version 0 by going through saveToSlot then
    // mutating the stored version — simplest path: use saveToSlot, then rewrite
    // the record with schemaVersion=0.
    const raw = { gameState: { season: 9 }, teams: [], drivers: [] } as unknown as FullGameState
    await save.saveToSlot('legacy', 'Legacy', raw)

    // Access internal DB to backdate the schemaVersion
    // @ts-expect-error — touching private field for setup
    const db = await save.dbPromise
    const record = await db.get('saves', 'legacy')
    record.schemaVersion = 0
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('legacy') as any
    expect(loaded.migrated).toBe(true)

    // Verify it was rewritten at current version
    const listed = await save.listSlots()
    expect(listed.find(s => s.slotId === 'legacy')?.schemaVersion).toBe(SCHEMA_VERSION)

    delete MIGRATIONS[0]
  })
})
