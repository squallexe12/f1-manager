import { describe, it, expect } from 'vitest'
import { aggregateCrewRatings } from '@/engine/staff/pit-crew'
import type { PitCrewChief, PitCrewMember, PitCrewRole } from '@/types/staff'

function makeChief(overrides: Partial<PitCrewChief> = {}): PitCrewChief {
  return {
    id: 'chief-1', firstName: 'Test', lastName: 'Chief', nationality: 'Italian', age: 45,
    releaseSupervision: 70, speedDisciplineCoaching: 70, serviceCoordination: 70,
    contract: { salary: 1_000_000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
    ...overrides,
  }
}

function makeMember(role: PitCrewRole, rating: number): PitCrewMember {
  return {
    id: `m-${role}`, firstName: 'Test', lastName: 'Member', nationality: 'British', age: 35,
    role, rating,
    contract: { salary: 500_000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
  }
}

describe('aggregateCrewRatings', () => {
  it('returns neutral 50 baseline when no chief is hired', () => {
    expect(aggregateCrewRatings(null, [])).toEqual({
      release: 50, speedDiscipline: 50, serviceTime: 50,
    })
  })

  it('a hired chief alone meaningfully raises all three sub-attributes from the no-chief baseline', () => {
    const noStaff = aggregateCrewRatings(null, [])
    const chiefOnly = aggregateCrewRatings(
      makeChief({ releaseSupervision: 90, speedDisciplineCoaching: 80, serviceCoordination: 75 }),
      [],
    )
    expect(chiefOnly.release).toBeGreaterThan(noStaff.release)
    expect(chiefOnly.speedDiscipline).toBeGreaterThan(noStaff.speedDiscipline)
    expect(chiefOnly.serviceTime).toBeGreaterThan(noStaff.serviceTime)
  })

  it('lollipop member rating dominates the release sub-attribute relative to other roles', () => {
    const chief = makeChief({ releaseSupervision: 70 })
    const elite = aggregateCrewRatings(chief, [makeMember('lollipop', 99)])
    const cleaner = aggregateCrewRatings(chief, [makeMember('wheel-on-front', 99)])
    expect(elite.release).toBeGreaterThan(cleaner.release)
  })

  it('a full elite roster (all 95+) lands meaningfully above neutral on all axes', () => {
    const chief = makeChief({
      releaseSupervision: 95, speedDisciplineCoaching: 95, serviceCoordination: 95,
    })
    const fullRoster: PitCrewMember[] = [
      makeMember('lollipop', 95),
      makeMember('front-jack', 95),
      makeMember('rear-jack', 95),
      makeMember('wheel-off-front', 95),
      makeMember('wheel-on-front', 95),
      makeMember('wheel-off-rear', 95),
      makeMember('wheel-on-rear', 95),
    ]
    const result = aggregateCrewRatings(chief, fullRoster)
    expect(result.release).toBeGreaterThanOrEqual(85)
    expect(result.speedDiscipline).toBeGreaterThanOrEqual(85)
    expect(result.serviceTime).toBeGreaterThanOrEqual(85)
  })

  it('clamps all returned values to [0, 100]', () => {
    const chief = makeChief({ releaseSupervision: 100, speedDisciplineCoaching: 100, serviceCoordination: 100 })
    const result = aggregateCrewRatings(chief, [makeMember('lollipop', 100)])
    expect(result.release).toBeLessThanOrEqual(100)
    expect(result.speedDiscipline).toBeLessThanOrEqual(100)
    expect(result.serviceTime).toBeLessThanOrEqual(100)
  })
})
