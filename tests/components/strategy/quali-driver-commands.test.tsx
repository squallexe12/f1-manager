import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QualiDriverCommands } from '@/components/strategy/quali-driver-commands'
import type { TireCompound } from '@/types/race'

type QualiPhase = 'idle' | 'running' | 'paused' | 'segment-end' | 'finished'

const COMPOUNDS = ['C2', 'C3', 'C4'] as TireCompound[]

function setup(
  sessionPhase: QualiPhase = 'idle',
  setsByCompound: Partial<Record<TireCompound, number>> = { C2: 3, C3: 4, C4: 1 },
  compound: TireCompound | null = null,
) {
  const onSelectTire = vi.fn()
  const onSendLap = vi.fn()
  const onAbortLap = vi.fn()
  render(
    <QualiDriverCommands
      driverId="norris"
      driverName="NOR"
      compound={compound}
      circuitCompounds={COMPOUNDS}
      setsByCompound={setsByCompound}
      sessionPhase={sessionPhase}
      onSelectTire={onSelectTire}
      onSendLap={onSendLap}
      onAbortLap={onAbortLap}
    />,
  )
  return { onSelectTire, onSendLap, onAbortLap }
}

describe('QualiDriverCommands', () => {
  afterEach(() => cleanup())

  it('renders the three compound buttons with positional labels and set counts', () => {
    setup('idle')
    const hard = screen.getByRole('button', { name: /HARD compound, 3 sets remaining/i })
    const med = screen.getByRole('button', { name: /MED compound, 4 sets remaining/i })
    const soft = screen.getByRole('button', { name: /SOFT compound, 1 sets remaining/i })
    expect(hard).toBeInTheDocument()
    expect(med).toBeInTheDocument()
    expect(soft).toBeInTheDocument()
    // Visible labels + set counts.
    expect(hard).toHaveTextContent('HARD')
    expect(med).toHaveTextContent('MED')
    expect(soft).toHaveTextContent('SOFT')
    expect(hard).toHaveTextContent('3')
    expect(med).toHaveTextContent('4')
    expect(soft).toHaveTextContent('1')
  })

  it('fires onSelectTire with the softest compound when SOFT is clicked', () => {
    const { onSelectTire } = setup('idle')
    fireEvent.click(screen.getByRole('button', { name: /SOFT compound/i }))
    expect(onSelectTire).toHaveBeenCalledWith('norris', 'C4')
  })

  it('disables a compound that has zero sets remaining', () => {
    setup('idle', { C2: 3, C3: 4, C4: 0 })
    expect(screen.getByRole('button', { name: /SOFT compound/i })).toBeDisabled()
  })

  it('locks the tire picker once the lap is live (running)', () => {
    setup('running')
    expect(screen.getByRole('button', { name: /HARD compound/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /MED compound/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /SOFT compound/i })).toBeDisabled()
  })

  it('disables SEND LAP while idle', () => {
    setup('idle')
    expect(screen.getByRole('button', { name: /Send lap for NOR/i })).toBeDisabled()
  })

  it('enables SEND LAP while running and fires onSendLap', () => {
    const { onSendLap } = setup('running')
    const send = screen.getByRole('button', { name: /Send lap for NOR/i })
    expect(send).toBeEnabled()
    fireEvent.click(send)
    expect(onSendLap).toHaveBeenCalledWith('norris')
  })

  it('fires onAbortLap when ABORT is clicked while running', () => {
    const { onAbortLap } = setup('running')
    const abort = screen.getByRole('button', { name: /Abort lap for NOR/i })
    expect(abort).toBeEnabled()
    fireEvent.click(abort)
    expect(onAbortLap).toHaveBeenCalledWith('norris')
  })

  it('disables ABORT while idle', () => {
    setup('idle')
    expect(screen.getByRole('button', { name: /Abort lap for NOR/i })).toBeDisabled()
  })

  it('marks the selected compound with aria-pressed=true and others false', () => {
    setup('idle', { C2: 3, C3: 4, C4: 1 }, 'C3')
    const med = screen.getByRole('button', { name: /MED compound/i })
    const hard = screen.getByRole('button', { name: /HARD compound/i })
    expect(med).toHaveAttribute('aria-pressed', 'true')
    expect(hard).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders native button elements and shows the driver code header', () => {
    setup('idle')
    expect(screen.getByText('NOR')).toBeInTheDocument()
    const soft = screen.getByRole('button', { name: /SOFT compound/i })
    expect(soft.tagName).toBe('BUTTON')
  })
})
