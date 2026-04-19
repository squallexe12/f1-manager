'use client'

import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { CommentaryEntry } from '@/types/race'

interface CommentaryFeedProps {
  entries: CommentaryEntry[]
  className?: string
}

/**
 * Map CommentaryEntry.severity → visible tag label + Broadcast badge classes.
 *
 * Severity values: 'critical' | 'highlight' | 'radio' | 'info' | 'neutral'
 *
 * Mapping rationale (verified against src/types/race.ts — CommentaryEntry has
 * no separate `tag` field, only `severity`):
 *   critical  → OVERTAKE  → red badge    (race-critical action / overtake moment)
 *   highlight → FASTEST   → purple badge (highlight / fastest-lap type event)
 *   radio     → PIT       → amber badge  (team radio / pit instruction)
 *   info      → INFO      → neutral badge
 *   neutral   → INFO      → neutral badge
 */
const SEVERITY_TAG: Record<string, { label: string; cls: string }> = {
  critical:  { label: 'OVERTAKE', cls: 'bg-sig-red text-surface-void' },
  highlight: { label: 'FASTEST',  cls: 'bg-sig-purple text-white' },
  radio:     { label: 'PIT',      cls: 'bg-sig-amber text-surface-void' },
  info:      { label: 'INFO',     cls: 'bg-surface-hi text-ink-mute' },
  neutral:   { label: 'INFO',     cls: 'bg-surface-hi text-ink-mute' },
}

const DEFAULT_TAG = { label: 'INFO', cls: 'bg-surface-hi text-ink-mute' }

export function CommentaryFeed({ entries, className = '' }: CommentaryFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  return (
    <div
      className={`flex flex-col bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}
    >
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-line-sub sticky top-0 bg-surface-paper z-10">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
          Commentary
        </span>
      </div>

      {/* Feed scroll area */}
      <div
        ref={containerRef}
        className="max-h-[420px] overflow-y-auto"
        role="log"
        aria-label="Race commentary feed"
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <p className="px-3.5 py-4 font-mono text-[11px] text-ink-dim italic">
            Waiting for race to begin...
          </p>
        ) : (
          <div className="flex flex-col gap-px bg-line-hair">
            {entries.map((entry, i) => {
              const tag = SEVERITY_TAG[entry.severity] ?? DEFAULT_TAG
              return (
                <motion.div
                  key={`${entry.lap}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-surface-paper grid gap-2.5 px-3.5 py-2 border-b border-line-hair items-start"
                  style={{ gridTemplateColumns: '36px 58px 1fr' }}
                >
                  {/* Lap number */}
                  <div className="flex flex-col">
                    <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink-dim opacity-60 leading-none">
                      LAP
                    </span>
                    <span className="font-display font-bold text-[13px] text-ink-dim tabular-nums leading-snug">
                      {entry.lap}
                    </span>
                  </div>

                  {/* Tag badge */}
                  <div className="flex items-start pt-0.5">
                    <span
                      className={`font-mono text-[8px] font-bold tracking-[0.14em] px-[5px] py-[3px] rounded-[1px] leading-none ${tag.cls}`}
                      aria-label={`Event type: ${tag.label}`}
                    >
                      {tag.label}
                    </span>
                  </div>

                  {/* Commentary text */}
                  <span className="font-body text-[12px] text-ink-body leading-[1.4]">
                    {entry.text}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
