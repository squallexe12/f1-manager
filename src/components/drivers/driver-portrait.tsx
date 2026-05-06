'use client'

import type { Driver } from '@/types/driver'

export function DriverPortrait({ driver, color }: { driver: Driver; color: string }) {
  if (driver.portraitUrl) {
    return (
      <div className="portrait-frame">
        <img
          src={driver.portraitUrl}
          alt={`${driver.firstName} ${driver.lastName}`}
          className="portrait-img"
        />
      </div>
    )
  }
  return (
    <div className="portrait-frame">
      <svg className="portrait-stripes" viewBox="0 0 100 120" preserveAspectRatio="none">
        <defs>
          <pattern
            id={`stripes-${driver.shortName}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(35)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100" height="120" fill={color} fillOpacity="0.12" />
        <rect width="100" height="120" fill={`url(#stripes-${driver.shortName})`} />
      </svg>
      <div className="portrait-label">
        <span className="pl-tag">PORTRAIT</span>
        <span className="pl-id">{driver.firstName.toUpperCase()} {driver.lastName.toUpperCase()}</span>
        <span className="pl-meta">DROP IMAGE · 3:4 RECOMMENDED</span>
      </div>
      <div className="portrait-corner tl" />
      <div className="portrait-corner tr" />
      <div className="portrait-corner bl" />
      <div className="portrait-corner br" />
    </div>
  )
}
