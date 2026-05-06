import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PenaltyCard } from '@/components/drivers/penalty-card'
import type { Driver, PenaltyPointEntry } from '@/types/driver'

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

const mkEntry = (points: number, offenceType: PenaltyPointEntry['offenceType'], issuedSeason: number, issuedRound: number, raceId = 'r1'): PenaltyPointEntry => ({
  points,
  offenceType,
  issuedSeason,
  issuedRound,
  raceId,
})

describe('<PenaltyCard>', () => {
  describe('clean state', () => {
    it('renders CLEAN RECORD when all indicators are zero', () => {
      render(<PenaltyCard driver={mkDriver()} currentSeason={2026} currentRound={8} />)
      expect(screen.getByText('CLEAN RECORD')).toBeInTheDocument()
      expect(screen.getByText('✓')).toBeInTheDocument()
    })
  })

  describe('warning band states', () => {
    it('renders "clean" band when points = 3', () => {
      const driver = mkDriver({
        penaltyPoints: [mkEntry(3, 'collision-serious', 2026, 5)],
      })
      const { container } = render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      // total = 3 → band = clean → first segment filled
      const segs = container.querySelectorAll('.penalty-seg.f')
      expect(segs.length).toBe(1)
    })

    it('renders "approaching" band when points = 6', () => {
      const driver = mkDriver({
        penaltyPoints: [mkEntry(3, 'collision-serious', 2026, 5), mkEntry(3, 'illegal-defending', 2026, 6)],
      })
      const { container } = render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      const segs = container.querySelectorAll('.penalty-seg.f')
      expect(segs.length).toBe(2)
    })

    it('renders "warning" band when points = 9', () => {
      const driver = mkDriver({
        penaltyPoints: [
          mkEntry(3, 'collision-serious', 2026, 3),
          mkEntry(3, 'illegal-defending', 2026, 4),
          mkEntry(3, 'pit-lane-speeding', 2026, 5),
        ],
      })
      const { container } = render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      const segs = container.querySelectorAll('.penalty-seg.f')
      expect(segs.length).toBe(3)
    })

    it('renders "critical" band when points >= 12', () => {
      const driver = mkDriver({
        penaltyPoints: [
          mkEntry(3, 'collision-serious', 2026, 2),
          mkEntry(3, 'illegal-defending', 2026, 3),
          mkEntry(3, 'pit-lane-speeding', 2026, 4),
          mkEntry(3, 'collision-minor', 2026, 5),
        ],
      })
      const { container } = render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      const segs = container.querySelectorAll('.penalty-seg.f')
      expect(segs.length).toBe(4)
      expect(screen.getByText('BAN PENDING')).toBeInTheDocument()
    })
  })

  describe('ban banner', () => {
    it('renders ban banner when banUntilRound is set', () => {
      const driver = mkDriver({
        penaltyPoints: [mkEntry(3, 'collision-serious', 2026, 5)],
        banUntilRound: 10,
      })
      render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      expect(screen.getByText(/BANNED · UNTIL R10/)).toBeInTheDocument()
    })

    it('does not render ban banner when banUntilRound is null', () => {
      const driver = mkDriver({
        penaltyPoints: [mkEntry(3, 'collision-serious', 2026, 5)],
        banUntilRound: null,
      })
      render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      expect(screen.queryByText(/BANNED/)).toBeNull()
    })
  })

  describe('grid-drop banner', () => {
    it('renders grid-drop warning when nextRaceGridDrop > 0', () => {
      const driver = mkDriver({
        penaltyPoints: [mkEntry(2, 'pit-lane-speeding', 2026, 5)],
        warningsThisSeason: 1,
        nextRaceGridDrop: 3,
      })
      render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      expect(screen.getByText(/−3 GRID PLACES/)).toBeInTheDocument()
    })
  })

  describe('entries sort order', () => {
    it('sorts entries newest first (higher round first)', () => {
      const driver = mkDriver({
        penaltyPoints: [
          mkEntry(1, 'forcing-off', 2026, 3, 'r1'),
          mkEntry(2, 'pit-lane-speeding', 2026, 5, 'r2'),
          mkEntry(3, 'collision-serious', 2026, 7, 'r3'),
        ],
      })
      const { container } = render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      const entries = container.querySelectorAll('.penalty-entry')
      // First entry should be from R07, second R05, third R03
      expect(entries[0].textContent).toContain('R07')
      expect(entries[1].textContent).toContain('R05')
      expect(entries[2].textContent).toContain('R03')
    })
  })

  describe('expiry round', () => {
    it('shows correct expiry round in entries', () => {
      const driver = mkDriver({
        penaltyPoints: [mkEntry(2, 'collision-serious', 2026, 5)],
      })
      render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      // R5 + 22 → expires S2027 R05
      expect(screen.getByText(/EXPIRES S2027 R05/)).toBeInTheDocument()
    })
  })

  describe('offence labels', () => {
    it('renders human-readable offence label', () => {
      const driver = mkDriver({
        penaltyPoints: [mkEntry(2, 'collision-serious', 2026, 5)],
      })
      render(<PenaltyCard driver={driver} currentSeason={2026} currentRound={8} />)
      expect(screen.getByText('Collision (serious)')).toBeInTheDocument()
    })
  })
})
