import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QualiTimingTower } from '@/components/strategy/quali-timing-tower'

type Entry = Parameters<typeof QualiTimingTower>[0]['entries'][number]

function entry(over: Partial<Entry> = {}): Entry {
  return {
    position: 1,
    driverId: 'd1',
    code: 'NOR',
    driverName: 'Lando Norris',
    teamColor: '#ff8000',
    isPlayer: false,
    bestLapTime: 88.123,
    sectors: { s1: 28.111, s2: 30.222, s3: 29.79 },
    tire: 'SOFT',
    eliminated: false,
    isBelowCutline: false,
    ...over,
  }
}

/** Build N entries with ascending positions and distinct driver ids. */
function grid(n: number, over: (i: number) => Partial<Entry> = () => ({})): Entry[] {
  return Array.from({ length: n }, (_, i) =>
    entry({
      position: i + 1,
      driverId: `d${i + 1}`,
      code: `D${i + 1}`,
      driverName: `Driver ${i + 1}`,
      ...over(i),
    }),
  )
}

describe('QualiTimingTower', () => {
  it('renders S1 / S2 / S3 sector column headers', () => {
    render(<QualiTimingTower entries={[entry()]} cutlinePosition={0} />)
    const headers = screen.getAllByRole('columnheader')
    const labels = headers.map((h) => h.textContent)
    expect(labels).toContain('S1')
    expect(labels).toContain('S2')
    expect(labels).toContain('S3')
  })

  it('renders all three sector times when sectors are present', () => {
    render(
      <QualiTimingTower
        entries={[entry({ sectors: { s1: 28.111, s2: 30.222, s3: 29.79 } })]}
        cutlinePosition={0}
      />,
    )
    expect(screen.getByText('28.111')).toBeInTheDocument()
    expect(screen.getByText('30.222')).toBeInTheDocument()
    expect(screen.getByText('29.790')).toBeInTheDocument()
  })

  it('shows a dash in every sector cell when sectors are null', () => {
    render(
      <QualiTimingTower
        entries={[entry({ sectors: null, bestLapTime: null })]}
        cutlinePosition={0}
      />,
    )
    // 3 sector dashes + 1 BEST dash = at least 3.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })

  it('renders the best lap time formatted as m:ss.mmm', () => {
    render(<QualiTimingTower entries={[entry({ bestLapTime: 88.123 })]} cutlinePosition={0} />)
    expect(screen.getByText('1:28.123')).toBeInTheDocument()
  })

  it('renders an OUT badge for an eliminated entry (non-color cue)', () => {
    render(
      <QualiTimingTower
        entries={[entry({ position: 16, eliminated: true })]}
        cutlinePosition={0}
      />,
    )
    expect(screen.getByText('OUT')).toBeInTheDocument()
  })

  it('renders exactly one ELIMINATION ZONE separator after the cutline row', () => {
    render(<QualiTimingTower entries={grid(20)} cutlinePosition={15} />)
    const separators = screen.getAllByRole('separator')
    expect(separators).toHaveLength(1)
    expect(within(separators[0]).getByText(/ELIMINATION ZONE/i)).toBeInTheDocument()
    // Names the first eliminated position (cutline + 1).
    expect(separators[0].textContent).toMatch(/P16/)
  })

  it('keeps the cutline separator OUT of a live region and announces the zone via a stable status node', () => {
    render(<QualiTimingTower entries={grid(20)} cutlinePosition={15} />)
    // The visual separator must NOT carry aria-live — it re-renders / moves on
    // every reorder, so a live region there would spam screen readers.
    expect(screen.getByRole('separator')).not.toHaveAttribute('aria-live')
    // A single stable sr-only status announces the elimination zone instead.
    expect(screen.getByRole('status')).toHaveTextContent(/Elimination zone: P16/i)
  })

  it('renders NO separator in the final segment (cutlinePosition = 0)', () => {
    render(<QualiTimingTower entries={grid(10)} cutlinePosition={0} />)
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('renders NO separator when no rows fall below the cutline', () => {
    // cutline at the very last position → nothing is below it.
    render(<QualiTimingTower entries={grid(15)} cutlinePosition={15} />)
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('highlights the leader (P1) with the lime accent class', () => {
    render(<QualiTimingTower entries={[entry({ position: 1, driverName: 'Lando Norris' })]} cutlinePosition={0} />)
    const pos = screen.getByText('1')
    expect(pos.className).toMatch(/accent-lime/)
  })

  it('renders a table role with one row per entry', () => {
    render(<QualiTimingTower entries={grid(16)} cutlinePosition={0} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    // 16 data rows + 1 header row.
    expect(screen.getAllByRole('row')).toHaveLength(17)
  })
})
