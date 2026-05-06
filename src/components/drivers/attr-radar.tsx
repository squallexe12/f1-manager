'use client'

import type { DriverAttributes } from '@/types/driver'

interface AttrRadarProps {
  attrs: DriverAttributes
  peer: DriverAttributes
  color: string
}

export function AttrRadar({ attrs, peer, color }: AttrRadarProps) {
  const labels = ['PAC', 'RCR', 'EXP', 'MEN', 'MKT', 'POT']
  const keys: (keyof DriverAttributes)[] = [
    'pace', 'racecraft', 'experience', 'mentality', 'marketability', 'developmentPotential',
  ]
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const R = 86
  const n = keys.length

  const pt = (i: number, r: number): [number, number] => {
    const a = (Math.PI * 2 * i / n) - Math.PI / 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }

  const ringPath = (r: number): string =>
    Array.from({ length: n }, (_, i) => pt(i, r))
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' ') + ' Z'

  const valPath = keys
    .map((k, i) => pt(i, (attrs[k] / 100) * R))
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ') + ' Z'

  const peerPath = keys
    .map((k, i) => pt(i, (peer[k] / 100) * R))
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ') + ' Z'

  const gradId = `arf-${color.replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <svg viewBox={`-30 -30 ${size + 60} ${size + 60}`}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.06" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(r => (
        <path
          key={r}
          d={ringPath(R * r)}
          fill="none"
          stroke="var(--line-hair)"
          strokeWidth="1"
          strokeDasharray={r === 1 ? undefined : '2 3'}
        />
      ))}
      {keys.map((_, i) => {
        const [x, y] = pt(i, R)
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-hair)" strokeWidth="1" />
        )
      })}
      <path d={peerPath} fill="none" stroke="var(--sig-amber)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
      <path d={valPath} fill={`url(#${gradId})`} stroke={color} strokeWidth="2" />
      {keys.map((k, i) => {
        const [lx, ly] = pt(i, R + 22)
        const [vx, vy] = pt(i, (attrs[k] / 100) * R)
        return (
          <g key={i}>
            <text
              x={lx}
              y={ly - 3}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8.5,
                letterSpacing: '0.18em',
                fill: 'var(--ink-dim)',
                fontWeight: 700,
              }}
            >
              {labels[i]}
            </text>
            <text
              x={lx}
              y={ly + 9}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 800,
                fill: 'var(--ink-hi)',
                letterSpacing: '-0.02em',
              }}
            >
              {attrs[k]}
            </text>
            <circle cx={vx} cy={vy} r="3.5" fill={color} stroke="var(--bg-void)" strokeWidth="1.5" />
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r="2" fill="var(--ink-dim)" />
    </svg>
  )
}
