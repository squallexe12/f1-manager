import { describe, it, expect } from 'vitest'
import { generateTalentPool, DEFAULT_STAFF_POOL_SIZE } from '@/engine/staff/talent-pool'
import { STAFF_POOL_DEFAULTS, CHIEF_ATTR_DIST, MEMBER_RATING_DIST } from '@/data/staff-distributions'

describe('generateTalentPool', () => {
  it('produces the requested pool sizes', () => {
    const pool = generateTalentPool(123, 1, { chiefs: 10, members: 30 })
    expect(pool.chiefs).toHaveLength(10)
    expect(pool.members).toHaveLength(30)
    expect(pool.lastRefreshedSeason).toBe(1)
  })

  it('default pool size matches STAFF_POOL_DEFAULTS', () => {
    expect(DEFAULT_STAFF_POOL_SIZE).toEqual(STAFF_POOL_DEFAULTS)
  })

  it('is deterministic on (seed, season)', () => {
    const a = generateTalentPool(42, 5, { chiefs: 5, members: 5 })
    const b = generateTalentPool(42, 5, { chiefs: 5, members: 5 })
    expect(a).toEqual(b)
  })

  it('different seeds produce different pools', () => {
    const a = generateTalentPool(1, 1, { chiefs: 5, members: 5 })
    const b = generateTalentPool(2, 1, { chiefs: 5, members: 5 })
    expect(a.chiefs[0].id).not.toBe(b.chiefs[0].id)
  })

  it('different seasons produce different pools at same seed', () => {
    const a = generateTalentPool(7, 1, { chiefs: 5, members: 5 })
    const b = generateTalentPool(7, 2, { chiefs: 5, members: 5 })
    expect(a.chiefs[0].id).not.toBe(b.chiefs[0].id)
  })

  it('chief attributes lie within distribution bounds', () => {
    const pool = generateTalentPool(99, 1, { chiefs: 50, members: 0 })
    for (const c of pool.chiefs) {
      expect(c.releaseSupervision).toBeGreaterThanOrEqual(CHIEF_ATTR_DIST.min)
      expect(c.releaseSupervision).toBeLessThanOrEqual(CHIEF_ATTR_DIST.max)
      expect(c.speedDisciplineCoaching).toBeGreaterThanOrEqual(CHIEF_ATTR_DIST.min)
      expect(c.speedDisciplineCoaching).toBeLessThanOrEqual(CHIEF_ATTR_DIST.max)
      expect(c.serviceCoordination).toBeGreaterThanOrEqual(CHIEF_ATTR_DIST.min)
      expect(c.serviceCoordination).toBeLessThanOrEqual(CHIEF_ATTR_DIST.max)
    }
  })

  it('member ratings lie within distribution bounds and roles cycle through all 7 slots', () => {
    const pool = generateTalentPool(99, 1, { chiefs: 0, members: 70 })
    const rolesSeen = new Set(pool.members.map((m) => m.role))
    expect(rolesSeen.size).toBe(7)
    for (const m of pool.members) {
      expect(m.rating).toBeGreaterThanOrEqual(MEMBER_RATING_DIST.min)
      expect(m.rating).toBeLessThanOrEqual(MEMBER_RATING_DIST.max)
    }
  })

  it('staff have plausible age, salary, and unique ids', () => {
    const pool = generateTalentPool(123, 1, { chiefs: 20, members: 40 })
    const allIds = [...pool.chiefs.map((c) => c.id), ...pool.members.map((m) => m.id)]
    expect(new Set(allIds).size).toBe(allIds.length)
    for (const c of pool.chiefs) {
      expect(c.age).toBeGreaterThanOrEqual(28)
      expect(c.age).toBeLessThanOrEqual(58)
      expect(c.contract.salary).toBeGreaterThan(0)
    }
    for (const m of pool.members) {
      expect(m.age).toBeGreaterThanOrEqual(28)
      expect(m.age).toBeLessThanOrEqual(58)
      expect(m.contract.salary).toBeGreaterThan(0)
    }
  })
})
