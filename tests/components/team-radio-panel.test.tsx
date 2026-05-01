import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TeamRadioPanel } from '@/components/strategy/team-radio-panel'
import type { CommentaryEntry } from '@/types/race'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENGINEER_TO_NORRIS: CommentaryEntry = {
  lap: 12,
  text: 'Box, box, box this lap.',
  severity: 'radio',
  speaker: 'engineer',
  driverId: 'norris',
  teamId: 'mclaren',
  category: 'box_box',
  tone: 'urgent',
  isPlayerTeam: true,
}

const DRIVER_NORRIS: CommentaryEntry = {
  lap: 12,
  text: 'Copy, in this lap.',
  severity: 'radio',
  speaker: 'driver',
  driverId: 'norris',
  teamId: 'mclaren',
  category: 'pit_confirm',
  tone: 'flat',
  isPlayerTeam: true,
}

const FIA_INVESTIGATION: CommentaryEntry = {
  lap: 23,
  text: 'Incident involving car 81 under investigation.',
  severity: 'radio',
  speaker: 'fia',
  category: 'investigation',
  tone: 'flat',
  isPlayerTeam: false,
}

const RIVAL_DRIVER: CommentaryEntry = {
  lap: 30,
  text: 'These tyres are gone, mate.',
  severity: 'radio',
  speaker: 'driver',
  driverId: 'verstappen',
  teamId: 'red-bull',
  category: 'tire_complaint',
  tone: 'angry',
  isPlayerTeam: false,
}

