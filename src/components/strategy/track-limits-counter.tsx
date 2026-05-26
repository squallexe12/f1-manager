interface TrackLimitsCounterProps {
  strikes: number
  threshold: number
  driverLabel: string
}

/**
 * Race-HUD track-limits strike pip "⚠ 2/4". Hidden at zero strikes. Reads from
 * props (page sources from raceSim.trackLimitStrikes). Pulses (opacity) at/over
 * the threshold.
 */
export function TrackLimitsCounter({ strikes, threshold, driverLabel }: TrackLimitsCounterProps) {
  if (strikes <= 0) return null
  const atRisk = strikes >= threshold
  return (
    <div
      role="status"
      aria-live={atRisk ? 'assertive' : 'polite'}
      aria-label={`${driverLabel} track limits: ${strikes} of ${threshold}`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-paper border border-line-sub rounded-rad"
    >
      <span
        className={`font-mono text-[10px] leading-none ${atRisk ? 'text-sig-red' : 'text-sig-amber'}`}
        style={atRisk ? { animation: 'tl-pulse 1.2s ease-in-out infinite' } : undefined}
      >
        ⚠
      </span>
      <span className={`font-mono text-[9px] font-semibold tabular-nums ${atRisk ? 'text-sig-red' : 'text-ink-dim'}`}>
        {strikes}/{threshold}
      </span>
      <style>{`@keyframes tl-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </div>
  )
}
