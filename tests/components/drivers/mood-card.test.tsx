import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MoodCard } from '@/components/drivers/mood-card'
import type { Driver } from '@/types/driver'
import type { RivalryDisplay } from '@/lib/utils/drivers-page'

const mkDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1',
  firstName: 'Max',
  lastName: 'Verstappen',
  shortName: 'VER',
  nationality: 'NED',
  age: 28,
  teamId: 't1',
  attributes: { pace: 97, racecraft: 96, experience: 92, mentality: 90, marketability: 95, developmentPotential: 50 },
  mood: { motivation: 92, confidence: 95, frustration: 28 },
  contract: { salary: 55000000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0 },
  rivalries: [],
  peakAge: 28,
  declineRate: 0.5,
  isReserve: false,
  isF2: false,
  form: [],
  lastRaceResult: null,
  penaltyPoints: [],
  warningsThisSeason: 0,
  nextRaceGridDrop: 0,
  banUntilRound: null,
  careerWins: 0,
  careerPodiums: 0,
  careerStarts: 0,
  worldTitles: 0,
  pulse: { headline: '', detail: '' },
  portraitUrl: null,
  scoutSignal: 'available',
  scoutingReports: 0,
  ...overrides,
})

describe('<MoodCard>', () => {
  it('renders empty rivalries state with dashed placeholder', () => {
    render(<MoodCard driver={mkDriver({ rivalries: [] })} rivalryIndex={{}} />)
    expect(screen.getByText('No active rivalries logged')).toBeInTheDocument()
  })

  it('renders 3 mood cells', () => {
    const { container } = render(<MoodCard driver={mkDriver()} rivalryIndex={{}} />)
    const cells = container.querySelectorAll('.mood-cell')
    expect(cells.length).toBe(3)
  })

  it('renders MOTIVATION, CONFIDENCE, FRUSTRATION labels', () => {
    render(<MoodCard driver={mkDriver()} rivalryIndex={{}} />)
    expect(screen.getByText('MOTIVATION')).toBeInTheDocument()
    expect(screen.getByText('CONFIDENCE')).toBeInTheDocument()
    expect(screen.getByText('FRUSTRATION')).toBeInTheDocument()
  })

  it('renders rivalry row when rivalry exists in index', () => {
    const driver = mkDriver({
      rivalries: [{ targetDriverId: 'nor1', intensity: 84, cause: 'Title fight' }],
    })
    const rivalryIndex: Record<string, RivalryDisplay> = {
      nor1: { code: 'NOR', name: 'L. Norris', teamName: 'McLaren' },
    }
    render(<MoodCard driver={driver} rivalryIndex={rivalryIndex} />)
    expect(screen.getByText('NOR')).toBeInTheDocument()
    expect(screen.getByText('L. Norris')).toBeInTheDocument()
    expect(screen.getByText('Title fight')).toBeInTheDocument()
  })

  it('skips rivalry row when target is not in index', () => {
    const driver = mkDriver({
      rivalries: [{ targetDriverId: 'unknown', intensity: 50, cause: 'Some cause' }],
    })
    render(<MoodCard driver={driver} rivalryIndex={{}} />)
    // No rivalry row rendered, back to empty state implicitly (the loop maps to null)
    expect(screen.queryByText('Some cause')).toBeNull()
  })
})
