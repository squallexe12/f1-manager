import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PracticeDriverCommands } from '@/components/strategy/practice-driver-commands'
import type { TireCompound } from '@/types/race'
import type { PracticeStatus } from '@/stores/practice-runtime-slice'

const COMPOUNDS = ['C2', 'C3', 'C4'] as TireCompound[]

function setup(status: PracticeStatus = 'idle') {
  const onSelectRunPlan = vi.fn()
  const onSelectTire = vi.fn()
  const onSendLap = vi.fn()
  const onAbortLap = vi.fn()
  render(
    <PracticeDriverCommands
      driverId="norris"
      driverName="Lando Norris"
      program={null}
      compound={null}
      circuitCompounds={COMPOUNDS}
      setsByCompound={{ C2: 3, C3: 4, C4: 1 }}
      status={status}
      onSelectRunPlan={onSelectRunPlan}
      onSelectTire={onSelectTire}
      onSendLap={onSendLap}
      onAbortLap={onAbortLap}
    />,
  )
  return { onSelectRunPlan, onSelectTire, onSendLap, onAbortLap }
}

describe('PracticeDriverCommands', () => {
  it('fires run-plan and tire selection in the PLAN phase', () => {
    const { onSelectRunPlan, onSelectTire } = setup('idle')
    fireEvent.click(screen.getByRole('button', { name: /Race Pace/i }))
    expect(onSelectRunPlan).toHaveBeenCalledWith('norris', 'race-pace')
    fireEvent.click(screen.getByRole('button', { name: /HARD compound/i }))
    expect(onSelectTire).toHaveBeenCalledWith('norris', 'C2')
  })

  it('disables run-plan / tire selection once the session is live', () => {
    setup('running')
    expect(screen.getByRole('button', { name: /Race Pace/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /HARD compound/i })).toBeDisabled()
  })

  it('disables a tire with zero sets remaining', () => {
    const onSelectTire = vi.fn()
    render(
      <PracticeDriverCommands
        driverId="norris"
        driverName="Lando Norris"
        program={null}
        compound={null}
        circuitCompounds={COMPOUNDS}
        setsByCompound={{ C2: 3, C3: 4, C4: 0 }}
        status="idle"
        onSelectRunPlan={vi.fn()}
        onSelectTire={onSelectTire}
        onSendLap={vi.fn()}
        onAbortLap={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /SOFT compound/i })).toBeDisabled()
  })

  it('disables the live nudges (SEND LAP / ABORT) while idle', () => {
    setup('idle')
    expect(screen.getByRole('button', { name: 'Send Lap' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Abort' })).toBeDisabled()
  })

  it('fires SEND LAP and ABORT when the session is running', () => {
    const { onSendLap, onAbortLap } = setup('running')
    const send = screen.getByRole('button', { name: 'Send Lap' })
    const abort = screen.getByRole('button', { name: 'Abort' })
    expect(send).toBeEnabled()
    expect(abort).toBeEnabled()
    fireEvent.click(send)
    expect(onSendLap).toHaveBeenCalledWith('norris')
    fireEvent.click(abort)
    expect(onAbortLap).toHaveBeenCalledWith('norris')
  })

  it('exposes keyboard-operable native buttons and removes disabled ones from activation', () => {
    setup('idle')
    const runPlan = screen.getByRole('button', { name: /Race Pace/i })
    // Native <button> → Enter/Space activation is provided by the platform; here
    // we assert it is focusable (in the tab order) and a real button element.
    runPlan.focus()
    expect(runPlan).toHaveFocus()
    expect(runPlan.tagName).toBe('BUTTON')
    // The idle-phase live nudge is disabled → not keyboard-activatable.
    const send = screen.getByRole('button', { name: 'Send Lap' })
    expect(send).toBeDisabled()
    send.focus()
    expect(send).not.toHaveFocus()
  })
})
