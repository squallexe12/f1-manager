'use client'

import type { RegId } from '@/data/regulations/2026-rules'

interface RegMetricTileProps {
  label: string
  value: number
  suffix?: string
  prefix?: string
  ofValue?: number
  footnote: string
  regSeeAlso?: RegId
  onSeeAlso?: (regId: RegId) => void
}

function tierFor(rank: number, of: number): 'lime' | 'cyan' | 'amber' {
  if (of <= 0 || rank <= 0) return 'cyan'
  if (rank <= 3) return 'lime'
  if (rank <= 7) return 'cyan'
  return 'amber'
}

export function RegMetricTile({
  label,
  value,
  suffix,
  prefix,
  ofValue,
  footnote,
  regSeeAlso,
  onSeeAlso,
}: RegMetricTileProps) {
  const isRank = typeof ofValue === 'number'
  const tier = isRank ? tierFor(value, ofValue!) : 'lime'
  const displayValue = isRank && value <= 0 ? '—' : value

  return (
    <article className="reg-tile">
      <header className="reg-tile-label">{label.toUpperCase()}</header>
      <div className={`reg-tile-value tier-${tier}`}>
        {prefix && <span className="reg-tile-prefix">{prefix}</span>}
        <span className="reg-tile-num">{displayValue}</span>
        {suffix && <span className="reg-tile-suffix">{suffix}</span>}
        {isRank && <span className="reg-tile-of">/ {ofValue}</span>}
        {isRank && (
          <span className="sr-only">
            Position {value} of {ofValue} on the regulation readiness ranking
          </span>
        )}
      </div>
      <div className="reg-tile-divider" />
      <footer className="reg-tile-footnote">{footnote}</footer>
      {regSeeAlso && onSeeAlso && (
        <button
          type="button"
          className="reg-tile-seealso"
          onClick={() => onSeeAlso(regSeeAlso)}
        >
          Learn the rule →
        </button>
      )}
    </article>
  )
}
