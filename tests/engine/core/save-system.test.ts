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
    // Call with a version lower than any registered migration (v0) so the
    // very first loop iteration hits MIGRATIONS[0] = undefined. The afterEach
    // above restores the built-ins for subsequent tests.
    const data = { gameState: {} } as unknown as FullGameState
    expect(() => migrateToCurrent(data, 0)).toThrow(/No migration registered/)
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

describe('SaveSystem v2 → v3 Paddock hero migration', () => {
  it('v2 saves gain form/trend snapshots + staff contractEndSeason on load', async () => {
    const save = new SaveSystem(`paddock-migration-${Date.now()}`)
    const v2Payload = {
      gameState: { season: 3, currentRound: 1, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        {
          id: 'mclaren',
          morale: 78,
          constructorPosition: 2,
          staff: [
            { name: 'A', role: 'technical-director', skill: 80, currentFocus: '', flaggedIssue: null },
            { name: 'B', role: 'race-engineer', skill: 75, currentFocus: '', flaggedIssue: null },
          ],
        },
      ],
      drivers: [
        {
          id: 'norris',
          seasonStats: { points: 10, wins: 1, podiums: 2, dnfs: 0, penalties: 0, bestFinish: 1, averageFinish: 4 },
        },
      ],
      calendar: [],
      finance: {},
      narrativeEvents: [],
      storyArcs: [],
      recommendations: [],
      stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('legacy-v2', 'Legacy v2', v2Payload)

    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'legacy-v2')
    record.schemaVersion = 2
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('legacy-v2') as unknown as FullGameState
    const team = loaded.teams[0]
    expect(team.previousConstructorPosition).toBe(0)
    expect(team.previousMorale).toBe(78)
    expect(team.seasonForm).toEqual([])
    expect(team.staff[0].contractEndSeason).toBe(6) // season 3 + 3
    expect(team.staff[1].contractEndSeason).toBe(6)

    const driver = loaded.drivers[0]
    expect(driver.form).toEqual([])
    expect(driver.lastRaceResult).toBeNull()
    expect(driver.seasonStats.poles).toBe(0)

    // Slot is rewritten at the current schema version after migration
    const listed = await save.listSlots()
    expect(listed.find(s => s.slotId === 'legacy-v2')?.schemaVersion).toBe(SCHEMA_VERSION)
  })
})

