'use client'

import { useEffect, useRef, useState } from 'react'
import { useFreeAgentSigning } from '@/hooks/use-free-agent-signing'
import { formatM } from '@/lib/utils/format'
import type { OfferTerms, RosterSlot } from '@/engine/drivers/free-agent-signing'

interface Props {
  driverId: string | null
  onClose: () => void
}

type Phase = 'editing' | 'accepted' | 'rejected' | 'signed'

export function FreeAgentApproachModal({ driverId, onClose }: Props) {
  const fa = useFreeAgentSigning(driverId)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const [salary, setSalary] = useState<number>(0)
  const [termYears, setTermYears] = useState<1 | 2 | 3>(1)
  const [slot, setSlot] = useState<RosterSlot>('RESERVE')
  const [phase, setPhase] = useState<Phase>('editing')
  const [reason, setReason] = useState<string | null>(null)

  // Reset the form when the modal opens for a different driver, seeding the
  // salary input from the asking price (derived-state-from-render, mirroring
  // ReleaseConfirmModal). Local state, not a render side-effect.
  const [prevDriverId, setPrevDriverId] = useState<string | null>(null)
  if (fa && fa.driver.id !== prevDriverId) {
    setPrevDriverId(fa.driver.id)
    setSalary(fa.askingSalary)
    setTermYears(1)
    setSlot('RESERVE')
    setPhase('editing')
    setReason(null)
  }

  useEffect(() => {
    if (!driverId) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previouslyFocused?.focus()
    }
  }, [driverId, onClose])

  if (!driverId) return null
  if (phase !== 'signed' && !fa) return null

  // Once `phase === 'signed'` we render the success state from local phase,
  // so a present `fa` is only required for the editing/accepted/rejected views.
  const offer: OfferTerms = { salary, termYears }
  const occupant = fa?.slots.find((s) => s.slot === slot)?.occupant ?? null

  const onEvaluate = () => {
    if (!fa) return
    const res = fa.evaluate(offer)
    if (res.accepted) {
      setPhase('accepted')
      setReason(null)
    } else {
      setPhase('rejected')
      setReason(res.reason ?? 'Offer rejected')
    }
  }
  const onConfirm = () => {
    if (!fa) return
    fa.commit(offer, slot)
    setPhase('signed')
  }

  const driverName = fa ? `${fa.driver.firstName} ${fa.driver.lastName}` : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-labelledby="approach-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef} tabIndex={-1}
        className="w-full max-w-md flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h2 id="approach-title" className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Approach · {driverName.toUpperCase()}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none px-1">×</button>
        </div>

        {phase === 'signed' ? (
          <div className="px-5 py-4 flex flex-col gap-3">
            <p role="status" className="text-sm font-heading text-[var(--accent-lime)] py-6 text-center">
              Signed ✓ — {driverName} joins {slot}.
            </p>
            <button type="button" onClick={onClose}
              className="text-[11px] font-heading font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-lime)]/15 text-[var(--accent-lime)] hover:bg-[var(--accent-lime)]/25 transition-colors self-center">
              Done
            </button>
          </div>
        ) : fa ? (
          <div className="px-5 py-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
              Annual Salary
              <input
                type="number" value={salary}
                onChange={(e) => { setSalary(Number(e.target.value)); setPhase('editing') }}
                className="text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded px-2 py-1.5 outline-none focus-visible:border-[var(--accent-cyan)]"
              />
            </label>
            <p className="text-[10px] font-mono text-[var(--text-secondary)]">
              Asking ~{formatM(fa.askingSalary)} · floor {formatM(fa.acceptanceFloor)}
            </p>

            <label className="flex flex-col gap-1 text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
              Term
              <select
                value={termYears}
                onChange={(e) => { setTermYears(Number(e.target.value) as 1 | 2 | 3); setPhase('editing') }}
                className="text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded px-2 py-1.5 outline-none focus-visible:border-[var(--accent-cyan)]"
              >
                <option value={1}>1 Season</option>
                <option value={2}>2 Seasons</option>
                <option value={3}>3 Seasons</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
              Slot
              <select
                value={slot}
                onChange={(e) => { setSlot(e.target.value as RosterSlot); setPhase('editing') }}
                className="text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded px-2 py-1.5 outline-none focus-visible:border-[var(--accent-cyan)]"
              >
                {fa.slots.map((s) => (
                  <option key={s.slot} value={s.slot}>
                    {s.slot}{s.occupant ? ` (replaces ${s.occupant.lastName})` : ' (empty)'}
                  </option>
                ))}
              </select>
            </label>

            {occupant && (
              <p className="text-[11px] font-mono text-[var(--accent-amber)]">
                Signing into {slot} releases {occupant.firstName} {occupant.lastName} to free agency.
              </p>
            )}

            <p className="text-[10px] font-mono text-[var(--text-secondary)]">
              Projected salaries: {formatM(fa.projectedSalaries(offer))} of {formatM(fa.budgetCap)} cap
            </p>

            {phase === 'rejected' && reason && (
              <p role="alert" className="text-[11px] font-mono text-[var(--accent-red)]">{reason}</p>
            )}

            {phase === 'accepted' ? (
              <div className="flex items-center gap-2 mt-1">
                <button type="button" onClick={() => setPhase('editing')}
                  className="text-[11px] font-heading uppercase tracking-wider px-3 py-1.5 rounded text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors">
                  Edit
                </button>
                <button type="button" onClick={onConfirm}
                  className="text-[11px] font-heading font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-lime)]/15 text-[var(--accent-lime)] hover:bg-[var(--accent-lime)]/25 transition-colors">
                  Confirm &amp; Sign
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <button type="button" onClick={onClose}
                  className="text-[11px] font-heading uppercase tracking-wider px-3 py-1.5 rounded text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={onEvaluate}
                  className="text-[11px] font-heading font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/25 transition-colors">
                  Make Offer
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
