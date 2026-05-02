'use client'

import { useState, useMemo } from 'react'
import type { PitCrewChief, PitCrewMember, PitCrewRole, StaffMarket } from '@/types/staff'
import { PIT_CREW_MEMBER_ROLES } from '@/types/staff'

interface StaffMarketModalProps {
  market: StaffMarket
  currentChief: PitCrewChief | null
  currentMembers: PitCrewMember[]
  onHireChief: (staffId: string) => void
  onHireMember: (staffId: string) => void
  onClose: () => void
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

function formatSalary(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  return `$${(amount / 1000).toFixed(0)}k`
}

type Tab = 'chiefs' | PitCrewRole

export function StaffMarketModal({
  market,
  currentChief,
  onHireChief,
  onHireMember,
  onClose,
}: StaffMarketModalProps) {
  const [tab, setTab] = useState<Tab>('chiefs')

  const sortedChiefs = useMemo(
    () =>
      [...market.chiefs].sort((a, b) => {
        const aAvg = (a.releaseSupervision + a.speedDisciplineCoaching + a.serviceCoordination) / 3
        const bAvg = (b.releaseSupervision + b.speedDisciplineCoaching + b.serviceCoordination) / 3
        return bAvg - aAvg
      }),
    [market.chiefs],
  )

  const membersByRole = useMemo(() => {
    const map: Record<string, PitCrewMember[]> = {}
    for (const role of PIT_CREW_MEMBER_ROLES) map[role] = []
    for (const m of market.members) {
      if (map[m.role]) map[m.role].push(m)
    }
    for (const role of Object.keys(map)) {
      map[role].sort((a, b) => b.rating - a.rating)
    }
    return map
  }, [market.members])

  return (
    <div
      className="staff-market-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="staff-market-modal">
        <div className="smm-header">
          <h2>Staff Market</h2>
          <button type="button" className="smm-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="smm-tabs">
          <button
            type="button"
            className={`smm-tab ${tab === 'chiefs' ? 'active' : ''}`}
            onClick={() => setTab('chiefs')}
          >
            Chiefs ({sortedChiefs.length})
          </button>
          {PIT_CREW_MEMBER_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              className={`smm-tab ${tab === role ? 'active' : ''}`}
              onClick={() => setTab(role)}
            >
              {ROLE_LABELS[role]} ({membersByRole[role].length})
            </button>
          ))}
        </div>
        <div className="smm-body">
          {tab === 'chiefs' ? (
            sortedChiefs.length === 0 ? (
              <p className="smm-empty">No chiefs available in the free-agent pool.</p>
            ) : (
              <div className="smm-roster">
                {sortedChiefs.map((c) => {
                  const isCurrent = currentChief?.id === c.id
                  return (
                    <div key={c.id} className="smm-row">
                      <div className="smm-row-info">
                        <span className="smm-name">{c.firstName} {c.lastName}</span>
                        <span className="smm-meta">
                          {c.nationality} · Age {c.age}
                        </span>
                      </div>
                      <div className="smm-row-attrs">
                        <span title="Release supervision">REL {c.releaseSupervision}</span>
                        <span title="Speed-discipline coaching">DISC {c.speedDisciplineCoaching}</span>
                        <span title="Service coordination">SVC {c.serviceCoordination}</span>
                      </div>
                      <div className="smm-row-action">
                        <span className="smm-salary">{formatSalary(c.contract.salary)}</span>
                        <button
                          type="button"
                          className="smm-hire-btn"
                          onClick={() => onHireChief(c.id)}
                          disabled={isCurrent}
                        >
                          {isCurrent ? 'Hired' : 'Hire'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            membersByRole[tab].length === 0 ? (
              <p className="smm-empty">No {ROLE_LABELS[tab]} candidates available.</p>
            ) : (
              <div className="smm-roster">
                {membersByRole[tab].map((m) => (
                  <div key={m.id} className="smm-row">
                    <div className="smm-row-info">
                      <span className="smm-name">{m.firstName} {m.lastName}</span>
                      <span className="smm-meta">
                        {m.nationality} · Age {m.age}
                      </span>
                    </div>
                    <div className="smm-row-attrs">
                      <span title="Member rating">RTG {m.rating}</span>
                    </div>
                    <div className="smm-row-action">
                      <span className="smm-salary">{formatSalary(m.contract.salary)}</span>
                      <button
                        type="button"
                        className="smm-hire-btn"
                        onClick={() => onHireMember(m.id)}
                      >
                        Hire
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
