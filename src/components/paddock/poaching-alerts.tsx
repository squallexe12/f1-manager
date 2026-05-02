'use client'

import type { PoachingAttempt, PitCrewChief, PitCrewMember } from '@/types/staff'
import type { Team } from '@/types/team'

interface PoachingAlertsProps {
  attempts: PoachingAttempt[]
  teams: Team[]
  playerTeamId: string
  onMatch: (attemptId: string) => void
  onDecline: (attemptId: string) => void
}

function formatSalary(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  return `$${(amount / 1000).toFixed(0)}k`
}

function findTargetStaff(
  team: Team,
  staffId: string,
): PitCrewChief | PitCrewMember | null {
  if (team.pitCrewChief && team.pitCrewChief.id === staffId) return team.pitCrewChief
  return team.pitCrewMembers.find((m) => m.id === staffId) ?? null
}

function staffName(staff: PitCrewChief | PitCrewMember): string {
  return `${staff.firstName} ${staff.lastName}`
}

const ROLE_LABELS: Record<string, string> = {
  chief: 'Pit Crew Chief',
  'lollipop': 'Lollipop',
  'front-jack': 'Front Jack',
  'rear-jack': 'Rear Jack',
  'wheel-off-front': 'Wheel-Off Front',
  'wheel-on-front': 'Wheel-On Front',
  'wheel-off-rear': 'Wheel-Off Rear',
  'wheel-on-rear': 'Wheel-On Rear',
}

export function PoachingAlerts({
  attempts,
  teams,
  playerTeamId,
  onMatch,
  onDecline,
}: PoachingAlertsProps) {
  const open = attempts.filter((a) => a.status === 'open')
  if (open.length === 0) return null

  const playerTeam = teams.find((t) => t.id === playerTeamId)
  if (!playerTeam) return null

  return (
    <div className="poaching-alerts">
      <div className="pa-header">
        <span className="pa-pulse" aria-hidden="true" />
        <span className="pa-title">Poaching Alert</span>
        <span className="pa-count">{open.length} OPEN</span>
      </div>
      <div className="pa-body">
        {open.map((attempt) => {
          const rival = teams.find((t) => t.id === attempt.rivalTeamId)
          const target = findTargetStaff(playerTeam, attempt.targetStaffId)
          if (!target) return null
          const currentSalary = target.contract.salary
          const offerDelta = attempt.offeredSalary - currentSalary
          return (
            <div key={attempt.id} className="pa-row">
              <div className="pa-row-info">
                <div className="pa-row-headline">
                  {rival?.name ?? attempt.rivalTeamId} are circling{' '}
                  <span className="pa-target">{staffName(target)}</span>
                </div>
                <div className="pa-row-meta">
                  {ROLE_LABELS[attempt.offeredRole] ?? attempt.offeredRole} · expires R{attempt.expiresOnRound}
                </div>
              </div>
              <div className="pa-row-numbers">
                <span className="pa-current">
                  Current {formatSalary(currentSalary)}
                </span>
                <span className="pa-offer">
                  Offer {formatSalary(attempt.offeredSalary)}
                  <span className="pa-delta">+{formatSalary(offerDelta)}</span>
                </span>
              </div>
              <div className="pa-row-actions">
                <button
                  type="button"
                  className="pa-match-btn"
                  onClick={() => onMatch(attempt.id)}
                >
                  Match
                </button>
                <button
                  type="button"
                  className="pa-decline-btn"
                  onClick={() => onDecline(attempt.id)}
                >
                  Decline
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
