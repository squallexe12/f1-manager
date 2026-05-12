import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpcomingMediaWidget } from '@/components/paddock/UpcomingMediaWidget'
import { useGameStore } from '@/stores/game-store'
import { _internal } from '@/engine/media/press-engine'
import { initializeGame } from '@/engine/core/state-manager'
import { buildPressEvent } from '@/engine/media/press-engine'
import { createPRNG } from '@/engine/core/prng'
import minimalBank from '../../fixtures/media/minimal-bank.json'
import type { PressQuestion, PressTranscript } from '@/types/media'

// Stub CSS import from PressRoomModal (transitively required)
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

function worldWithPendingPress(teamId = 'mclaren') {
  const world = initializeGame(teamId, 'rebuild', 42)
  const rng = createPRNG(1)
  const pressEvent = buildPressEvent(world, 'thursday-fia', rng)
  return {
    ...world,
    media: { ...world.media, pendingPress: pressEvent },
  }
}

function worldWithLastTranscript(teamId = 'mclaren') {
  const world = initializeGame(teamId, 'rebuild', 42)
  const transcript: PressTranscript = {
    eventId: 'evt-001',
    surface: 'post-race',
    round: 1,
    season: 2026,
    speakerLabel: 'Lando Norris',
    speakerDriverId: 'norris',
    exchanges: [
      {
        question: 'How did the race go?',
        answer: 'We had a great strategy today.',
        tone: 'diplomatic',
      },
    ],
    aggregateDelta: { driverMood: 2, prestige: 1 },
  }
  return {
    ...world,
    media: { ...world.media, pendingPress: null, transcripts: [transcript] },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('<UpcomingMediaWidget>', () => {
  // Test 1: Pending state renders speaker name and CTA button
  it('renders speaker name and Enter Press Room CTA when a press is pending', () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    render(<UpcomingMediaWidget />)

    // The CTA must be present
    expect(
      screen.getByRole('button', { name: /Enter Press Room/i }),
    ).toBeInTheDocument()

    // The speaker label must appear (exact name depends on PRNG selection)
    // Assert that some non-empty speaker text is rendered — the widget always
    // renders a media-widget__speaker element in pending mode.
    const speakerEl = document.querySelector('.media-widget__speaker')
    expect(speakerEl).not.toBeNull()
    expect(speakerEl!.textContent!.trim().length).toBeGreaterThan(0)
  })

  // Test 2: No-pending + last transcript renders the last transcript headline
  it('renders last transcript excerpt when there is no pending press', () => {
    const world = worldWithLastTranscript()
    useGameStore.setState({ world })

    render(<UpcomingMediaWidget />)

    // CTA button must NOT be present
    expect(
      screen.queryByRole('button', { name: /Enter Press Room/i }),
    ).toBeNull()

    // The last exchange answer should appear as a quoted excerpt
    expect(screen.getByText(/We had a great strategy today\./)).toBeInTheDocument()

    // "Last Press" heading
    expect(screen.getByText('Last Press')).toBeInTheDocument()
  })

  // Test 3: Empty state renders placeholder when no press events at all
  it('renders placeholder text when no pending press and no transcripts', () => {
    const world = initializeGame('mclaren', 'rebuild', 42)
    // Fresh world — no pending press, no transcripts
    expect(world.media.pendingPress).toBeNull()
    expect(world.media.transcripts).toHaveLength(0)
    useGameStore.setState({ world })

    render(<UpcomingMediaWidget />)

    expect(
      screen.getByText(/No press conferences yet this season\./i),
    ).toBeInTheDocument()
  })

  // Test 4: Clicking Enter Press Room opens the modal (dialog role appears)
  it('clicking Enter Press Room opens the PressRoomModal', () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    render(<UpcomingMediaWidget />)

    // Modal must NOT be open initially
    expect(screen.queryByRole('dialog')).toBeNull()

    // Click the CTA
    fireEvent.click(screen.getByRole('button', { name: /Enter Press Room/i }))

    // Modal dialog should now be in the DOM
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // Test 5: Skipped transcript renders "Press conference skipped" text
  it('renders "Press conference skipped" when last transcript has no exchanges', () => {
    const world = initializeGame('mclaren', 'rebuild', 42)
    const transcript: PressTranscript = {
      eventId: 'evt-skip',
      surface: 'thursday-fia',
      round: 1,
      season: 2026,
      speakerLabel: 'Team Principal',
      speakerDriverId: null,
      exchanges: [], // skipped
      aggregateDelta: {},
    }
    useGameStore.setState({
      world: {
        ...world,
        media: { ...world.media, pendingPress: null, transcripts: [transcript] },
      },
    })

    render(<UpcomingMediaWidget />)

    expect(screen.getByText(/Press conference skipped\./i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// PressBadge quick tests (inline — lightweight)
// ---------------------------------------------------------------------------

import { PressBadge } from '@/components/nav/PressBadge'

describe('<PressBadge>', () => {
  it('renders null when there is no pending press', () => {
    const world = initializeGame('mclaren', 'rebuild', 42)
    expect(world.media.pendingPress).toBeNull()
    useGameStore.setState({ world })

    const { container } = render(<PressBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the badge link when a press is pending', () => {
    const world = worldWithPendingPress()
    useGameStore.setState({ world })

    render(<PressBadge />)

    const link = screen.getByRole('link', { name: /Press conference pending/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/paddock')

    // Badge text elements present
    expect(screen.getByText('Press')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
