import { describe, it, expect } from 'vitest'
import { TEAMS } from '@/data/teams'
import { DRIVERS } from '@/data/drivers'
import { CIRCUITS } from '@/data/circuits'
import { SCENARIOS } from '@/data/scenarios'
import { RND_TREE } from '@/data/rnd-tree'
import { SPONSORS } from '@/data/sponsors'

describe('data integrity', () => {
  it('has 11 teams', () => {
    expect(TEAMS).toHaveLength(11)
  })

  it('has at least 22 drivers', () => {
    expect(DRIVERS.length).toBeGreaterThanOrEqual(22)           
  })

  it('every team has 2 drivers that exist', () => {
    const driverIds = new Set(DRIVERS.map(d => d.id))
    for (const team of TEAMS) {
      expect(driverIds.has(team.driverIds[0])).toBe(true)
      expect(driverIds.has(team.driverIds[1])).toBe(true)
    }
  })

  it('has 24 circuits', () => {
    expect(CIRCUITS).toHaveLength(24)
  })

  it('every circuit has 3 tire compounds', () => {
    for (const circuit of CIRCUITS) {
      expect(circuit.compounds).toHaveLength(3)
    }
  })

  it('has 4 scenarios', () => {
    expect(SCENARIOS).toHaveLength(4)
  })

  it('R&D tree has 3 branches with upgrades', () => {
    const branches = new Set(RND_TREE.map(u => u.branch))
    expect(branches.size).toBe(3)
    expect(branches.has('chassis')).toBe(true)
    expect(branches.has('power-unit')).toBe(true)
    expect(branches.has('active-aero')).toBe(true)
  })

  it('R&D prerequisites reference valid upgrade IDs', () => {
    const ids = new Set(RND_TREE.map(u => u.id))
    for (const upgrade of RND_TREE) {
      for (const prereq of upgrade.prerequisiteIds) {
        expect(ids.has(prereq)).toBe(true)
      }
    }
  })

  it('has sponsors across all tiers', () => {
    const tiers = new Set(SPONSORS.map(s => s.tier))
    expect(tiers.has('title')).toBe(true)
    expect(tiers.has('major')).toBe(true)
    expect(tiers.has('minor')).toBe(true)
  })
})
