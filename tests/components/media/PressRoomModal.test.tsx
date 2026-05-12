import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { PressRoomModal } from '@/components/media/PressRoomModal'
import { useGameStore } from '@/stores/game-store'
import { _internal } from '@/engine/media/press-engine'
import { initializeGame } from '@/engine/core/state-manager'
import { buildPressEvent } from '@/engine/media/press-engine'
import { createPRNG } from '@/engine/core/prng'
import minimalBank from '../../fixtures/media/minimal-bank.json'
import type { PressQuestion } from '@/types/media'

// CSS import in PressRoomModal triggers an import error in jsdom — stub it.
vi.mock('@/styles/media.css', () => ({}))

const bank = minimalBank as PressQuestion[]

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  _internal._setBankForTests(bank)
  useGameStore.setState({ world: null })
})

afterEach(() => {
  _internal._resetBankForTests()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a world with a pending press event injected. */
function worldWithPendingPress(teamId = 'mclaren', speakerKind: 'driver' | 'team-principal' = 'driver') {
  const world = initializeGame(teamId, 'rebuild', 42)
  const rng = createPRNG(1)
  const pressEvent = buildPressEvent(world, 'thursday-fia', rng)
  // Ensure speakerKind matches what we want for the test
  const event = { ...pressEvent, speakerKind }
  return {
    ...world,
    media: { ...world.media, pendingPress: event },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('<PressRoomModal>', () => {
  it('renders null when isOpen is false', () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    const { container } = render(
      <PressRoomModal isOpen={false} onClose={() => {}} />,
    )
    // Nothing rendered
    expect(container.firstChild).toBeNull()
  })

  it('renders null when there is no pending press event', () => {
    const world = initializeGame('mclaren', 'rebuild', 42)
    // media.pendingPress should be null after a fresh initializeGame (before advancing phase)
    expect(world.media.pendingPress).toBeNull()
    useGameStore.setState({ world })

    const { container } = render(
      <PressRoomModal isOpen={true} onClose={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders speaker name when a driver is the speaker', async () => {
    const world = initializeGame('mclaren', 'rebuild', 42)
    const rng = createPRNG(1)
    const pressEvent = buildPressEvent(world, 'thursday-fia', rng)
    // press event generated — speaker should be the highest-narrative driver
    useGameStore.setState({
      world: { ...world, media: { ...world.media, pendingPress: pressEvent } },
    })

    render(<PressRoomModal isOpen={true} onClose={() => {}} />)

    // The speaker label should appear somewhere in the modal.
    // We don't know the exact name but it must be a non-empty string other than 'Team Principal'
    // when a driver is assigned.
    if (pressEvent.speakerKind === 'driver' && pressEvent.speakerDriverId) {
      const driver = world.drivers.find(d => d.id === pressEvent.speakerDriverId)
      if (driver) {
        const fullName = `${driver.firstName} ${driver.lastName}`
        expect(screen.getByText(fullName)).toBeInTheDocument()
      }
    }
    // Modal dialog is rendered
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders "Team Principal" speaker label when speakerKind is team-principal', () => {
    const world = worldWithPendingPress('mclaren', 'team-principal')
    // Override speakerDriverId to undefined so hook resolves TP label
    const tpWorld = {
      ...world,
      media: {
        ...world.media,
        pendingPress: {
          ...world.media.pendingPress!,
          speakerKind: 'team-principal' as const,
          speakerDriverId: undefined,
        },
      },
    }
    useGameStore.setState({ world: tpWorld })

    render(<PressRoomModal isOpen={true} onClose={() => {}} />)

    // Both press-speaker__name and press-speaker__role render "Team Principal"
    // when no driver is assigned — use getAllByText and assert at least one match.
    const tpLabels = screen.getAllByText('Team Principal')
    expect(tpLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('shows the progress dots for the correct question count', () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    render(<PressRoomModal isOpen={true} onClose={() => {}} />)

    const dotsGroup = screen.getByRole('group')
    expect(dotsGroup).toBeInTheDocument()
    const dots = dotsGroup.querySelectorAll('.press-dot')
    // buildPressEvent picks EVENT_QUESTION_COUNT (3) questions
    expect(dots.length).toBe(3)
  })

  it('clicking an answer auto-advances the active question dot after the timeout', async () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    render(<PressRoomModal isOpen={true} onClose={() => {}} />)

    // Find the first answer card button and click it
    const answerButtons = screen.getAllByRole('button').filter(
      b => b.classList.contains('press-answer'),
    )
    expect(answerButtons.length).toBeGreaterThan(0)

    fireEvent.click(answerButtons[0])

    // Wait for the 200ms setTimeout to fire
    await waitFor(
      () => {
        const dotsGroup = screen.getByRole('group')
        // The second dot (index 1) should now be active
        const dots = dotsGroup.querySelectorAll('.press-dot')
        if (dots.length >= 2) {
          expect(dots[1]).toHaveClass('press-dot--active')
        }
      },
      { timeout: 500 },
    )
  })

  it('shows the submit button after all questions are answered', async () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    render(<PressRoomModal isOpen={true} onClose={() => {}} />)

    const totalQuestions = world.media.pendingPress!.questions.length

    // Answer each question in sequence
    for (let q = 0; q < totalQuestions; q++) {
      const answerButtons = screen.getAllByRole('button').filter(
        b => b.classList.contains('press-answer'),
      )
      fireEvent.click(answerButtons[0])

      if (q < totalQuestions - 1) {
        // Wait for auto-advance
        await waitFor(
          () => {
            const dotsGroup = screen.getByRole('group')
            const activeDot = dotsGroup.querySelector(`.press-dot--active[aria-current="step"]`)
            // The active dot should now be at index q+1
            const dots = Array.from(dotsGroup.querySelectorAll('.press-dot'))
            const activeIdx = dots.findIndex(d => d.classList.contains('press-dot--active'))
            expect(activeIdx).toBe(q + 1)
          },
          { timeout: 500 },
        )
      }
    }

    // Submit button should now be visible
    expect(screen.getByRole('button', { name: /Submit Responses/i })).toBeInTheDocument()
  })

  it('Escape key fires onClose and does NOT call resolve or skip', () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    const onClose = vi.fn()
    render(<PressRoomModal isOpen={true} onClose={onClose} />)

    // Spy on the store's resolvePress and skipPress
    const resolveSpy = vi.spyOn(useGameStore.getState(), 'resolvePress')
    const skipSpy = vi.spyOn(useGameStore.getState(), 'skipPress')

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(resolveSpy).not.toHaveBeenCalled()
    expect(skipSpy).not.toHaveBeenCalled()
  })

  it('has role="dialog" and aria-modal="true"', () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    render(<PressRoomModal isOpen={true} onClose={() => {}} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
