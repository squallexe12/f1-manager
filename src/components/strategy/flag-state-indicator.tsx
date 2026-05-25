import type { RaceFlag } from '@/types/race'

const FLAG_CONFIG: Record<RaceFlag, { label: string; dotClass: string; textClass: string }> = {
  green: { label: 'GREEN', dotClass: 'bg-sig-green', textClass: 'text-sig-green' },
  yellow: { label: 'YELLOW', dotClass: 'bg-sig-amber', textClass: 'text-sig-amber' },
  vsc: { label: 'VSC', dotClass: 'bg-sig-amber', textClass: 'text-sig-amber' },
  sc: { label: 'SAFETY CAR', dotClass: 'bg-sig-red', textClass: 'text-sig-red' },
  red: { label: 'RED FLAG', dotClass: 'bg-sig-red', textClass: 'text-sig-red' },
}

interface FlagStateIndicatorProps {
  flag: RaceFlag
}

/**
 * Race-HUD caution chip. Reads its flag value from props (the page passes
 * `raceSim.safetyCar`). Glassmorphic composition via broadcast tokens; the dot
 * pulses (opacity only) when a caution is active.
 */
export function FlagStateIndicator({ flag }: FlagStateIndicatorProps) {
  const cfg = FLAG_CONFIG[flag]
  const isCaution = flag !== 'green'
  return (
    <div
      role="status"
      aria-live={isCaution ? 'assertive' : 'polite'}
      aria-label={`Race flag: ${cfg.label}`}
      className="flex items-center gap-1.5 px-2 py-1 bg-surface-paper border border-line-sub rounded-rad"
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dotClass}`}
        style={isCaution ? { animation: 'flag-pulse 1.4s ease-in-out infinite' } : undefined}
      />
      <span className={`font-mono text-[9px] font-semibold uppercase tracking-[0.16em] ${cfg.textClass}`}>
        {cfg.label}
      </span>
      <style>{`@keyframes flag-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
    </div>
  )
}
