import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
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
})
