import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { SaveSystem } from '@/engine/core/save-system'

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

  it('lists available save slots', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    const slots = await save.listSlots()
    expect(slots).toHaveLength(1)
    expect(slots[0].name).toBe('My Save')
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
})
