'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Driver } from '@/types/driver'
import {
  expectedSalary,
  type OfferTerms,
  type OfferResult,
} from '@/engine/drivers/free-agent-signing'

type RosterSlot = 'CAR-01' | 'CAR-02' | 'RESERVE'

interface ApproachModalProps {
  driver: Driver
  remainingCap: number
  rosterSlots: { car01: Driver | null; car02: Driver | null; reserve: Driver | null }
  currentPhase: string
  onClose: () => void
  onSubmit: (terms: OfferTerms, slotChoice: RosterSlot, displaceDriverId: string | null) => void
  evaluate: (offer: OfferTerms) => OfferResult | null
}

const SALARY_STEP = 50_000

const formatM = (n: number) =>
  `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`

export function ApproachModal({
  driver,
  remainingCap,
  rosterSlots,
  currentPhase,
  onClose,
  onSubmit,
  evaluate,
}: ApproachModalProps) {
  const expected = useMemo(() => expectedSalary(driver), [driver])
  const sliderMin = Math.round(expected * 0.75 / SALARY_STEP) * SALARY_STEP
  const sliderMax = Math.round(expected * 1.30 / SALARY_STEP) * SALARY_STEP

  const [salary, setSalary] = useState(expected)
  const [termYears, setTermYears] = useState<1 | 2 | 3>(2)

  // Slot selection — auto-fill the first open slot when only one is open;
  // require explicit choice otherwise.
  const openSlots: RosterSlot[] = []
  if (rosterSlots.car01 === null) openSlots.push('CAR-01')
  if (rosterSlots.car02 === null) openSlots.push('CAR-02')
  if (rosterSlots.reserve === null) openSlots.push('RESERVE')
  const allFull = openSlots.length === 0
  const [slotChoice, setSlotChoice] = useState<RosterSlot>(() => {
    // Compute the initial slot once at mount; don't re-derive on rerender.
    const open: RosterSlot[] = []
    if (rosterSlots.car01 === null) open.push('CAR-01')
    if (rosterSlots.car02 === null) open.push('CAR-02')
    if (rosterSlots.reserve === null) open.push('RESERVE')
    return open[0] ?? 'CAR-02'
  })
  const [displaceId, setDisplaceId] = useState<string | null>(null)

  // Live evaluation
  const offer: OfferTerms = { salary, termYears }
  const evaluation = evaluate(offer)

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isManagementPhase = currentPhase === 'management'
  const submitDisabled = !isManagementPhase || !evaluation?.accepted ||
    (allFull && !displaceId)

  const handleSubmit = () => {
    if (submitDisabled) return
    const finalDisplace = allFull ? displaceId : null
    onSubmit(offer, slotChoice, finalDisplace)
  }

  const annualTotal = salary * termYears

  return (
    <div
      className="approach-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="approach-modal">
        <div className="approach-modal-head">
          <div>
            <div className="approach-modal-eyebrow">APPROACH</div>
            <div className="approach-modal-name">
              {driver.firstName} <strong>{driver.lastName.toUpperCase()}</strong>
            </div>
          </div>
          <button
            className="approach-modal-close"
            onClick={onClose}
            aria-label="Close approach modal"
          >×</button>
        </div>

        <div className="approach-modal-stats">
          <span><b>{driver.attributes.pace}</b> PAC</span>
          <span><b>{driver.attributes.racecraft}</b> RCR</span>
          <span><b>{driver.attributes.developmentPotential}</b> POT</span>
          <span>{driver.shortName} · {driver.nationality} · AGE {driver.age}</span>
        </div>

        <div className="approach-modal-section">
          <div className="approach-modal-label">SALARY · {formatM(salary)} / YR</div>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={SALARY_STEP}
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
            aria-valuenow={salary}
            aria-valuemin={sliderMin}
            aria-valuemax={sliderMax}
            aria-label="Annual salary offer"
          />
          <div className="approach-modal-slider-meta">
            <span>{formatM(sliderMin)}</span>
            <span>Asking: {formatM(expected)}</span>
            <span>{formatM(sliderMax)}</span>
          </div>
        </div>

        <div className="approach-modal-section">
          <div className="approach-modal-label">CONTRACT LENGTH</div>
          <div className="approach-modal-term-toggle">
            {([1, 2, 3] as const).map(n => (
              <button
                key={n}
                aria-pressed={termYears === n}
                className={termYears === n ? 'active' : ''}
                onClick={() => setTermYears(n)}
              >{n}Y</button>
            ))}
          </div>
        </div>

        {/* Live evaluation banner */}
        <div
          className={`approach-modal-banner ${evaluation?.accepted ? 'accept' : 'reject'}`}
        >
          {evaluation?.accepted
            ? 'Will accept — submit when ready'
            : evaluation?.reason ?? `Below market — asking ≥ ${formatM(evaluation?.floor ?? expected)}`}
        </div>

        {/* Slot allocation */}
        {!allFull && openSlots.length === 1 && (
          <div className="approach-modal-section">
            <div className="approach-modal-label">SLOT</div>
            <div className="approach-modal-slot-readonly">Filling: {openSlots[0]}</div>
          </div>
        )}
        {!allFull && openSlots.length > 1 && (
          <div className="approach-modal-section">
            <div className="approach-modal-label">SLOT</div>
            <div className="approach-modal-slot-toggle">
              {openSlots.map(s => (
                <button
                  key={s}
                  aria-pressed={slotChoice === s}
                  className={slotChoice === s ? 'active' : ''}
                  onClick={() => setSlotChoice(s)}
                >{s}</button>
              ))}
            </div>
          </div>
        )}
        {allFull && (
          <div className="approach-modal-section">
            <div className="approach-modal-label">ROSTER FULL — CHOOSE DRIVER TO RELEASE</div>
            <div className="approach-modal-displace-picker">
              {(['CAR-01', 'CAR-02', 'RESERVE'] as const).map(s => {
                const slotDriver = s === 'CAR-01' ? rosterSlots.car01
                  : s === 'CAR-02' ? rosterSlots.car02 : rosterSlots.reserve
                if (!slotDriver) return null
                const id = slotDriver.id
                return (
                  <label key={s} className="approach-modal-displace-row">
                    <input
                      type="radio"
                      name="displace"
                      checked={displaceId === id}
                      onChange={() => { setDisplaceId(id); setSlotChoice(s) }}
                    />
                    <span><b>{s}</b> {slotDriver.firstName} {slotDriver.lastName}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Cap impact */}
        <div className="approach-modal-cap">
          <span>TOTAL CONTRACT</span>
          <strong>{formatM(annualTotal)}</strong>
          <span>over {termYears} season{termYears === 1 ? '' : 's'}{remainingCap > 0 ? ` · ${Math.round((annualTotal / remainingCap) * 100)}% of remaining cap` : ''}</span>
        </div>

        {/* Actions */}
        <div className="approach-modal-actions">
          <button
            className="approach-modal-cancel"
            onClick={onClose}
          >Cancel</button>
          <button
            className="approach-modal-submit"
            disabled={submitDisabled}
            onClick={handleSubmit}
            title={!isManagementPhase ? 'Available during management phase' : ''}
          >Submit Offer</button>
        </div>
      </div>
    </div>
  )
}