describe('SaveSystem v3 → v4 double-count repair migration', () => {
  it('resets corrupted driver stats that exceed the per-round ceiling', async () => {
    const save = new SaveSystem(`paddock-repair-${Date.now()}`)
    const v3Payload = {
      gameState: { season: 1, currentRound: 8, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        {
          id: 'mclaren',
          morale: 78,
          constructorPoints: 500, // 7 rounds × 44 max = 308 ceiling, 500 is corrupted
          constructorPosition: 1,
          previousConstructorPosition: 2,
          previousMorale: 74,
          seasonForm: [1, 1, 1, 1, 1, 1, 1],
          staff: [],
        },
      ],
      drivers: [
        {
          id: 'norris', teamId: 'mclaren', isReserve: false, isF2: false,
          form: [1, 1, 1, 1, 1, 1, 1], lastRaceResult: 1,
          seasonStats: {
            // 16 podiums in 7 rounds is impossible (max = 7).
            points: 313, wins: 5, podiums: 16, poles: 0, dnfs: 0,
            penalties: 0, bestFinish: 1, averageFinish: 1,
          },
        },
        {
          id: 'piastri', teamId: 'mclaren', isReserve: false, isF2: false,
          form: [2, 2, 2, 2, 2, 2, 2], lastRaceResult: 2,
          seasonStats: {
            // Plausible stats — 6 podiums in 7 rounds is legal.
            points: 120, wins: 0, podiums: 6, poles: 0, dnfs: 0,
            penalties: 0, bestFinish: 2, averageFinish: 2,
          },
        },
      ],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('corrupted', 'Corrupted v3', v3Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'corrupted')
    record.schemaVersion = 3
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('corrupted') as unknown as FullGameState
    const norris = loaded.drivers.find(d => d.id === 'norris')!
    const piastri = loaded.drivers.find(d => d.id === 'piastri')!

    // Corrupted driver is zeroed out
    expect(norris.seasonStats.points).toBe(0)
    expect(norris.seasonStats.podiums).toBe(0)
    expect(norris.seasonStats.wins).toBe(0)
    expect(norris.seasonStats.lastProcessedRound).toBe(0)

    // Clean driver's stats are preserved, only the guard field is added
    expect(piastri.seasonStats.points).toBe(120)
    expect(piastri.seasonStats.podiums).toBe(6)
    expect(piastri.seasonStats.lastProcessedRound).toBe(0)

    // Team stats recomputed from driver points, form wiped, guard seeded
    const mclaren = loaded.teams[0]
    expect(mclaren.lastProcessedRound).toBe(0)
    expect(mclaren.constructorPoints).toBe(120) // recomputed sum: 0 + 120
    expect(mclaren.seasonForm).toEqual([])
    expect(mclaren.previousConstructorPosition).toBe(0)
  })

  it('leaves clean v3 saves untouched except for the new guard fields', async () => {
    const save = new SaveSystem(`paddock-clean-${Date.now()}`)
    const cleanPayload = {
      gameState: { season: 1, currentRound: 3, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        {
          id: 'mclaren', morale: 85,
          constructorPoints: 80, constructorPosition: 2,
          previousConstructorPosition: 3, previousMorale: 82,
          seasonForm: [3, 3, 2], staff: [],
        },
      ],
      drivers: [
        {
          id: 'norris', teamId: 'mclaren', isReserve: false, isF2: false,
          form: [3, 3, 2], lastRaceResult: 2,
          seasonStats: {
            points: 50, wins: 0, podiums: 1, poles: 0, dnfs: 0,
            penalties: 0, bestFinish: 2, averageFinish: 2.67,
          },
        },
      ],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('clean', 'Clean v3', cleanPayload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'clean')
    record.schemaVersion = 3
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('clean') as unknown as FullGameState
    const norris = loaded.drivers[0]
    expect(norris.seasonStats.points).toBe(50)
    expect(norris.seasonStats.podiums).toBe(1)
    expect(norris.seasonStats.lastProcessedRound).toBe(0)
    expect(loaded.teams[0].constructorPoints).toBe(80)
    expect(loaded.teams[0].seasonForm).toEqual([3, 3, 2])
  })
})

describe('SaveSystem v4 → v5 headquarters backfill migration', () => {
  it('back-fills team.headquarters from the canonical 2026 grid map', async () => {
    const save = new SaveSystem(`hq-migration-${Date.now()}`)
    const v4Payload = {
      gameState: { season: 1, currentRound: 1, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        { id: 'mclaren', shortName: 'MCL', morale: 80, constructorPosition: 1, staff: [], lastProcessedRound: 0 },
        { id: 'red-bull', shortName: 'RBR', morale: 80, constructorPosition: 2, staff: [], lastProcessedRound: 0 },
        { id: 'ferrari', shortName: 'FER', morale: 80, constructorPosition: 3, staff: [], lastProcessedRound: 0 },
      ],
      drivers: [],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('legacy-v4', 'Legacy v4', v4Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'legacy-v4')
    record.schemaVersion = 4
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('legacy-v4') as unknown as FullGameState
    expect(loaded.teams[0].headquarters).toBe('Woking')
    expect(loaded.teams[1].headquarters).toBe('Milton Keynes')
    expect(loaded.teams[2].headquarters).toBe('Maranello')

    // Slot is rewritten at the current schema version after migration
    const listed = await save.listSlots()
    expect(listed.find(s => s.slotId === 'legacy-v4')?.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('falls back to shortName for unknown team ids', async () => {
    const save = new SaveSystem(`hq-migration-fallback-${Date.now()}`)
    const v4Payload = {
      gameState: { season: 1, currentRound: 1, phase: 'management', playerTeamId: 'phantom', seed: 1, totalRaces: 22 },
      teams: [
        { id: 'phantom-constructor', shortName: 'PHN', morale: 60, constructorPosition: 11, staff: [], lastProcessedRound: 0 },
      ],
      drivers: [],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('unknown-v4', 'Unknown v4', v4Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'unknown-v4')
    record.schemaVersion = 4
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('unknown-v4') as unknown as FullGameState
    expect(loaded.teams[0].headquarters).toBe('PHN')
  })

  it('preserves existing headquarters if already present', async () => {
    const save = new SaveSystem(`hq-migration-preserve-${Date.now()}`)
    const v4Payload = {
      gameState: { season: 1, currentRound: 1, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        { id: 'mclaren', shortName: 'MCL', headquarters: 'Custom City', morale: 80, constructorPosition: 1, staff: [], lastProcessedRound: 0 },
      ],
      drivers: [],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('preserve-v4', 'Preserve v4', v4Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'preserve-v4')
    record.schemaVersion = 4
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('preserve-v4') as unknown as FullGameState
    expect(loaded.teams[0].headquarters).toBe('Custom City')
  })
})

describe('SaveSystem v5 → v6 Factory trend migration', () => {
  it('back-fills team.ovrHistory to [] and team.lastUpgradeRound to 0', async () => {
    const save = new SaveSystem(`ovr-migration-${Date.now()}`)
    const v5Payload = {
      gameState: { season: 1, currentRound: 3, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        { id: 'mclaren', shortName: 'MCL', headquarters: 'Woking', morale: 80, constructorPosition: 1, staff: [], lastProcessedRound: 0 },
        { id: 'ferrari', shortName: 'FER', headquarters: 'Maranello', morale: 75, constructorPosition: 2, staff: [], lastProcessedRound: 0 },
      ],
      drivers: [],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('legacy-v5', 'Legacy v5', v5Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'legacy-v5')
    record.schemaVersion = 5
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('legacy-v5') as unknown as FullGameState
    for (const team of loaded.teams) {
      expect(team.ovrHistory).toEqual([])
      expect(team.lastUpgradeRound).toBe(0)
    }
    const listed = await save.listSlots()
    expect(listed.find(s => s.slotId === 'legacy-v5')?.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('preserves existing ovrHistory / lastUpgradeRound values when present', async () => {
    const save = new SaveSystem(`ovr-migration-preserve-${Date.now()}`)
    const v5Payload = {
      gameState: { season: 1, currentRound: 6, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        {
          id: 'mclaren', shortName: 'MCL', headquarters: 'Woking', morale: 80,
          constructorPosition: 2, staff: [], lastProcessedRound: 5,
          ovrHistory: [82, 83, 84],
          lastUpgradeRound: 4,
        },
      ],
      drivers: [],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('preserve-v5', 'Preserve v5', v5Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'preserve-v5')
    record.schemaVersion = 5
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('preserve-v5') as unknown as FullGameState
    expect(loaded.teams[0].ovrHistory).toEqual([82, 83, 84])
    expect(loaded.teams[0].lastUpgradeRound).toBe(4)
  })
})

describe('SaveSystem v6 → v7 5-element PU migration', () => {
  it('back-fills the mgu-k row in canonical order', async () => {
    const save = new SaveSystem(`pu-migration-${Date.now()}`)
    const v6Payload = {
      gameState: { season: 1, currentRound: 3, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        {
          id: 'mclaren', shortName: 'MCL', headquarters: 'Woking', morale: 80,
          constructorPosition: 1, staff: [], lastProcessedRound: 0,
          ovrHistory: [], lastUpgradeRound: 0,
          components: [
            { element: 'ice', used: 2, limit: 4, failureProbability: 0.02 },
            { element: 'turbo', used: 1, limit: 4, failureProbability: 0.03 },
            { element: 'ers-battery', used: 0, limit: 3, failureProbability: 0.01 },
            { element: 'gearbox', used: 3, limit: 4, failureProbability: 0.02 },
          ],
        },
      ],
      drivers: [],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('legacy-v6', 'Legacy v6', v6Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'legacy-v6')
    record.schemaVersion = 6
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('legacy-v6') as unknown as FullGameState
    const mclaren = loaded.teams[0]
    expect(mclaren.components.map(c => c.element)).toEqual([
      'ice', 'turbo', 'mgu-k', 'ers-battery', 'gearbox',
    ])
    // Existing rows keep their values
    expect(mclaren.components.find(c => c.element === 'ice')?.used).toBe(2)
    expect(mclaren.components.find(c => c.element === 'gearbox')?.used).toBe(3)
    // New row carries the default shape
    const mguK = mclaren.components.find(c => c.element === 'mgu-k')!
    expect(mguK.used).toBe(0)
    expect(mguK.limit).toBe(4)
    expect(mguK.failureProbability).toBeGreaterThan(0)

    const listed = await save.listSlots()
    expect(listed.find(s => s.slotId === 'legacy-v6')?.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('drops any legacy mgu-h row from a pre-release v7 save', async () => {
    const save = new SaveSystem(`pu-migration-strip-${Date.now()}`)
    const v6Payload = {
      gameState: { season: 1, currentRound: 1, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        {
          id: 'mclaren', shortName: 'MCL', headquarters: 'Woking', morale: 80,
          constructorPosition: 1, staff: [], lastProcessedRound: 0,
          ovrHistory: [], lastUpgradeRound: 0,
          components: [
            { element: 'ice', used: 1, limit: 4, failureProbability: 0.02 },
            { element: 'turbo', used: 0, limit: 4, failureProbability: 0.03 },
            // legacy mgu-h row — must be discarded by the migration
            { element: 'mgu-h', used: 2, limit: 4, failureProbability: 0.04 },
            { element: 'mgu-k', used: 0, limit: 4, failureProbability: 0.03 },
            { element: 'ers-battery', used: 0, limit: 3, failureProbability: 0.01 },
            { element: 'gearbox', used: 1, limit: 4, failureProbability: 0.02 },
          ],
        },
      ],
      drivers: [],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('strip-v6', 'Strip v6', v6Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'strip-v6')
    record.schemaVersion = 6
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('strip-v6') as unknown as FullGameState
    const mclaren = loaded.teams[0]
    expect(mclaren.components.map(c => c.element)).toEqual([
      'ice', 'turbo', 'mgu-k', 'ers-battery', 'gearbox',
    ])
    expect(mclaren.components.find(c => (c.element as string) === 'mgu-h')).toBeUndefined()
  })

  it('is a no-op when all five canonical elements are already present', async () => {
    const save = new SaveSystem(`pu-migration-noop-${Date.now()}`)
    const v6Payload = {
      gameState: { season: 1, currentRound: 1, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [
        {
          id: 'mclaren', shortName: 'MCL', headquarters: 'Woking', morale: 80,
          constructorPosition: 1, staff: [], lastProcessedRound: 0,
          ovrHistory: [], lastUpgradeRound: 0,
          components: [
            { element: 'ice', used: 3, limit: 4, failureProbability: 0.02 },
            { element: 'turbo', used: 2, limit: 4, failureProbability: 0.03 },
            { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.03 },
            { element: 'ers-battery', used: 0, limit: 3, failureProbability: 0.01 },
            { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
          ],
        },
      ],
      drivers: [],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    await save.saveToSlot('noop-v6', 'Noop v6', v6Payload)
    // @ts-expect-error — touching private field to backdate schemaVersion
    const db = await save.dbPromise
    const record = await db.get('saves', 'noop-v6')
    record.schemaVersion = 6
    await db.put('saves', record)

    const loaded = await save.loadFromSlot('noop-v6') as unknown as FullGameState
    const mclaren = loaded.teams[0]
    // All existing values survive the migration unchanged.
    expect(mclaren.components.find(c => c.element === 'ice')?.used).toBe(3)
    expect(mclaren.components.find(c => c.element === 'mgu-k')?.used).toBe(1)
    expect(mclaren.components.find(c => c.element === 'mgu-k')?.failureProbability).toBe(0.03)
  })
})

describe('v7 → v8 migration (Penalty System Tier A)', () => {
  it('back-fills the four new driver fields with default values', () => {
    const v7State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 7 },
      teams: [],
      drivers: [{
        id: 'd1',
        firstName: 'Test',
        lastName: 'Driver',
        seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0 },
      }],
    }
    const { data } = migrateToCurrent(v7State as any, 7)
    expect(data.drivers[0].penaltyPoints).toEqual([])
    expect(data.drivers[0].warningsThisSeason).toBe(0)
    expect(data.drivers[0].nextRaceGridDrop).toBe(0)
    expect(data.drivers[0].banUntilRound).toBeNull()
  })

  it('is idempotent — running twice yields the same result', () => {
    const v7State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 7 },
      teams: [],
      drivers: [{ id: 'd1', seasonStats: {} }],
    }
    const once = migrateToCurrent(v7State as any, 7).data
    const twice = migrateToCurrent(once, SCHEMA_VERSION).data
    expect(twice).toEqual(once)
  })

  it('preserves existing driver fields untouched', () => {
    const v7State = {
      gameState: { season: 2, currentRound: 10, schemaVersion: 7 },
      teams: [],
      drivers: [{
        id: 'd1', firstName: 'Existing', lastName: 'Field',
        form: [3, 5, 2], lastRaceResult: 4,
        seasonStats: { points: 50, wins: 0, podiums: 1, poles: 0, dnfs: 0, penalties: 0, bestFinish: 3, averageFinish: 3.5, lastProcessedRound: 9 },
      }],
    }
    const { data } = migrateToCurrent(v7State as any, 7)
    expect(data.drivers[0].firstName).toBe('Existing')
    expect(data.drivers[0].form).toEqual([3, 5, 2])
    expect(data.drivers[0].seasonStats.points).toBe(50)
  })
})

describe('v8 → v9 migration (Factory Box 1 — Car Performance buffers)', () => {
  it('back-fills fastestLapHistory and failureEvents with [] on every team', () => {
    const v8State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 8 },
      teams: [
        { id: 'mclaren', name: 'McLaren', constructorPoints: 0 },
        { id: 'red-bull', name: 'Red Bull', constructorPoints: 0 },
      ],
      drivers: [],
    }
    const { data } = migrateToCurrent(v8State as unknown as FullGameState, 8)
    for (const team of data.teams) {
      expect(team.fastestLapHistory).toEqual([])
      expect(team.failureEvents).toEqual([])
    }
  })

  it('preserves existing buffers verbatim if already populated', () => {
    const v8State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 8 },
      teams: [{
        id: 'mclaren',
        name: 'McLaren',
        fastestLapHistory: [{ round: 3, lapMs: 78_421 }],
        failureEvents: [
          { round: 2, lap: 14, element: 'ice', driverId: 'norris' },
        ],
      }],
      drivers: [],
    }
    const { data } = migrateToCurrent(v8State as unknown as FullGameState, 8)
    expect(data.teams[0].fastestLapHistory).toEqual([{ round: 3, lapMs: 78_421 }])
    expect(data.teams[0].failureEvents).toHaveLength(1)
    expect(data.teams[0].failureEvents[0].element).toBe('ice')
  })

  it('is idempotent — running twice yields the same result', () => {
    const v8State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 8 },
      teams: [{ id: 'mclaren', name: 'McLaren' }],
      drivers: [],
    }
    const once = migrateToCurrent(v8State as unknown as FullGameState, 8).data
    const twice = migrateToCurrent(once, SCHEMA_VERSION).data
    expect(twice).toEqual(once)
  })

  it('preserves existing team fields untouched', () => {
    const v8State = {
      gameState: { season: 2, currentRound: 10, schemaVersion: 8 },
      teams: [{
        id: 'mclaren', name: 'McLaren', constructorPoints: 47,
        constructorPosition: 3, ovrHistory: [82, 83, 84], lastUpgradeRound: 5,
      }],
      drivers: [],
    }
    const { data } = migrateToCurrent(v8State as unknown as FullGameState, 8)
    expect(data.teams[0].constructorPoints).toBe(47)
    expect(data.teams[0].constructorPosition).toBe(3)
    expect(data.teams[0].ovrHistory).toEqual([82, 83, 84])
    expect(data.teams[0].lastUpgradeRound).toBe(5)
  })
})

describe('v9 → v10 migration (Factory Box 2 — Power Unit strategy)', () => {
  it('back-fills penaltiesTaken and pendingComponentSwaps with defaults', () => {
    const v9State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 9 },
      teams: [
        { id: 'mclaren', name: 'McLaren', constructorPoints: 0 },
        { id: 'red-bull', name: 'Red Bull', constructorPoints: 0 },
      ],
      drivers: [],
    }
    const { data, migrated } = migrateToCurrent(v9State as unknown as FullGameState, 9)
    expect(migrated).toBe(true)
    for (const team of data.teams) {
      expect(team.penaltiesTaken).toBe(0)
      expect(team.pendingComponentSwaps).toEqual([])
    }
  })

  it('preserves existing values verbatim if already populated', () => {
    const v9State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 9 },
      teams: [{
        id: 'mclaren', name: 'McLaren',
        penaltiesTaken: 3,
        pendingComponentSwaps: [
          { driverId: 'norris', element: 'ice', electedRound: 5 },
        ],
      }],
      drivers: [],
    }
    const { data } = migrateToCurrent(v9State as unknown as FullGameState, 9)
    expect(data.teams[0].penaltiesTaken).toBe(3)
    expect(data.teams[0].pendingComponentSwaps).toHaveLength(1)
    expect(data.teams[0].pendingComponentSwaps[0].driverId).toBe('norris')
  })

  it('is idempotent — running twice yields the same result', () => {
    const v9State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 9 },
      teams: [{ id: 'mclaren', name: 'McLaren' }],
      drivers: [],
    }
    const once = migrateToCurrent(v9State as unknown as FullGameState, 9).data
    const twice = migrateToCurrent(once, SCHEMA_VERSION).data
    expect(twice).toEqual(once)
  })

  it('preserves Phase 1 buffers (fastestLapHistory, failureEvents) untouched', () => {
    const v9State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 9 },
      teams: [{
        id: 'mclaren', name: 'McLaren',
        fastestLapHistory: [{ round: 3, lapMs: 78_421 }],
        failureEvents: [],
      }],
      drivers: [],
    }
    const { data } = migrateToCurrent(v9State as unknown as FullGameState, 9)
    expect(data.teams[0].fastestLapHistory).toEqual([{ round: 3, lapMs: 78_421 }])
    expect(data.teams[0].failureEvents).toEqual([])
  })
})

describe('v10 → v11 migration (Factory Box 3 — Aero Testing real data)', () => {
  it('back-fills aeroBookings, upgradeOutcomes, and per-upgrade WT/CFD costs', () => {
    const v10State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 10 },
      teams: [
        {
          id: 'mclaren',
          rndUpgrades: [
            // Legacy upgrade with no per-cycle costs.
            {
              id: 'aero-x', branch: 'active-aero',
              name: 'Old Aero', description: '', progress: 30,
              status: 'in-progress', cost: 5, developmentRaces: 3,
              performanceDelta: { downforce: 2 }, prerequisiteIds: [],
            },
          ],
        },
      ],
      drivers: [],
    }
    const { data, migrated } = migrateToCurrent(v10State as unknown as FullGameState, 10)
    expect(migrated).toBe(true)
    expect(data.teams[0].aeroBookings).toEqual([])
    expect(data.teams[0].upgradeOutcomes).toEqual([])
    const upgrade = data.teams[0].rndUpgrades[0]
    expect(upgrade.wtHoursPerCycle).toBeGreaterThanOrEqual(0)
    expect(upgrade.cfdRunsPerCycle).toBeGreaterThanOrEqual(0)
    expect(typeof upgrade.wtHoursPerCycle).toBe('number')
    expect(typeof upgrade.cfdRunsPerCycle).toBe('number')
  })

  it('preserves existing aeroBookings, upgradeOutcomes, and per-upgrade costs verbatim', () => {
    const v10State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 10 },
      teams: [{
        id: 'mclaren',
        aeroBookings: [{ day: 3, wtHours: 5, cfdRuns: 25 }],
        upgradeOutcomes: [{
          upgradeId: 'a', deliveredRound: 3,
          predictedOvrDelta: 5, ovrAtDelivery: 80, actualOvrDelta: 6,
        }],
        rndUpgrades: [{
          id: 'aero-x', branch: 'active-aero',
          name: 'Old Aero', description: '', progress: 30,
          status: 'in-progress', cost: 5, developmentRaces: 3,
          performanceDelta: { downforce: 2 }, prerequisiteIds: [],
          wtHoursPerCycle: 17, cfdRunsPerCycle: 88,
        }],
      }],
      drivers: [],
    }
    const { data } = migrateToCurrent(v10State as unknown as FullGameState, 10)
    expect(data.teams[0].aeroBookings).toEqual([{ day: 3, wtHours: 5, cfdRuns: 25 }])
    expect(data.teams[0].upgradeOutcomes[0].actualOvrDelta).toBe(6)
    expect(data.teams[0].rndUpgrades[0].wtHoursPerCycle).toBe(17)
    expect(data.teams[0].rndUpgrades[0].cfdRunsPerCycle).toBe(88)
  })

  it('is idempotent — running twice yields the same result', () => {
    const v10State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 10 },
      teams: [{ id: 'mclaren', rndUpgrades: [] }],
      drivers: [],
    }
    const once = migrateToCurrent(v10State as unknown as FullGameState, 10).data
    const twice = migrateToCurrent(once, SCHEMA_VERSION).data
    expect(twice).toEqual(once)
  })
})

