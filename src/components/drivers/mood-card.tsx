'use client'

import type { Driver } from '@/types/driver'
import type { RivalryDisplay } from '@/lib/utils/drivers-page'
import { moodTone, moodLabel } from '@/lib/utils/mood-display'

interface MoodCardProps {
  driver: Driver
  rivalryIndex: Record<string, RivalryDisplay>
}

const MOOD_KEYS: Array<'motivation' | 'confidence' | 'frustration'> = [
  'motivation',
  'confidence',
  'frustration',
]

const MOOD_LABELS = {
  motivation: 'MOTIVATION',
  confidence: 'CONFIDENCE',
  frustration: 'FRUSTRATION',
}

export function MoodCard({ driver, rivalryIndex }: MoodCardProps) {
  return (
    <div className="drv-card">
      <div className="drv-card-head">
        <span className="t">Mood &amp; Head-state</span>
        <span className="s">Live Telemetry</span>
      </div>
      <div className="drv-card-body">
        <div className="mood-strip">
          {MOOD_KEYS.map(k => {
            const v = driver.mood[k]
            return (
              <div key={k} className={`mood-cell ${moodTone(k, v)}`}>
                <span className="mk">{MOOD_LABELS[k]}</span>
                <span className="mv">{v}</span>
                <span className="mlbl">{moodLabel(k, v)}</span>
              </div>
            )
          })}
        </div>
        <div className="mood-rivalries">
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.2em',
            color: 'var(--ink-dim)',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}>
            Active Rivalries
          </div>
          {driver.rivalries.length === 0 ? (
            <div className="no-rivalry">No active rivalries logged</div>
          ) : (
            driver.rivalries.map((r, i) => {
              const display = rivalryIndex[r.targetDriverId]
              if (!display) return null
              return (
                <div key={i} className="rivalry-row">
                  <div className="rcode">
                    {display.code}
                    <span className="rk">{display.teamName.toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="rname">{display.name}</div>
                    <div className="rcause">{r.cause}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <div className="rint">
                      <div className="ifill" style={{ width: `${r.intensity}%` }} />
                    </div>
                    <div className="rinum">{r.intensity}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
