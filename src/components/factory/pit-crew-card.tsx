'use client'

import { useState } from 'react'
import type { PitCrewChief, PitCrewMember, PitCrewRole, StaffMarket } from '@/types/staff'
import { aggregateCrewRatings } from '@/engine/staff/pit-crew'
import { PIT_CREW_MEMBER_ROLES } from '@/types/staff'
import { StaffMarketModal } from './staff-market-modal'

interface PitCrewCardProps {
  chief: PitCrewChief | null
  members: PitCrewMember[]
  market: StaffMarket
  onHireChief: (staffId: string) => void
  onFireChief: () => void
  onHireMember: (staffId: string) => void
  onFireMember: (staffId: string) => void
}

const ROLE_LABELS: Record<PitCrewRole, string> = {
  'lollipop': 'Lollipop',
  'front-jack': 'Front Jack',
  'rear-jack': 'Rear Jack',
  'wheel-off-front': 'Wheel-Off Front',
  'wheel-on-front': 'Wheel-On Front',
  'wheel-off-rear': 'Wheel-Off Rear',
  'wheel-on-rear': 'Wheel-On Rear',
}

function initialsFor(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`
}

function formatSalary(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  return `$${(amount / 1000).toFixed(0)}k`
}

export function PitCrewCard({
  chief,
  members,
  market,
  onHireChief,
  onFireChief,
  onHireMember,
  onFireMember,
}: PitCrewCardProps) {
  const [marketOpen, setMarketOpen] = useState(false)
  const aggregates = aggregateCrewRatings(chief, members)
  const totalSalary =
    (chief?.contract.salary ?? 0) +
    members.reduce((s, m) => s + m.contract.salary, 0)

  return (
    <div className="fac-panel pc-card">
      <div className="pc-hero-strip">
        <div className="pc-hero-chief">
          {chief ? (
            <>
              <div className="pc-initials">{initialsFor(chief.firstName, chief.lastName)}</div>
              <div className="pc-chief-info">
                <span className="k">PIT-CREW CHIEF</span>
                <span className="v">{chief.firstName} {chief.lastName}</span>
                <span className="meta">{chief.nationality} · Age {chief.age}</span>
              </div>
            </>
          ) : (
            <>
              <div className="pc-initials empty">—</div>
              <div className="pc-chief-info">
                <span className="k">PIT-CREW CHIEF</span>
                <span className="v">No chief hired</span>
                <span className="meta">Open the market to recruit</span>
              </div>
            </>
          )}
        </div>
        <div className="pc-hero-aggs">
          <div className="pc-agg-row">
            <span className="k">RELEASE</span>
            <span className="v">{aggregates.release}</span>
          </div>
          <div className="pc-agg-row">
            <span className="k">SPEED DISC</span>
            <span className="v">{aggregates.speedDiscipline}</span>
          </div>
          <div className="pc-agg-row">
            <span className="k">SERVICE</span>
            <span className="v">{aggregates.serviceTime}</span>
          </div>
        </div>
      </div>
      <div className="fac-phead flush">
        <div className="t">Pit Crew Roster</div>
        <div className="s">{members.length}/{PIT_CREW_MEMBER_ROLES.length} HIRED</div>
      </div>
      <div className="pc-roster">
        {PIT_CREW_MEMBER_ROLES.map((role) => {
          const occupant = members.find((m) => m.role === role)
          if (!occupant) {
            return (
              <div key={role} className="pc-roster-row empty">
                <span className="pk">{ROLE_LABELS[role]}</span>
                <span className="pv">—</span>
                <span className="ps">vacant</span>
              </div>
            )
          }
          return (
            <div key={role} className="pc-roster-row">
              <span className="pk">{ROLE_LABELS[role]}</span>
              <span className="pv">{occupant.firstName} {occupant.lastName}</span>
              <span className="ps">
                <span className="pc-rating">{occupant.rating}</span>
                <span className="pc-salary">{formatSalary(occupant.contract.salary)}</span>
                <button
                  type="button"
                  className="pc-fire-btn"
                  onClick={() => onFireMember(occupant.id)}
                >
                  Fire
                </button>
              </span>
            </div>
          )
        })}
      </div>
      <div className="pc-foot">
        <div className="pc-foot-cell">
          <span className="k">Annual Salary</span>
          <span className="v">{formatSalary(totalSalary)}</span>
        </div>
        <div className="pc-foot-cell">
          <button type="button" className="pc-market-btn" onClick={() => setMarketOpen(true)}>
            Open Staff Market
          </button>
          {chief && (
            <button type="button" className="pc-fire-chief-btn" onClick={onFireChief}>
              Fire Chief
            </button>
          )}
        </div>
      </div>
      {marketOpen && (
        <StaffMarketModal
          market={market}
          currentChief={chief}
          currentMembers={members}
          onHireChief={(id) => {
            onHireChief(id)
            setMarketOpen(false)
          }}
          onHireMember={(id) => {
            onHireMember(id)
            setMarketOpen(false)
          }}
          onClose={() => setMarketOpen(false)}
        />
      )}
    </div>
  )
}
