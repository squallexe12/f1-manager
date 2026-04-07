'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { TrackPoint } from '@/utils/openf1-track-mapper'
import { TRACK_SPLINES } from '@/data/track-splines'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CarPosition {
  driverId: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  position: number
  lapProgress: number
}

interface CircuitMapProps {
  circuitId: string
  circuitName: string
  currentLap: number
  totalLaps: number
  drivers: { driverId: string; driverName: string; teamColor: string; isPlayer: boolean; position: number }[]
  liveCarPositions?: CarPosition[]
  className?: string
}

// ─── Circuit ID → track image filename mapping ─────────────────────────────

const TRACK_IMAGE_MAP: Record<string, string> = {
  melbourne: 'australia', shanghai: 'china', suzuka: 'japan',
  bahrain: 'bahrain', jeddah: 'saudi-arabia', miami: 'miami',
  imola: 'italy-monza', monaco: 'monaco', montreal: 'canada',
  barcelona: 'spain', spielberg: 'austria', silverstone: 'great-britain',
  spa: 'belgium', zandvoort: 'netherlands', monza: 'italy-monza',
  baku: 'azerbaijan', singapore: 'singapore', austin: 'united-states',
  mexico: 'mexico', interlagos: 'brazil', 'las-vegas': 'las-vegas',
  'abu-dhabi': 'abu-dhabi',
}

// ─── Math helpers ───────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function getSplinePosition(spline: TrackPoint[], fraction: number): { x: number; y: number } {
  if (spline.length === 0) return { x: 0.5, y: 0.5 }
  if (spline.length === 1) return spline[0]
  const clamped = Math.max(0, Math.min(1, fraction))
  const totalSegments = spline.length - 1
  const raw = clamped * totalSegments
  const idx = Math.min(Math.floor(raw), totalSegments - 1)
  const t = raw - idx
  return {
    x: lerp(spline[idx].x, spline[idx + 1].x, t),
    y: lerp(spline[idx].y, spline[idx + 1].y, t),
  }
}

// ─── Canvas drawing ─────────────────────────────────────────────────────────