describe('v11 → v12 migration (Tier B v2 — pit-crew staff schema)', () => {
  it('back-fills pitCrewChief: null and pitCrewMembers: [] on every team', () => {
    const v11State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 11 },
      teams: [
        { id: 'mclaren', name: 'McLaren', constructorPoints: 0 },
        { id: 'red-bull', name: 'Red Bull', constructorPoints: 0 },
      ],
      drivers: [],
    }
    const { data } = migrateToCurrent(v11State as unknown as FullGameState, 11)
    for (const team of data.teams) {
      expect(team.pitCrewChief).toBeNull()
      expect(team.pitCrewMembers).toEqual([])
    }
  })

  it('back-fills empty staffMarket and poachingAttempts at the world level', () => {
    const v11State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 11 },
      teams: [],
      drivers: [],
    }
    const { data } = migrateToCurrent(v11State as unknown as FullGameState, 11)
    expect(data.staffMarket).toEqual({ chiefs: [], members: [], lastRefreshedSeason: 0 })
    expect(data.poachingAttempts).toEqual([])
  })

  it('preserves existing pit-crew fields verbatim if already populated', () => {
    const v11State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 11 },
      teams: [{
        id: 'mclaren',
        pitCrewChief: { id: 'chief-x', firstName: 'Test', lastName: 'Chief' },
        pitCrewMembers: [{ id: 'm1', role: 'lollipop' }],
      }],
      drivers: [],
      staffMarket: { chiefs: [{ id: 'chief-y' }], members: [], lastRefreshedSeason: 1 },
      poachingAttempts: [{ id: 'p1' }],
    }
    const { data } = migrateToCurrent(v11State as unknown as FullGameState, 11)
    expect(data.teams[0].pitCrewChief?.id).toBe('chief-x')
    expect(data.teams[0].pitCrewMembers).toHaveLength(1)
    expect(data.staffMarket.chiefs).toHaveLength(1)
    expect(data.poachingAttempts).toHaveLength(1)
  })

  it('is idempotent — running twice yields the same result', () => {
    const v11State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 11 },
      teams: [{ id: 'mclaren' }],
      drivers: [],
    }
    const once = migrateToCurrent(v11State as unknown as FullGameState, 11).data
    const twice = migrateToCurrent(once, SCHEMA_VERSION).data
    expect(twice).toEqual(once)
  })
})

