import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QualiClassificationReveal } from '@/components/strategy/quali-classification-reveal'

interface Row {
  position: number
  driverId: string
  code: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  bestTime: number | null
  isPole: boolean
  isFastest: boolean
}

const ROWS: Row[] = [
  {
    position: 1,
    driverId: 'norris',
    code: 'NOR',
    driverName: 'Lando Norris',
    teamColor: '#FF8000',
    isPlayer: true,
    bestTime: 78.123,
    isPole: true,
    isFastest: true,
  },
  {
    position: 2,
    driverId: 'verstappen',
    code: 'VER',
    driverName: 'Max Verstappen',
    teamColor: '#3671C6',
    isPlayer: false,
    bestTime: 78.456,
    isPole: false,
    isFastest: false,
  },
  {
    position: 3,
    driverId: 'leclerc',
    code: 'LEC',
    driverName: 'Charles Leclerc',
    teamColor: '#E80020',
    isPlayer: false,
    bestTime: null,
    isPole: false,
    isFastest: false,
  },
]

function setup(overrides: Partial<React.ComponentProps<typeof QualiClassificationReveal>> = {}) {
  const onConfirm = vi.fn()
  render(
    <QualiClassificationReveal
      rows={ROWS}
      pole={{ code: 'NOR', time: 78.123 }}
      fastest={{ code: 'NOR', time: 78.123 }}
      onConfirm={onConfirm}
      {...overrides}
    />,
  )
  return { onConfirm }
}

describe('QualiClassificationReveal', () => {
  it('renders the qualifying-result heading', () => {
    setup()
    expect(screen.getByText('QUALIFYING RESULT')).toBeInTheDocument()
  })

  it('renders the sprint heading when isSprint is true', () => {
    setup({ isSprint: true })
    expect(screen.getByText('SPRINT QUALIFYING RESULT')).toBeInTheDocument()
  })

  it('renders the pole callout with the pole code', () => {
    setup()
    // "POLE" and the code sit in sibling spans inside the callout strip.
    const label = screen.getByText('POLE')
    expect(label).toBeInTheDocument()
    expect(label.parentElement?.textContent).toMatch(/NOR/)
  })

  it('shows the formatted time for a pole row when bestTime is present', () => {
    setup()
    // 78.123s → 1:18.123 (m:ss.mmm)
    expect(screen.getAllByText('1:18.123').length).toBeGreaterThan(0)
  })

  it("shows 'NO TIME' for a row with a null bestTime", () => {
    setup()
    expect(screen.getByText('NO TIME')).toBeInTheDocument()
  })

  it("shows 'NO TIME' on the pole row when its bestTime is null", () => {
    const poleNoTime: Row[] = [
      { ...ROWS[0], bestTime: null },
      ROWS[1],
      ROWS[2],
    ]
    render(
      <QualiClassificationReveal
        rows={poleNoTime}
        pole={{ code: 'NOR', time: null }}
        fastest={null}
        onConfirm={vi.fn()}
      />,
    )
    // P1 (pole) row, P3 row, and the pole callout strip all report NO TIME.
    expect(screen.getAllByText('NO TIME').length).toBeGreaterThanOrEqual(2)
  })

  it('hides a callout whose value is null', () => {
    render(
      <QualiClassificationReveal
        rows={ROWS}
        pole={{ code: 'NOR', time: 78.123 }}
        fastest={null}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.queryByText(/FASTEST/i)).not.toBeInTheDocument()
    expect(screen.getByText(/POLE/i)).toBeInTheDocument()
  })

  it('calls onConfirm when the Confirm Grid button is clicked', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Confirm Grid/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('exposes a keyboard-operable native confirm button', () => {
    setup()
    const btn = screen.getByRole('button', { name: /Confirm Grid/i })
    btn.focus()
    expect(btn).toHaveFocus()
    expect(btn.tagName).toBe('BUTTON')
  })
})
