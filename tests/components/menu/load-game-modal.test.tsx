import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { LoadGameModal } from '@/components/menu/load-game-modal'
import { SCHEMA_VERSION, type SlotInfo } from '@/engine/core/save-system'

// --- Controllable mocks ---
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

let mockWorld: unknown = null
vi.mock('@/stores/game-store', () => ({
  useGameStore: { getState: () => ({ world: mockWorld }) },
}))

let slots: SlotInfo[] = []
const loadGame = vi.fn(async () => {
  mockWorld = { loaded: true } // a successful load swaps in a fresh world reference
})
const deleteSave = vi.fn(async (slotId: string) => {
  slots = slots.filter((s) => s.slotId !== slotId)
})
const listSaves = vi.fn(async () => slots)
let lastError: string | null = null

vi.mock('@/hooks/use-save-game', () => ({
  useSaveGame: () => ({
    listSaves,
    loadGame,
    deleteSave,
    status: { isSaving: false, isLoading: false, lastAction: null, lastError },
  }),
}))

function slot(over: Partial<SlotInfo> = {}): SlotInfo {
  return { slotId: 'slot-1', name: 'Imola GP', timestamp: Date.now(), schemaVersion: SCHEMA_VERSION, ...over }
}

describe('LoadGameModal', () => {
  beforeEach(() => {
    push.mockClear()
    loadGame.mockClear()
    deleteSave.mockClear()
    listSaves.mockClear()
    mockWorld = null
    lastError = null
    slots = []
  })

  it('renders nothing when closed', () => {
    const { container } = render(<LoadGameModal open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the empty state when there are no saves', async () => {
    await act(async () => {
      render(<LoadGameModal open onClose={vi.fn()} />)
    })
    expect(await screen.findByText(/No saved games yet/i)).toBeInTheDocument()
  })

  it('lists saves with an Auto badge for the auto-save slot', async () => {
    slots = [slot({ slotId: 'auto-save', name: 'Autosave' })]
    await act(async () => {
      render(<LoadGameModal open onClose={vi.fn()} />)
    })
    expect(await screen.findByText('Autosave')).toBeInTheDocument()
    expect(screen.getByText('Auto')).toBeInTheDocument()
  })

  it('loads a slot and navigates to /paddock on success', async () => {
    const onClose = vi.fn()
    slots = [slot()]
    await act(async () => {
      render(<LoadGameModal open onClose={onClose} />)
    })
    const loadBtn = await screen.findByRole('button', { name: 'Load' })
    await act(async () => {
      fireEvent.click(loadBtn)
    })
    expect(loadGame).toHaveBeenCalledWith('slot-1')
    expect(push).toHaveBeenCalledWith('/paddock')
    expect(onClose).toHaveBeenCalled()
  })

  it('requires confirmation before deleting', async () => {
    slots = [slot()]
    await act(async () => {
      render(<LoadGameModal open onClose={vi.fn()} />)
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Delete Imola GP/i }))
    })
    expect(deleteSave).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    })
    expect(deleteSave).toHaveBeenCalledWith('slot-1')
  })

  it('disables Load for a save from a newer build', async () => {
    slots = [slot({ schemaVersion: SCHEMA_VERSION + 1 })]
    await act(async () => {
      render(<LoadGameModal open onClose={vi.fn()} />)
    })
    expect(await screen.findByText(/newer build/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load' })).toBeDisabled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    await act(async () => {
      render(<LoadGameModal open onClose={onClose} />)
    })
    await waitFor(() => expect(listSaves).toHaveBeenCalled())
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalled()
  })
})
