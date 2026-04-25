'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RaceIncident, OffenceType } from '@/types/race'

// ─── Offence label map ────────────────────────────────────────────────────────

const OFFENCE_LABELS: Record<OffenceType, string> = {
  'collision-minor':   'Collision (minor)',
  'collision-serious': 'Collision (serious)',
  'forcing-off':       'Forcing Off',
  'illegal-defending': 'Illegal Defending',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingInvestigation {
  investigationId: string
  driverIds: string[]
  offenceType: OffenceType | undefined
  detectedLap: number
  decideOnLap: number | undefined
}

interface StewardsCardProps {
  incidents: RaceIncident[]
  currentLap: number
  /** Full driver list for short-name lookup. If omitted the raw id is shown. */
  driverNames?: Record<string, string>
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StewardsCard({
  incidents,
  currentLap,
  driverNames = {},
  className = '',
}: StewardsCardProps) {
  const pending = useMemo<PendingInvestigation[]>(() => {
    // Collect all opened investigations.
    const opened = new Map<string, PendingInvestigation>()
    for (const inc of incidents) {
      if (inc.type === 'investigation-opened' && inc.investigationId) {
        opened.set(inc.investigationId, {
          investigationId: inc.investigationId,
          driverIds: inc.driverIds,
          offenceType: inc.offenceType,
          detectedLap: inc.lap,
          decideOnLap: inc.decideOnLap,
        })
      }
    }

    // Remove those that have been resolved.
    for (const inc of incidents) {
      if (
        (inc.type === 'penalty-issued' || inc.type === 'investigation-closed') &&
        inc.investigationId
      ) {
        opened.delete(inc.investigationId)
      }
    }

    return Array.from(opened.values())
  }, [incidents])

  if (pending.length === 0) {
    return (
      <div
        className={`flex flex-col bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}
      >
        <div className="px-3 py-2 border-b border-line-sub flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
            Stewards
          </span>
        </div>
        <p className="px-3.5 py-3 font-mono text-[11px] text-ink-dim italic">
          No active investigations
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}
    >
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-line-sub flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
          Stewards
        </span>
        {/* Live count badge */}
        <span className="font-mono text-[8px] font-bold px-[5px] py-[2px] rounded-[1px] leading-none bg-sig-amber text-surface-void tabular-nums">
          {pending.length}
        </span>
      </div>

      {/* Investigation rows */}
      <div className="flex flex-col gap-px bg-line-hair" role="list" aria-label="Pending stewards investigations">
        <AnimatePresence initial={false}>
          {pending.map((inv) => {
            const lapsLeft =
              inv.decideOnLap != null
                ? Math.max(0, inv.decideOnLap - currentLap)
                : undefined

            // Primary driver shown: first in driverIds list
            const primaryId = inv.driverIds[0] ?? ''
            const primaryName = driverNames[primaryId] ?? primaryId.toUpperCase()
            const secondaryId = inv.driverIds[1]
            const secondaryName = secondaryId
              ? (driverNames[secondaryId] ?? secondaryId.toUpperCase())
              : undefined

            const offenceLabel = inv.offenceType
              ? (OFFENCE_LABELS[inv.offenceType] ?? inv.offenceType)
              : 'Under Investigation'

            return (
              <motion.div
                key={inv.investigationId}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="bg-surface-paper px-3.5 py-2.5"
                role="listitem"
              >
                {/* Driver name(s) + offence */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    {/* Driver codes */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-bold text-[13px] text-sig-amber tracking-[0.04em] uppercase leading-none">
                        {primaryName}
                      </span>
                      {secondaryName && (
                        <>
                          <span className="font-mono text-[9px] text-ink-dim">/</span>
                          <span className="font-display font-bold text-[12px] text-ink-mute tracking-[0.04em] uppercase leading-none">
                            {secondaryName}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Offence label */}
                    <span className="font-mono text-[10px] text-ink-body mt-0.5 leading-snug">
                      {offenceLabel}
                    </span>
                  </div>

                  {/* Lap detected tag */}
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-dim leading-none">
                      LAP
                    </span>
                    <span className="font-mono font-bold text-[13px] text-ink-mute tabular-nums leading-none">
                      {inv.detectedLap}
                    </span>
                  </div>
                </div>

                {/* Decision countdown */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-dim">
                    Decision
                  </span>
                  {inv.decideOnLap != null ? (
                    <>
                      <span className="font-mono text-[9px] font-semibold text-ink-body tabular-nums">
                        Lap {inv.decideOnLap}
                      </span>
                      {lapsLeft != null && (
                        <span
                          className={`font-mono text-[9px] tabular-nums ${
                            lapsLeft <= 2 ? 'text-sig-red' : 'text-ink-mute'
                          }`}
                        >
                          ({lapsLeft === 0 ? 'this lap' : `${lapsLeft}L remaining`})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-mono text-[9px] text-ink-dim italic">pending</span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
