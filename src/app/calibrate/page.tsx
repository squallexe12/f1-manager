'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { TRACK_SPLINES, type TrackPoint } from '@/data/track-splines'

const TRACK_IMAGE_MAP: Record<string, string> = {
  melbourne: 'australia', shanghai: 'china', suzuka: 'japan',
  bahrain: 'bahrain', jeddah: 'saudi-arabia', miami: 'miami',
  imola: 'italy-monza', monaco: 'monaco', montreal: 'canada',
  barcelona: 'spain', spielberg: 'austria', silverstone: 'great-britain',
  spa: 'belgium', zandvoort: 'netherlands', monza: 'italy-monza',
  baku: 'azerbaijan', singapore: 'singapore', austin: 'united-states',
  mexico: 'mexico', interlagos: 'brazil', 'las-vegas': 'las-vegas',
  'abu-dhabi': 'abu-dhabi', qatar: 'qatar', hungary: 'hungary',
}

const CIRCUIT_NAMES: Record<string, string> = {
  melbourne: 'Melbourne', shanghai: 'Shanghai', suzuka: 'Suzuka',
  bahrain: 'Bahrain', jeddah: 'Jeddah', miami: 'Miami',
  imola: 'Imola', monaco: 'Monaco', montreal: 'Montreal',
  barcelona: 'Barcelona', spielberg: 'Spielberg', silverstone: 'Silverstone',
  spa: 'Spa', zandvoort: 'Zandvoort', monza: 'Monza',
  baku: 'Baku', singapore: 'Singapore', austin: 'Austin',
  mexico: 'Mexico City', interlagos: 'Interlagos', 'las-vegas': 'Las Vegas',
  'abu-dhabi': 'Abu Dhabi', qatar: 'Qatar', hungary: 'Hungary',
}

const ALL_CIRCUITS = Object.keys(TRACK_IMAGE_MAP)

export default function CalibratePage() {
  const [selectedCircuit, setSelectedCircuit] = useState(ALL_CIRCUITS[0])
  const [points, setPoints] = useState<TrackPoint[]>([])
  const [isTracing, setIsTracing] = useState(false)
  const [showExisting, setShowExisting] = useState(true)
  const [dotSize, setDotSize] = useState(6)
  const containerRef = useRef<HTMLDivElement>(null)

  const existingSpline = TRACK_SPLINES[selectedCircuit] ?? []

  // Load existing spline when circuit changes
  useEffect(() => {
    setPoints([])
    setIsTracing(false)
  }, [selectedCircuit])

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isTracing || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPoints(prev => [...prev, { x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)) }])
  }, [isTracing])

  const handleUndo = () => setPoints(prev => prev.slice(0, -1))
  const handleClear = () => setPoints([])

  const exportSpline = () => {
    const str = points.map(p => `${p.x},${p.y}`).join(' ')
    navigator.clipboard.writeText(`  ${selectedCircuit}: p(\`\n    ${str}\n  \`),`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-bold mb-1 text-[#CCFF00]">Track Spline Calibration Tool</h1>
        <p className="text-sm text-gray-400 mb-6">Click on the track image to trace spline points. Green = existing spline, Red = new trace.</p>

        {/* Circuit selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ALL_CIRCUITS.map(id => (
            <button
              key={id}
              onClick={() => setSelectedCircuit(id)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                selectedCircuit === id
                  ? 'bg-[#CCFF00] text-black font-bold'
                  : 'bg-white/10 hover:bg-white/20 text-gray-300'
              }`}
            >
              {CIRCUIT_NAMES[id] ?? id}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setIsTracing(!isTracing)}
            className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
              isTracing ? 'bg-red-500 text-white' : 'bg-[#CCFF00] text-black'
            }`}
          >
            {isTracing ? 'Stop Tracing' : 'Start Tracing'}
          </button>
          <button onClick={handleUndo} className="px-3 py-2 rounded text-sm bg-white/10 hover:bg-white/20">
            Undo
          </button>
          <button onClick={handleClear} className="px-3 py-2 rounded text-sm bg-white/10 hover:bg-white/20">
            Clear
          </button>
          <button onClick={exportSpline} className="px-3 py-2 rounded text-sm bg-cyan-600 hover:bg-cyan-500 text-white">
            Copy to Clipboard
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" checked={showExisting} onChange={e => setShowExisting(e.target.checked)} />
            Show existing spline
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Dot size:
            <input type="range" min={2} max={12} value={dotSize} onChange={e => setDotSize(Number(e.target.value))} className="w-20" />
          </label>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-6 mb-4 text-xs font-mono text-gray-400">
          <span>Circuit: <span className="text-white">{CIRCUIT_NAMES[selectedCircuit]}</span></span>
          <span>Existing points: <span className="text-green-400">{existingSpline.length}</span></span>
          <span>New points: <span className="text-red-400">{points.length}</span></span>
          <span>Image: <span className="text-cyan-400">/tracks/{TRACK_IMAGE_MAP[selectedCircuit]}.avif</span></span>
        </div>

        {/* Track image with overlay */}
        <div className="flex gap-6">
          <div className="flex-1">
            <div
              ref={containerRef}
              className={`relative w-full rounded-xl overflow-hidden border-2 ${isTracing ? 'border-red-500 cursor-crosshair' : 'border-white/20'}`}
              style={{ aspectRatio: '1252 / 704' }}
              onClick={handleImageClick}
            >
              <img
                src={`/tracks/${TRACK_IMAGE_MAP[selectedCircuit]}.avif`}
                alt={CIRCUIT_NAMES[selectedCircuit]}
                className="absolute inset-0 w-full h-full object-contain bg-[#111]"
                draggable={false}
              />

              {/* Existing spline dots (green) */}
              {showExisting && existingSpline.map((pt, i) => (
                <div
                  key={`existing-${i}`}
                  className="absolute rounded-full border border-green-300/60"
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`,
                    width: dotSize,
                    height: dotSize,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: `rgba(0, 255, 100, ${i === 0 ? 1 : 0.7})`,
                    boxShadow: i === 0 ? '0 0 8px rgba(0,255,100,0.8)' : 'none',
                    zIndex: i === 0 ? 10 : 1,
                  }}
                  title={`Existing #${i}: (${pt.x}, ${pt.y})`}
                />
              ))}

              {/* Existing spline path lines (green) */}
              {showExisting && existingSpline.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                  <polyline
                    points={existingSpline.map(pt => `${pt.x * 100}%,${pt.y * 100}%`).join(' ')}
                    fill="none"
                    stroke="rgba(0,255,100,0.3)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}

              {/* New traced dots (red) */}
              {points.map((pt, i) => (
                <div
                  key={`new-${i}`}
                  className="absolute rounded-full border border-red-300/60"
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`,
                    width: dotSize + 2,
                    height: dotSize + 2,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: `rgba(255, 60, 60, ${i === 0 ? 1 : 0.8})`,
                    boxShadow: i === 0 ? '0 0 8px rgba(255,60,60,0.8)' : 'none',
                    zIndex: 20,
                  }}
                  title={`New #${i}: (${pt.x}, ${pt.y})`}
                />
              ))}
            </div>
          </div>

          {/* Spline data output */}
          <div className="w-72 shrink-0">
            <h3 className="text-sm font-bold mb-2 text-gray-300">New Spline Data</h3>
            <pre className="bg-black/50 border border-white/10 rounded-lg p-3 text-[10px] font-mono text-green-400 max-h-[500px] overflow-auto whitespace-pre-wrap">
              {points.length > 0
                ? points.map(p => `${p.x},${p.y}`).join(' ')
                : 'Click "Start Tracing" then click on the track to add points.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
