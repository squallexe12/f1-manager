import { describe, it, expect } from 'vitest'
import {
  mapOpenF1CircuitName,
  OPENF1_CIRCUIT_MAP,
} from '@scripts/openf1/circuit-map'

describe('mapOpenF1CircuitName', () => {
  it('maps known OpenF1 circuit names to our circuitIds', () => {
    expect(mapOpenF1CircuitName('Sakhir')).toBe('bahrain')
    expect(mapOpenF1CircuitName('Jeddah')).toBe('jeddah')
    expect(mapOpenF1CircuitName('Melbourne')).toBe('melbourne')
    expect(mapOpenF1CircuitName('Monza')).toBe('monza')
    expect(mapOpenF1CircuitName('Monaco')).toBe('monaco')
  })

  it('returns null for unknown circuit names', () => {
    expect(mapOpenF1CircuitName('Nonexistent Track')).toBeNull()
    expect(mapOpenF1CircuitName('')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(mapOpenF1CircuitName('sakhir')).toBe('bahrain')
    expect(mapOpenF1CircuitName('MONACO')).toBe('monaco')
  })

  it('exposes the complete mapping dictionary', () => {
    expect(OPENF1_CIRCUIT_MAP).toBeDefined()
    expect(Object.keys(OPENF1_CIRCUIT_MAP).length).toBeGreaterThanOrEqual(10)
  })
})
