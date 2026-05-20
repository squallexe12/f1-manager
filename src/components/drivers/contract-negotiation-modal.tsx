'use client'

import { useEffect, useRef, useState } from 'react'
import { useContractNegotiation } from '@/hooks/use-contract-negotiation'
import type { ContractOffer, ContractEvaluation } from '@/engine/drivers/contract-engine'

interface Props {
  driverId: string | null
  onClose: () => void
}

function formatM(n: number): string {
  return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
}

type Phase = 'editing' | 'countered' | 'signed'

export function ContractNegotiationModal({ driverId, onClose }: Props) {
  const neg = useContractNegotiation(driverId)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const [salary, setSalary] = useState(0)
  const [term, setTerm] = useState<number>(2)
  const [bonuses, setBonuses] = useState<{ condition: string; value: number }[]>([])
  const [releaseClause, setReleaseClause] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('editing')
  const [result, setResult] = useState<ContractEvaluation | null>(null)

  // Seed the form from the current contract when the driver changes.
  // Uses derived-state-from-render pattern (no useEffect) to avoid the
  // cascading-render lint error (react-hooks/set-state-in-effect).
  const [prevDriverId, setPrevDriverId] = useState<string | null>(null)
  if (neg && neg.driver.id !== prevDriverId) {
    setPrevDriverId(neg.driver.id)
    const c = neg.driver.contract
    setSalary(c?.salary ?? neg.marketValue)
    setTerm(c?.termEndSeason ?? 2)
    setBonuses(c?.performanceBonuses ?? [])
    setReleaseClause(c?.releaseClause ?? null)
    setPhase('editing')
    setResult(null)
  }

  // Escape to close; focus the dialog on open and restore on close.
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

  if (!neg) return null

  const offer: ContractOffer = { salary, termLength: term, performanceBonuses: bonuses, releaseClause }
  const projected = neg.previewSalaries(salary)
  const capRisk = projected > neg.budgetCap * 0.9

  function makeOffer() {
    const r = neg!.evaluate(offer)
    setResult(r)
    if (r.accepted) setPhase('editing')
    else if (r.counterOffer) setPhase('countered')
    else setPhase('editing')
  }

  function commitOffer(toCommit: ContractOffer) {
    neg!.commit(toCommit)
    setPhase('signed')
    setTimeout(onClose, 900)
  }

  function acceptCounter() {
    if (result?.counterOffer) {
      setSalary(result.counterOffer.salary)
      setTerm(result.counterOffer.termLength)
      commitOffer(result.counterOffer)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-labelledby="negotiation-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef} tabIndex={-1}
        className="w-full max-w-md flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h2 id="negotiation-title" className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Negotiate · {neg.driver.firstName} {neg.driver.lastName}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none px-1">×</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {phase === 'signed' ? (
            <p className="text-sm font-heading text-[var(--accent-lime)] py-6 text-center">Signed ✓</p>
          ) : (
            <>
              <div className="text-[10px] font-mono text-[var(--text-dim)]">
                Market value {formatM(neg.marketValue)}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Annual Salary</span>
                <input type="number" value={salary} step={1_000_000} min={0}
                  onChange={(e) => { setSalary(Number(e.target.value)); setPhase('editing'); setResult(null) }}
                  className="bg-white/[0.04] border border-[var(--border-default)] rounded px-2 py-1 text-sm text-[var(--text-primary)]" />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Term (seasons)</span>
                <select value={term} onChange={(e) => { setTerm(Number(e.target.value)); setPhase('editing'); setResult(null) }}
                  className="bg-white/[0.04] border border-[var(--border-default)] rounded px-2 py-1 text-sm text-[var(--text-primary)]">
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Release Clause (optional)</span>
                <input type="number" value={releaseClause ?? ''} step={1_000_000} min={0} placeholder="None"
                  onChange={(e) => { setReleaseClause(e.target.value === '' ? null : Number(e.target.value)); setPhase('editing'); setResult(null) }}
                  className="bg-white/[0.04] border border-[var(--border-default)] rounded px-2 py-1 text-sm text-[var(--text-primary)]" />
              </label>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Performance Bonuses</span>
                {bonuses.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input value={b.condition} placeholder="Condition"
                      onChange={(e) => { setBonuses(bonuses.map((x, j) => j === i ? { ...x, condition: e.target.value } : x)); setPhase('editing'); setResult(null) }}
                      className="flex-1 bg-white/[0.04] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)]" />
                    <input type="number" value={b.value} step={100_000} min={0} aria-label={`Bonus ${i + 1} value`}
                      onChange={(e) => { setBonuses(bonuses.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x)); setPhase('editing'); setResult(null) }}
                      className="w-28 bg-white/[0.04] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)]" />
                    <button type="button" aria-label={`Remove bonus ${i + 1}`}
                      onClick={() => { setBonuses(bonuses.filter((_, j) => j !== i)); setPhase('editing'); setResult(null) }}
                      className="text-[var(--text-dim)] hover:text-[var(--accent-red)] transition-colors px-1">×</button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => { setBonuses([...bonuses, { condition: '', value: 0 }]); setPhase('editing'); setResult(null) }}
                  className="self-start text-[10px] font-heading uppercase tracking-wider text-[var(--accent-cyan)] hover:text-[var(--accent-lime)] transition-colors mt-0.5">
                  + Add bonus
                </button>
              </div>

              <div className={`text-[10px] font-mono ${capRisk ? 'text-[var(--accent-amber)]' : 'text-[var(--text-dim)]'}`}>
                Salaries: {formatM(neg.currentSalaries)} → {formatM(projected)} of {formatM(neg.budgetCap)}{capRisk ? ' · cap risk' : ''}
              </div>

              {result && (
                <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                  Satisfaction {Math.round(result.satisfaction)}/100
                  {phase === 'countered' && result.counterOffer && (
                    <span className="block text-[var(--accent-cyan)] mt-1">
                      Driver&apos;s offer: {formatM(result.counterOffer.salary)} · {result.counterOffer.termLength}yr
                    </span>
                  )}
                  {!result.accepted && phase !== 'countered' && (
                    <span className="block text-[var(--accent-red)] mt-1">Rejected — improve the offer</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                {phase === 'countered' ? (
                  <>
                    <button type="button" onClick={acceptCounter}
                      className="text-[11px] font-heading font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-lime)]/15 text-[var(--accent-lime)] hover:bg-[var(--accent-lime)]/25 transition-colors">
                      Accept counter
                    </button>
                    <button type="button" onClick={() => { setPhase('editing'); setResult(null) }}
                      className="text-[11px] font-heading uppercase tracking-wider px-3 py-1.5 rounded text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors">
                      Re-offer
                    </button>
                    <button type="button" onClick={onClose}
                      className="text-[11px] font-heading uppercase tracking-wider px-3 py-1.5 rounded text-[var(--text-dim)] hover:text-[var(--accent-red)] transition-colors">
                      Walk away
                    </button>
                  </>
                ) : result?.accepted ? (
                  <button type="button" onClick={() => commitOffer(offer)}
                    className="text-[11px] font-heading font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-lime)]/15 text-[var(--accent-lime)] hover:bg-[var(--accent-lime)]/25 transition-colors">
                    Sign
                  </button>
                ) : (
                  <button type="button" onClick={makeOffer}
                    className="text-[11px] font-heading font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/25 transition-colors">
                    Make Offer
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