// Non-radio entry should be filtered out at the panel boundary.
const NEUTRAL_NON_RADIO: CommentaryEntry = {
  lap: 5,
  text: 'Lap 5 of 56 — pace settling.',
  severity: 'neutral',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TeamRadioPanel', () => {
  it('renders the empty state when no entries are provided', () => {
    render(<TeamRadioPanel entries={[]} playerTeamId="mclaren" />)
    expect(screen.getByText(/Standing by/i)).toBeInTheDocument()
    // Header label is always present
    expect(screen.getByText(/Team Radio/i)).toBeInTheDocument()
  })

  it('renders the empty state when only non-radio commentary is supplied', () => {
    render(
      <TeamRadioPanel entries={[NEUTRAL_NON_RADIO]} playerTeamId="mclaren" />,
    )
    expect(screen.getByText(/Standing by/i)).toBeInTheDocument()
    // The neutral text must NOT leak into the panel
    expect(screen.queryByText(/Lap 5 of 56/)).not.toBeInTheDocument()
  })

  it('renders speaker pills for engineer, driver, and FIA entries', () => {
    render(
      <TeamRadioPanel
        entries={[ENGINEER_TO_NORRIS, DRIVER_NORRIS, FIA_INVESTIGATION]}
        playerTeamId="mclaren"
      />,
    )
    const log = screen.getByRole('log')

    // Engineer pill: "ENG → NOR"
    expect(within(log).getByText(/ENG\s*→\s*NOR/)).toBeInTheDocument()
    // Driver pill: "NOR" — present at least once for the driver row
    const driverPills = within(log).getAllByText('NOR')
    expect(driverPills.length).toBeGreaterThanOrEqual(1)
    // FIA pill — scoped into the log so the "RACE CONTROL" filter chip
    // (rendered in the header) does not collide with the speaker label.
    expect(within(log).getByText('RACE CONTROL')).toBeInTheDocument()
  })

  it('renders the transmission text for each radio entry', () => {
    render(
      <TeamRadioPanel
        entries={[ENGINEER_TO_NORRIS, DRIVER_NORRIS, FIA_INVESTIGATION]}
        playerTeamId="mclaren"
      />,
    )

    expect(screen.getByText('Box, box, box this lap.')).toBeInTheDocument()
    expect(screen.getByText('Copy, in this lap.')).toBeInTheDocument()
    expect(
      screen.getByText('Incident involving car 81 under investigation.'),
    ).toBeInTheDocument()
  })

  it('exposes the scroll region with role=log and aria-live=polite', () => {
    render(
      <TeamRadioPanel
        entries={[ENGINEER_TO_NORRIS]}
        playerTeamId="mclaren"
      />,
    )
    const log = screen.getByRole('log')
    expect(log).toHaveAttribute('aria-live', 'polite')
  })

  it('MY TEAM filter hides non-player entries', () => {
    render(
      <TeamRadioPanel
        entries={[ENGINEER_TO_NORRIS, RIVAL_DRIVER, FIA_INVESTIGATION]}
        playerTeamId="mclaren"
      />,
    )

    // Default ALL — all three texts visible
    expect(screen.getByText('Box, box, box this lap.')).toBeInTheDocument()
    expect(screen.getByText('These tyres are gone, mate.')).toBeInTheDocument()
    expect(
      screen.getByText('Incident involving car 81 under investigation.'),
    ).toBeInTheDocument()

    // Switch to MY TEAM
    fireEvent.click(screen.getByRole('button', { name: /my team only/i }))

    // Player-team radio still there
    expect(screen.getByText('Box, box, box this lap.')).toBeInTheDocument()
    // Rival + FIA gone
    expect(screen.queryByText('These tyres are gone, mate.')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Incident involving car 81 under investigation.'),
    ).not.toBeInTheDocument()
  })

  it('RACE CONTROL filter shows only FIA entries', () => {
    render(
      <TeamRadioPanel
        entries={[ENGINEER_TO_NORRIS, RIVAL_DRIVER, FIA_INVESTIGATION]}
        playerTeamId="mclaren"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /race control only/i }))

    // FIA entry visible
    expect(
      screen.getByText('Incident involving car 81 under investigation.'),
    ).toBeInTheDocument()
    // Engineer + rival gone
    expect(screen.queryByText('Box, box, box this lap.')).not.toBeInTheDocument()
    expect(screen.queryByText('These tyres are gone, mate.')).not.toBeInTheDocument()
  })

  it('ALL filter restores every radio entry after switching back', () => {
    render(
      <TeamRadioPanel
        entries={[ENGINEER_TO_NORRIS, RIVAL_DRIVER, FIA_INVESTIGATION]}
        playerTeamId="mclaren"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /my team only/i }))
    fireEvent.click(screen.getByRole('button', { name: /all radio messages/i }))

    expect(screen.getByText('Box, box, box this lap.')).toBeInTheDocument()
    expect(screen.getByText('These tyres are gone, mate.')).toBeInTheDocument()
    expect(
      screen.getByText('Incident involving car 81 under investigation.'),
    ).toBeInTheDocument()
  })

  it('marks the active filter chip via aria-pressed', () => {
    render(
      <TeamRadioPanel
        entries={[ENGINEER_TO_NORRIS]}
        playerTeamId="mclaren"
      />,
    )

    const allChip = screen.getByRole('button', { name: /all radio messages/i })
    const myTeamChip = screen.getByRole('button', { name: /my team only/i })

    expect(allChip).toHaveAttribute('aria-pressed', 'true')
    expect(myTeamChip).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(myTeamChip)

    expect(allChip).toHaveAttribute('aria-pressed', 'false')
    expect(myTeamChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders the structural log container with at least one entry row when entries exist', () => {
    render(
      <TeamRadioPanel
        entries={[ENGINEER_TO_NORRIS, FIA_INVESTIGATION]}
        playerTeamId="mclaren"
      />,
    )

    const log = screen.getByRole('log')
    // Empty-state paragraph must NOT be present when entries exist
    expect(within(log).queryByText(/Standing by/i)).not.toBeInTheDocument()
    // Entry text is present inside the log
    expect(within(log).getByText('Box, box, box this lap.')).toBeInTheDocument()
  })
})
