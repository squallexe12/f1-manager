'use client'

import { useState } from 'react'
import { regsForCard, type RegCardKey, type RegEntry } from '@/data/regulations/2026-rules'

interface RegRibbonProps {
  card: RegCardKey
}

export function RegRibbon({ card }: RegRibbonProps) {
  const regs = regsForCard(card)
  if (regs.length === 0) return null
  return (
    <div className="reg-ribbon-stack">
      {regs.map((reg, i) => (
        <RegRibbonStrip key={reg.id} reg={reg} variant={i % 2 === 0 ? 'cyan' : 'lime'} />
      ))}
    </div>
  )
}

function RegRibbonStrip({ reg, variant }: { reg: RegEntry; variant: 'cyan' | 'lime' }) {
  const [open, setOpen] = useState(false)
  const panelId = `reg-ribbon-${reg.id}-panel`
  return (
    <div className={`reg-ribbon reg-ribbon-${variant}`}>
      <button
        type="button"
        className="reg-ribbon-head"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="reg-ribbon-glyph" aria-hidden="true">◆</span>
        <span className="reg-ribbon-label">{reg.ribbon}</span>
        <span className={`reg-ribbon-toggle${open ? ' open' : ''}`} aria-hidden="true">+</span>
      </button>
      <div
        id={panelId}
        className={`reg-ribbon-briefing${open ? ' open' : ''}`}
        role="region"
        aria-hidden={!open}
      >
        {open && <p className="reg-ribbon-briefing-text">{reg.briefing}</p>}
      </div>
    </div>
  )
}