function drawCars(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, dpr: number,
  spline: TrackPoint[],
  cars: CarPosition[],
  animPhase: number,
) {
  ctx.clearRect(0, 0, w * dpr, h * dpr)
  ctx.save()
  ctx.scale(dpr, dpr)

  if (spline.length < 2 || cars.length === 0) {
    ctx.restore()
    return
  }

  // Padding to keep dots away from edges
  const pad = 12
  const drawW = w - pad * 2
  const drawH = h - pad * 2

  function toCanvas(p: TrackPoint) {
    return { x: pad + p.x * drawW, y: pad + p.y * drawH }
  }

  // Draw cars back-to-front (leader on top)
  const sorted = [...cars].sort((a, b) => b.position - a.position)

  for (const car of sorted) {
    const pos = getSplinePosition(spline, car.lapProgress)
    const cp = toCanvas(pos)

    // Player glow
    if (car.isPlayer) {
      const pulseR = 10 + Math.sin(animPhase * 2.5) * 3
      const pulseAlpha = 0.2 + Math.sin(animPhase * 2.5) * 0.1

      // Outer pulse ring
      ctx.save()
      ctx.beginPath()
      ctx.arc(cp.x, cp.y, pulseR, 0, Math.PI * 2)
      ctx.strokeStyle = car.teamColor
      ctx.lineWidth = 1.5
      ctx.globalAlpha = pulseAlpha
      ctx.stroke()
      ctx.restore()

      // Glow halo
      ctx.save()
      const gradient = ctx.createRadialGradient(cp.x, cp.y, 2, cp.x, cp.y, 14)
      gradient.addColorStop(0, car.teamColor)
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.globalAlpha = 0.15
      ctx.fillRect(cp.x - 14, cp.y - 14, 28, 28)
      ctx.restore()
    }

    // Car dot with dark outline for contrast over bright track images
    const r = car.isPlayer ? 8 : 5
    ctx.save()
    // Dark outline
    ctx.beginPath()
    ctx.arc(cp.x, cp.y, r + 1.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fill()
    // Colored fill
    ctx.beginPath()
    ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2)
    ctx.fillStyle = car.teamColor
    ctx.globalAlpha = car.isPlayer ? 1 : 0.85
    ctx.shadowColor = car.teamColor
    ctx.shadowBlur = car.isPlayer ? 10 : 4
    ctx.fill()
    ctx.restore()

    // Specular highlight
    ctx.save()
    ctx.beginPath()
    ctx.arc(cp.x - r * 0.15, cp.y - r * 0.2, r * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fill()
    ctx.restore()

    // Position label for top 5 + player
    if (car.position <= 5 || car.isPlayer) {
      ctx.save()
      ctx.font = car.isPlayer ? 'bold 11px monospace' : '10px monospace'
      ctx.fillStyle = car.isPlayer ? '#CCFF00' : 'rgba(255,255,255,0.7)'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 4
      ctx.fillText(`P${car.position} ${car.driverName}`, cp.x + r + 5, cp.y + 4)
      ctx.restore()
    }
  }

  ctx.restore()
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CircuitMap({ circuitId, circuitName, currentLap, totalLaps, drivers, liveCarPositions, className = '' }: CircuitMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const animPhaseRef = useRef(0)

  const spline = TRACK_SPLINES[circuitId] ?? TRACK_SPLINES['melbourne'] ?? []
  const trackImageFile = TRACK_IMAGE_MAP[circuitId] ?? 'australia'

  // Build car positions from live data or fallback
  const carPositions: CarPosition[] = liveCarPositions && liveCarPositions.length > 0
    ? liveCarPositions
    : drivers.map((d, i) => {
        const total = drivers.length
        const spacing = 0.8 / Math.max(1, total - 1)
        return { ...d, lapProgress: ((1.0 - i * spacing) % 1 + 1) % 1 }
      })

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = rect.width
    const h = rect.height

    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(render)
      return
    }

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    animPhaseRef.current += 0.025
    drawCars(ctx, w, h, dpr, spline, carPositions, animPhaseRef.current)

    rafRef.current = requestAnimationFrame(render)
  }, [spline, carPositions])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [render])

  const lapProgress = totalLaps > 0 ? (currentLap / totalLaps) * 100 : 0

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
          {circuitName}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold text-[var(--accent-lime)]">
            LAP {currentLap}
          </span>
          <span className="text-xs font-mono text-[var(--text-dim)]">
            / {totalLaps}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${lapProgress}%`,
            background: 'linear-gradient(90deg, var(--accent-lime), var(--accent-cyan))',
            transition: 'width 0.8s ease-out',
          }}
        />
      </div>

      {/* Track map with image + canvas overlay */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden border border-[var(--border-default)]"
        style={{ aspectRatio: '1252 / 704' }}
      >
        {/* Track image background */}
        <img
          src={`/tracks/${trackImageFile}.avif`}
          alt={`${circuitName} circuit layout`}
          className="absolute inset-0 w-full h-full object-fill"
          draggable={false}
        />

        {/* Subtle dark overlay for contrast with car dots */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Canvas for animated car dots */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {/* Lap counter overlay */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-3 py-1.5">
          <span className="text-xs font-mono font-bold text-[var(--accent-lime)]">
            LAP {currentLap}/{totalLaps}
          </span>
        </div>

        {/* Speed indicator */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-md px-3 py-1.5">
          <span className="text-[10px] font-mono text-[var(--text-secondary)]">
            {drivers.length} CARS
          </span>
        </div>
      </div>

      {/* Player positions legend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {carPositions.filter(c => c.isPlayer).map(c => (
            <div key={c.driverId} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: c.teamColor, boxShadow: `0 0 6px ${c.teamColor}40` }} />
              <span className="text-xs font-mono font-semibold text-[var(--accent-lime)]">
                P{c.position}
              </span>
              <span className="text-xs font-heading text-[var(--text-secondary)]">
                {c.driverName}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-[var(--text-dim)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-lime)]" />
          <span>Your team</span>
        </div>
      </div>
    </div>
  )
}

export { type CarPosition as CanvasCarPosition }
export { type TrackPoint }
