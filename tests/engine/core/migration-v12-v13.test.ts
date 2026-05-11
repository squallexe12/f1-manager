import { describe, expect, it } from 'vitest'
import { MIGRATIONS, SCHEMA_VERSION } from '@/engine/core/save-system'
import type { Driver } from '@/types/driver'
import type { FullGameState } from '@/engine/core/state-manager'

describe('migration v12 → v13', () => {
  it('SCHEMA_VERSION is 14', () => {
    expect(SCHEMA_VERSION).toBe(14)
  })

  it('MIGRATIONS[12] exists', () => {
    expect(typeof MIGRATIONS[12]).toBe('function')
  })

  it('defaults all new Driver fields on every driver', () => {
    const v12Save = makeV12Save()
    const v13 = MIGRATIONS[12](v12Save)
    for (const driver of v13.drivers) {
      expect(driver.careerWins).toBe(0)
      expect(driver.careerPodiums).toBe(0)
      expect(driver.careerStarts).toBe(0)
      expect(driver.worldTitles).toBe(0)
      expect(driver.portraitUrl).toBeNull()
      expect(driver.scoutingReports).toBe(0)
    }
  })

  it('populates pulse and scoutSignal via helpers (deterministic)', () => {
    const v12Save = makeV12SaveWithChampionshipLeader('verstappen')
    const v13 = MIGRATIONS[12](v12Save)
    const verstappen = v13.drivers.find((d: Pick<Driver, 'id'>) => d.id === 'verstappen')!
    // Branch #4 (championship leader): "Leading the championship"
    expect(verstappen.pulse.headline).toBe('Leading the championship')
    expect(verstappen.scoutSignal).toBe('available') // contracted driver
  })

  it('does not mutate input', () => {
    const v12 = makeV12Save()
    const snapshot = JSON.stringify(v12)
    MIGRATIONS[12](v12)
    expect(JSON.stringify(v12)).toBe(snapshot)
  })
})

function makeV12Save(): FullGameState {
  // Minimal fixture: gameState + one driver without the new v13 fields.
  // Cast to FullGameState — the driver omits v13-only fields intentionally;
  // the migration under test is responsible for adding them.
  return {
    gameState: { season: 1, currentRound: 5, phase: 'management', playerTeamId: 't1', scenario: 'rebuild', seed: 42, totalRaces: 22 },
    teams: [],
    drivers: [
      {
        id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
        nationality: 'X', age: 25, teamId: 't1',
        attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
        mood: { motivation: 80, frustration: 20, confidence: 70 },
        contract: null, rivalries: [],
        seasonStats: { points: 50, wins: 1, podiums: 3, poles: 0, dnfs: 0, penalties: 0, bestFinish: 1, averageFinish: 5, lastProcessedRound: 5 },
        peakAge: 28, declineRate: 0.4, isReserve: false, isF2: false,
        form: [3, 5, 1, 8], lastRaceResult: 8,
        penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
        // v13 fields are intentionally absent here — migration must add them.
        // TypeScript is satisfied via the cast below; the fields are present
        // at runtime after MIGRATIONS[12] runs, which the tests verify.
      } as unknown as Driver,
    ],
    calendar: [],
    finance: {},
    narrativeEvents: [],
    storyArcs: [],
    recommendations: [],
    stagedStrategies: {},
    staffMarket: { chiefs: [], members: [], lastRefreshedSeason: 0 },
    poachingAttempts: [],
    media: { pendingPress: null, transcripts: [] },
  }
}

function makeV12SaveWithChampionshipLeader(driverId: string) {
  const save = makeV12Save()
  save.drivers[0].id = driverId
  save.drivers[0].seasonStats.points = 200
  save.drivers[0].seasonStats.wins = 4
  save.drivers[0].seasonStats.dnfs = 1
  return save
}
