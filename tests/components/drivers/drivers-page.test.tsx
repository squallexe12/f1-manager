import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import DriversPage from '@/app/drivers/page'
import { useGameStore } from '@/stores/game-store'

// PageShell renders NavBar which calls useRouter() — not available in jsdom.
// Stub it to just render children so the smoke test stays focused on page logic.
vi.mock('@/components/layout/page-shell', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('DriversPage smoke', () => {
  beforeEach(() => {
    useGameStore.setState({ world: null })
  })

  it('renders without crashing for a fixture world', async () => {
    await act(async () => {
      useGameStore.getState().initGame('mclaren', 'golden-era', 42)
    })
    await act(async () => {
      render(<DriversPage />)
    })
    expect(screen.getByText('Driver Command')).toBeInTheDocument()
  })

  it('switches tab to scout pool on click', async () => {
    await act(async () => {
      useGameStore.getState().initGame('mclaren', 'golden-era', 42)
    })
    await act(async () => {
      render(<DriversPage />)
    })
    // Click the SCOUT POOL tab (the t-name span inside DriverTabs)
    const scoutTab = screen.getAllByText(/SCOUT POOL/i)[0]
    fireEvent.click(scoutTab.closest('button')!)
    // ScoutPanel header renders "Scout Pool" (mixed case)
    expect(screen.getByText('Scout Pool')).toBeInTheDocument()
  })

  it('clicking Approach on a free agent opens the modal', async () => {
    await act(async () => {
      useGameStore.getState().initGame('mclaren', 'golden-era', 42)
    })
    await act(async () => {
      render(<DriversPage />)
    })
    // Switch to SCOUT POOL tab
    const scoutTab = screen.getAllByText(/SCOUT POOL/i)[0]
    fireEvent.click(scoutTab.closest('button')!)
    // Click first Approach button
    const approachButtons = screen.getAllByText('Approach')
    fireEvent.click(approachButtons[0])
    // Modal should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
