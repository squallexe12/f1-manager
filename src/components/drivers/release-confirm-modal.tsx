'use client'

import { useEffect, useRef, useState } from 'react'
import { useDriverRelease } from '@/hooks/use-driver-release'
import { formatM } from '@/lib/utils/format'

interface Props {
  driverId: string | null
  onClose: () => void
}

type Phase = 'confirm' | 'released'

export function ReleaseConfirmModal({ driverId, onClose }: Props) {
  const rel = useDriverRelease(driverId)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [phase, setPhase] = useState<Phase>('confirm')
  const [driverName, setDriverName] = useState('')

  // Reset phase when the modal opens for a different driver (derived-state-from-render).
  const [prevDriverId, setPrevDriverId] = useState<string | null>(null)
  if (rel && rel.driver.id !== prevDriverId) {
    setPrevDriverId(rel.driver.id)
    setPhase('confirm')
    setDriverName(`${rel.driver.firstName} ${rel.driver.lastName}`)
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

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  if (!driverId) return null
  // Once released, the freed driver's contract is null and the hook returns null —
  // render the success state from local phase, not from `rel`.
  if (phase !== 'released' && !rel) return null

  function confirm() {
    if (!rel) return
    rel.commit()
    setPhase('released')
    closeTimerRef.current = setTimeout(onClose, 900)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-labelledby="release-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef} tabIndex={-1}
        className="w-full max-w-md flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h2 id="release-title" className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Release · {driverName}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none px-1">×</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {phase === 'released' ? (
            <p role="status" className="text-sm font-heading text-[var(--accent-lime)] py-6 text-center">Released ✓</p>
          ) : rel ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
                  {rel.fromReleaseClause ? 'Release clause' : 'Settlement'}
                </span>
                <span className="text-lg font-heading font-bold text-[var(--text-primary)]">{formatM(rel.severance)}</span>
              </div>

              <div className="text-[10px] font-mono text-[var(--text-secondary)] flex flex-col gap-0.5">
                <span>Salaries: {formatM(rel.currentSalaries)} → {formatM(rel.salariesAfter)}</span>
                <span className={rel.capRisk ? 'text-[var(--accent-amber)]' : undefined}>
                  Operations: {formatM(rel.operationsBefore)} → {formatM(rel.operationsAfter)} of {formatM(rel.budgetCap)} cap
                  {rel.capRisk ? ' · cap risk' : ''}
                </span>
              </div>

              {rel.wouldLeaveOneRaceDriver && (
                <p className="text-[11px] font-mono text-[var(--accent-amber)]">
                  This leaves you with 1 race driver. Sign a replacement before the next race.
                </p>
              )}

              <p className="text-[11px] font-mono text-[var(--text-dim)]">
                This driver becomes a free agent and the seat is left empty.
              </p>

              <div className="flex items-center gap-2 mt-1">
                <button type="button" onClick={onClose}
                  className="text-[11px] font-heading uppercase tracking-wider px-3 py-1.5 rounded text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={confirm}
                  className="text-[11px] font-heading font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-red)]/15 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/25 transition-colors">
                  Confirm Release
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
