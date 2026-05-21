import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ReleaseConfirmModal } from '@/components/drivers/release-confirm-modal'

const commit = vi.fn()
let release: Record<string, unknown> | null = null

vi.mock('@/hooks/use-driver-release', () => ({
  useDriverRelease: (driverId: string | null) => (driverId === null ? null : release),
}))

beforeEach(() => {
  commit.mockClear()
  release = {
    driver: { id: 'hamilton', firstName: 'Lewis', lastName: 'Hamilton', shortName: 'HAM', isReserve: false },
    severance: 30_000_000,
    fromReleaseClause: true,
    currentSalaries: 128_000_000,
    salariesAfter: 73_000_000,
    operationsBefore: 40_000_000,
    operationsAfter: 70_000_000,
    budgetCap: 215_000_000,
    capRisk: false,
    wouldLeaveOneRaceDriver: false,
    commit,
  }
})

describe('ReleaseConfirmModal', () => {
  it('renders nothing when driverId is null', () => {
    const { container } = render(<ReleaseConfirmModal driverId={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the driver name and severance figure', () => {
    render(<ReleaseConfirmModal driverId="hamilton" onClose={vi.fn()} />)
    expect(screen.getByText(/Lewis Hamilton/i)).toBeInTheDocument()
    expect(screen.getByText(/\$30M/)).toBeInTheDocument()
    expect(screen.getByText(/release clause/i)).toBeInTheDocument()
  })

  it('commits and shows the released state on confirm', () => {
    render(<ReleaseConfirmModal driverId="hamilton" onClose={vi.fn()} />)
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Confirm Release/i })) })
    expect(commit).toHaveBeenCalled()
    expect(screen.getByText(/Released/i)).toBeInTheDocument()
  })

  it('does not commit on Cancel and calls onClose', () => {
    const onClose = vi.fn()
    render(<ReleaseConfirmModal driverId="hamilton" onClose={onClose} />)
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Cancel/i })) })
    expect(commit).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('warns when releasing would leave one race driver', () => {
    release = { ...release!, wouldLeaveOneRaceDriver: true }
    render(<ReleaseConfirmModal driverId="hamilton" onClose={vi.fn()} />)
    expect(screen.getByText(/1 race driver/i)).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<ReleaseConfirmModal driverId="hamilton" onClose={onClose} />)
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(onClose).toHaveBeenCalled()
  })
})
