import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriverHero } from '@/components/drivers/driver-hero'
import type { Driver } from '@/types/driver'
import type { Team } from '@/types/team'

const mkTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 't1',
  name: 'Vantage GP',
  shortName: 'VAN',
  color: 'oklch(0.62 0.20 265)',
  headquarters: 'Silverstone',
  powerUnitSupplier: 'Mercedes',
  driverIds: ['d1', 'd2'],
  reserveDriverId: null,
  staff: [],
  car: { downforce: 70, straightSpeed: 70, reliability: 70, tireManagement: 70, braking: 70, cornering: 70 },
  rndUpgrades: [],
  components: [],
  windTunnelHoursUsed: 0,
  windTunnelHoursLimit: 100,
  cfdRunsUsed: 0,
  cfdRunsLimit: 100,
  morale: 70,
  aiPersonality: null,
  constructorPoints: 0,
  constructorPosition: 1,
  previousConstructorPosition: 0,
  previousMorale: 70,
  seasonForm: [],
  lastProcessedRound: 0,
  ovrHistory: [],
  lastUpgradeRound: 0,
  fastestLapHistory: [],
  failureEvents: [],
  penaltiesTaken: 0,
  pendingComponentSwaps: [],
  aeroBookings: [],
  upgradeOutcomes: [],
  pitCrewChief: null,
  pitCrewMembers: [],
  ...overrides,
})

const mkDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1',
  firstName: 'Max',
  lastName: 'Verstappen',
  shortName: 'VER',
  nationality: 'NED',
  age: 28,
  teamId: 't1',
  attributes: { pace: 97, racecraft: 96, experience: 92, mentality: 90, marketability: 95, developmentPotential: 50 },
  mood: { motivation: 90, confidence: 88, frustration: 20 },
  contract: { salary: 55000000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
  seasonStats: { points: 168, wins: 4, podiums: 6, poles: 3, dnfs: 1, penalties: 1, bestFinish: 1, averageFinish: 2.4, lastProcessedRound: 8 },
  rivalries: [],
  peakAge: 28,
  declineRate: 0.5,
  isReserve: false,
  isF2: false,
  form: [1, 2, 1, 3],
  lastRaceResult: 2,
  penaltyPoints: [],
  warningsThisSeason: 0,
  nextRaceGridDrop: 0,
  banUntilRound: null,
  careerWins: 64,
  careerPodiums: 116,
  careerStarts: 218,
  worldTitles: 4,
  pulse: { headline: 'On championship pace', detail: '4 wins in 8 rounds' },
  portraitUrl: null,
  scoutSignal: 'available',
  scoutingReports: 0,
  ...overrides,
})

describe('<DriverHero>', () => {
  it('renders world-title stars when worldTitles > 0', () => {
    const { container } = render(
      <DriverHero
        driver={mkDriver({ worldTitles: 4 })}
        team={mkTeam()}
        currentSeason={2026}
        championshipPosition={2}
        championshipGap={-14}
      />
    )
    const stars = container.querySelectorAll('.star')
    expect(stars.length).toBe(4)
    expect(screen.getByText(/4× WORLD CHAMPION/)).toBeInTheDocument()
  })

  it('does not render title stars when worldTitles === 0', () => {
    const { container } = render(
      <DriverHero
        driver={mkDriver({ worldTitles: 0 })}
        team={mkTeam()}
        currentSeason={2026}
        championshipPosition={2}
        championshipGap={-14}
      />
    )
    const titles = container.querySelector('.drv-helm-titles')
    expect(titles).toBeNull()
  })

  it('renders career row when careerStarts > 0', () => {
    render(
      <DriverHero
        driver={mkDriver({ careerStarts: 218, careerWins: 64, careerPodiums: 116 })}
        team={mkTeam()}
        currentSeason={2026}
        championshipPosition={2}
        championshipGap={-14}
      />
    )
    expect(screen.getByText('CAREER WINS')).toBeInTheDocument()
    expect(screen.getByText('64')).toBeInTheDocument()
    expect(screen.getByText('218')).toBeInTheDocument()
  })

  it('does not render career row when careerStarts === 0', () => {
    render(
      <DriverHero
        driver={mkDriver({ careerStarts: 0 })}
        team={mkTeam()}
        currentSeason={2026}
        championshipPosition={2}
        championshipGap={-14}
      />
    )
    expect(screen.queryByText('CAREER WINS')).toBeNull()
  })

  it('renders championship row for active driver', () => {
    render(
      <DriverHero
        driver={mkDriver({ isReserve: false })}
        team={mkTeam()}
        currentSeason={2026}
        championshipPosition={2}
        championshipGap={-14}
      />
    )
    expect(screen.getByText("DRIVERS’ STANDING")).toBeInTheDocument()
    expect(screen.getByText(/SEASON PULSE/)).toBeInTheDocument()
  })

  it('renders RESERVE STATUS row for reserve driver', () => {
    render(
      <DriverHero
        driver={mkDriver({ isReserve: true, pulse: { headline: 'Reserve ready', detail: 'Sim pace strong' } })}
        team={mkTeam()}
        currentSeason={2026}
        championshipPosition={null}
        championshipGap={null}
      />
    )
    expect(screen.getByText('RESERVE STATUS')).toBeInTheDocument()
    expect(screen.queryByText("DRIVERS’ STANDING")).toBeNull()
  })

  it('renders contract expiry as absolute season (currentSeason + termEndSeason - 1)', () => {
    render(
      <DriverHero
        driver={mkDriver({ contract: { salary: 55000000, termEndSeason: 3, performanceBonuses: [], releaseClause: null } })}
        team={mkTeam()}
        currentSeason={2026}
        championshipPosition={2}
        championshipGap={-14}
      />
    )
    // 2026 + 3 - 1 = 2028
    expect(screen.getByText('S2028')).toBeInTheDocument()
  })

  it('renders 8-column stats grid with correct values', () => {
    render(
      <DriverHero
        driver={mkDriver({
          seasonStats: { points: 168, wins: 4, podiums: 6, poles: 3, dnfs: 1, penalties: 1, bestFinish: 1, averageFinish: 2.4, lastProcessedRound: 8 },
        })}
        team={mkTeam()}
        currentSeason={2026}
        championshipPosition={2}
        championshipGap={-14}
      />
    )
    expect(screen.getByText('PTS')).toBeInTheDocument()
    expect(screen.getByText('168')).toBeInTheDocument()
    expect(screen.getByText('WINS')).toBeInTheDocument()
    expect(screen.getByText('PODS')).toBeInTheDocument()
    expect(screen.getByText('POLES')).toBeInTheDocument()
    expect(screen.getByText('DNF')).toBeInTheDocument()
    expect(screen.getByText('PEN')).toBeInTheDocument()
    expect(screen.getByText('BEST')).toBeInTheDocument()
    expect(screen.getByText('AVG')).toBeInTheDocument()
    expect(screen.getByText('2.4')).toBeInTheDocument()
  })
})
