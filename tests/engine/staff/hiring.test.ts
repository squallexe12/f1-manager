import { describe, it, expect } from 'vitest'
import { hireChief, fireChief, hireMember, fireMember } from '@/engine/staff/hiring'
import type { StaffMarket, PitCrewChief, PitCrewMember, PitCrewRole } from '@/types/staff'

function makeChief(id: string, ratings = { r: 75, s: 70, c: 80 }): PitCrewChief {
  return {
    id, firstName: 'Test', lastName: 'Chief', nationality: 'Italian', age: 45,
    releaseSupervision: ratings.r, speedDisciplineCoaching: ratings.s, serviceCoordination: ratings.c,
    contract: { salary: 1_000_000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
  }
}

function makeMember(id: string, role: PitCrewRole, rating = 70): PitCrewMember {
  return {
    id, firstName: 'Test', lastName: 'Member', nationality: 'British', age: 35, role, rating,
    contract: { salary: 500_000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
  }
}

function emptyMarket(): StaffMarket {
  return { chiefs: [], members: [], lastRefreshedSeason: 1 }
}

describe('hireChief', () => {
  it('moves the chief from market to team and returns updated state', () => {
    const target = makeChief('c1')
    const market: StaffMarket = { ...emptyMarket(), chiefs: [target, makeChief('c2')] }
    const result = hireChief(market, null, [], 'c1')
    expect(result.market.chiefs.map((c) => c.id)).toEqual(['c2'])
    expect(result.team.pitCrewChief?.id).toBe('c1')
    expect(result.team.pitCrewMembers).toEqual([])
  })

  it('returns input unchanged if the chief id is not in the market', () => {
    const market: StaffMarket = { ...emptyMarket(), chiefs: [makeChief('c2')] }
    const result = hireChief(market, null, [], 'ghost')
    expect(result.market.chiefs.map((c) => c.id)).toEqual(['c2'])
    expect(result.team.pitCrewChief).toBeNull()
  })

  it('auto-fires the existing chief and returns them to the market with attribute decay', () => {
    const incoming = makeChief('c1', { r: 90, s: 80, c: 80 })
    const existing = makeChief('c0', { r: 75, s: 70, c: 80 })
    const market: StaffMarket = { ...emptyMarket(), chiefs: [incoming] }
    const result = hireChief(market, existing, [], 'c1')
    expect(result.team.pitCrewChief?.id).toBe('c1')
    // Existing chief returns to free agents with -2 to each attribute.
    const fired = result.market.chiefs.find((c) => c.id === 'c0')
    expect(fired).toBeDefined()
    expect(fired!.releaseSupervision).toBe(73)
    expect(fired!.speedDisciplineCoaching).toBe(68)
    expect(fired!.serviceCoordination).toBe(78)
  })
})

describe('fireChief', () => {
  it('returns chief to market with -2 attribute decay; clears slot', () => {
    const chief = makeChief('c1', { r: 80, s: 80, c: 80 })
    const result = fireChief(emptyMarket(), chief, [])
    expect(result.team.pitCrewChief).toBeNull()
    expect(result.market.chiefs[0].releaseSupervision).toBe(78)
  })

  it('is a no-op when no chief is hired', () => {
    const result = fireChief(emptyMarket(), null, [])
    expect(result.team.pitCrewChief).toBeNull()
    expect(result.market.chiefs).toHaveLength(0)
  })
})

describe('hireMember', () => {
  it('moves the member from market to team and returns updated state', () => {
    const target = makeMember('m1', 'lollipop', 80)
    const market: StaffMarket = { ...emptyMarket(), members: [target, makeMember('m2', 'front-jack')] }
    const result = hireMember(market, null, [], 'm1')
    expect(result.team.pitCrewMembers.map((m) => m.id)).toEqual(['m1'])
    expect(result.market.members.map((m) => m.id)).toEqual(['m2'])
  })

  it('auto-fires the existing occupant of the same role with attribute decay', () => {
    const incoming = makeMember('m-new', 'lollipop', 90)
    const existing = makeMember('m-old', 'lollipop', 75)
    const market: StaffMarket = { ...emptyMarket(), members: [incoming] }
    const result = hireMember(market, null, [existing], 'm-new')
    expect(result.team.pitCrewMembers.map((m) => m.id)).toEqual(['m-new'])
    const firedToMarket = result.market.members.find((m) => m.id === 'm-old')
    expect(firedToMarket).toBeDefined()
    expect(firedToMarket!.rating).toBe(73) // 75 - 2
  })

  it('preserves other-role occupants when filling a different role', () => {
    const incoming = makeMember('m-new', 'lollipop', 80)
    const otherRole = makeMember('m-jack', 'front-jack', 75)
    const market: StaffMarket = { ...emptyMarket(), members: [incoming] }
    const result = hireMember(market, null, [otherRole], 'm-new')
    expect(result.team.pitCrewMembers.map((m) => m.id).sort()).toEqual(['m-jack', 'm-new'])
  })
})

describe('fireMember', () => {
  it('removes the member from the team roster and returns to market with -2 decay', () => {
    const m = makeMember('m1', 'lollipop', 80)
    const result = fireMember(emptyMarket(), null, [m], 'm1')
    expect(result.team.pitCrewMembers).toHaveLength(0)
    expect(result.market.members[0].rating).toBe(78)
  })

  it('is a no-op when the member id is not on the team', () => {
    const result = fireMember(emptyMarket(), null, [makeMember('m1', 'lollipop')], 'ghost')
    expect(result.team.pitCrewMembers).toHaveLength(1)
  })
})