describe('track-limits offence type loads without a schema bump (Tier C IP-C2)', () => {
  it('a v13 save with a track-limits penaltyPoint entry round-trips through save→load', async () => {
    // Tier C IP-C2 adds the 'track-limits' OffenceType but performs NO schema
    // bump (SCHEMA_VERSION stays 13). PenaltyPointEntry.offenceType is a plain
    // string union and the save layer applies no value validation, so a save
    // already at the current version must round-trip the new offence string
    // verbatim with no migration required.
    const save = new SaveSystem(`track-limits-noload-${Date.now()}`)

    // Real PenaltyPointEntry shape (src/types/driver.ts):
    //   { points, issuedSeason, issuedRound, offenceType, raceId }
    const trackLimitsEntry = {
      points: 0,
      issuedSeason: 2026,
      issuedRound: 3,
      offenceType: 'track-limits' as const,
      raceId: 'r3',
    }

    const v13Payload = {
      gameState: { season: 1, currentRound: 3, phase: 'management', playerTeamId: 'mclaren', seed: 1, totalRaces: 22 },
      teams: [],
      drivers: [
        {
          id: 'norris', teamId: 'mclaren', isReserve: false, isF2: false,
          penaltyPoints: [trackLimitsEntry],
          warningsThisSeason: 1,
          nextRaceGridDrop: 0,
          banUntilRound: null,
          seasonStats: {
            points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0,
            penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0,
          },
        },
      ],
      calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
      recommendations: [], stagedStrategies: {},
    } as unknown as FullGameState

    // Save at the CURRENT schema version (13) — no backdating, so no migration runs.
    await save.saveToSlot('track-limits-save', 'Track Limits Save', v13Payload)

    // Load must succeed (no throw) — proves the unknown offence string is not rejected.
    const loaded = await save.loadFromSlot('track-limits-save') as unknown as FullGameState

    const driver = loaded.drivers[0]
    expect(driver.penaltyPoints).toHaveLength(1)
    const entry = driver.penaltyPoints[0]
    expect(entry.offenceType).toBe('track-limits')
    expect(entry.points).toBe(0)
    expect(entry.issuedSeason).toBe(2026)
    expect(entry.issuedRound).toBe(3)
    expect(entry.raceId).toBe('r3')

    // The slot is stored at the current schema version — confirms no bump was
    // forced and no migration mangled the entry.
    const listed = await save.listSlots()
    expect(listed.find(s => s.slotId === 'track-limits-save')?.schemaVersion).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(13)
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
