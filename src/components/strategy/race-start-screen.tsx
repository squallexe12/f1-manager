'use client'

import { useEffect, useState } from 'react'

interface RaceStartScreenProps {
  circuitName: string
  laps: number
  weather?: string
  isSprint?: boolean
  onStart: () => void
}

export function RaceStartScreen({
  circuitName,
  laps,
  weather = 'CLEAR',
  isSprint = false,
  onStart,
}: RaceStartScreenProps) {
  const [lights, setLights] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mql.matches)
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      setLights(5)
      return
    }
    const id = window.setInterval(() => {
      setLights((l) => (l >= 5 ? 0 : l + 1))
    }, 900)
    return () => window.clearInterval(id)
  }, [reduceMotion])

  const sessionLabel = isSprint ? 'SPRINT · LIGHTS OUT IMMINENT' : 'RACE SESSION · LIGHTS OUT IMMINENT'
  const titleLabel = isSprint ? 'SPRINT RACE' : 'GRAND PRIX'
  const subLabel = `${circuitName.toUpperCase()} · ${laps} LAPS · ${weather.toUpperCase()}`

  return (
    <div className="grid place-items-center min-h-[72vh] px-8 py-8">
      <div className="flex flex-col items-center gap-[22px] w-full max-w-[720px] text-center">
        {/* Flag banner */}
        <div
          className="
            inline-block px-[14px] py-[6px] font-mono font-bold text-[12px]
            tracking-[0.4em] text-[var(--sig-red)]
            border border-[var(--sig-red-dk)] rounded-[var(--rad)]
          "
        >
          ◉ {sessionLabel}
        </div>

        {/* Huge display title */}
        <div
          className="font-heading font-extrabold text-[var(--ink-hi)]"
          style={{
            fontSize: '96px',
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
          }}
        >
          {titleLabel}
        </div>

        {/* Circuit + laps sub */}
        <div className="font-mono text-[13px] tracking-[0.2em] uppercase text-[var(--ink-mute)]">
          {subLabel}
        </div>

        {/* Lights gantry */}
        <div
          className="
            flex gap-[14px] px-8 py-[22px] rounded-[var(--rad)]
            border border-[var(--line-hair)]
          "
          style={{ background: 'oklch(0.06 0 0)', marginBottom: '8px' }}
          aria-hidden="true"
        >
          {Array.from({ length: 5 }, (_, i) => {
            const on = i < lights
            return (
              <div
                key={i}
                className="rounded-full relative"
                style={{
                  width: 48,
                  height: 48,
                  background: on ? 'var(--sig-red)' : 'oklch(0.10 0.03 25)',
                  border: on
                    ? '2px solid oklch(0.8 0.2 25)'
                    : '2px solid oklch(0.2 0 0)',
                  boxShadow: on
                    ? '0 0 20px var(--sig-red), inset 0 0 8px oklch(1 0 0 / 0.3)'
                    : 'inset 0 0 12px oklch(0 0 0 / 0.8)',
                  transition: 'background 120ms, box-shadow 120ms, border-color 120ms',
                }}
              />
            )
          })}
        </div>

        {/* Primary action */}
        <button
          type="button"
          onClick={onStart}
          className="
            group inline-flex items-center gap-2
            font-heading font-bold uppercase tracking-[0.12em]
            border rounded-[var(--rad)]
            text-[var(--bg-void)]
            outline-none focus-visible:ring-2 focus-visible:ring-[var(--sig-red)]/50
          "
          style={{
            background: 'var(--sig-red)',
            borderColor: 'var(--sig-red)',
            fontSize: '16px',
            padding: '18px 32px',
            marginTop: '8px',
            transition: 'background 160ms, box-shadow 160ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'oklch(0.78 0.22 25)'
            e.currentTarget.style.boxShadow = '0 0 20px oklch(0.68 0.22 25 / 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--sig-red)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          START RACE SIMULATION
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-200 group-hover:translate-x-1"
          >
            →
          </span>
        </button>

        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--ink-mute)]" style={{ marginTop: '4px' }}>
          Sim will advance at 1× · adjust speed from command bar once live
        </div>
      </div>
    </div>
  )
}
