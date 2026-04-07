import type { PrestigeRating } from '@/types/finance'

interface PrestigeMeterProps {
  rating: PrestigeRating
  score: number // 0-100
  className?: string
}

const RATING_THRESHOLDS: { grade: PrestigeRating; min: number }[] = [
  { grade: 'A+', min: 90 },
  { grade: 'A', min: 80 },
  { grade: 'B+', min: 70 },
  { grade: 'B', min: 60 },
  { grade: 'C+', min: 50 },
  { grade: 'C', min: 40 },
  { grade: 'D', min: 25 },
  { grade: 'F', min: 0 },
]

const FACTORS = [
  { label: 'Results', key: 'results' },
  { label: 'Media Coverage', key: 'media' },
  { label: 'Driver Marketability', key: 'marketability' },
  { label: 'Reputation', key: 'reputation' },
]

function getRatingColor(rating: PrestigeRating): string {
  if (rating === 'A+' || rating === 'A') return 'var(--accent-lime)'
  if (rating === 'B+' || rating === 'B') return 'var(--accent-cyan)'
  if (rating === 'C+' || rating === 'C') return 'var(--accent-amber)'
  return 'var(--accent-red)'
}

export function PrestigeMeter({ rating, score, className = '' }: PrestigeMeterProps) {
  const color = getRatingColor(rating)

  // Derive approximate factor contributions from the score
  // In MVP, distribute score roughly across factors
  const factorValues = [
    Math.min(100, score + 5),
    Math.min(100, score - 5),
    Math.min(100, score + 2),
    Math.min(100, score - 2),
  ]

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Prestige
      </h3>

      {/* Grade Display */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center border-2"
          style={{ borderColor: color, backgroundColor: `${color}10` }}
        >
          <span className="text-2xl font-heading font-bold" style={{ color }}>
            {rating}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              Score: {score}/100
            </span>
          </div>
          <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${score}%`, backgroundColor: color }}
            />
          </div>
          {/* Rating scale markers */}
          <div className="flex justify-between mt-0.5 text-[8px] font-mono text-[var(--text-dim)]">
            <span>F</span>
            <span>D</span>
            <span>C</span>
            <span>B</span>
            <span>A</span>
            <span>A+</span>
          </div>
        </div>
      </div>

      {/* Contributing Factors */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
          Contributing Factors
        </span>
        {FACTORS.map((factor, i) => (
          <div key={factor.key} className="flex items-center gap-2">
            <span className="w-28 text-[10px] text-[var(--text-secondary)]">{factor.label}</span>
            <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, factorValues[i])}%`,
                  backgroundColor: color,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--text-dim)] w-8 text-right">
              {Math.max(0, factorValues[i])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
