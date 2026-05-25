import type { RaceFlag } from '@/types/race'

const FLASH_COLOR: Record<RaceFlag, string> = {
  green: 'transparent',
  yellow: 'var(--sig-amber)',
  vsc: 'var(--sig-amber)',
  sc: 'var(--sig-red)',
  red: 'var(--sig-red)',
}

interface CautionFlashProps {
  flag: RaceFlag
}

/**
 * Full-screen-edge flash that fires once when the caution flag transitions to a
 * new non-green value. Pointer-events-none, aria-hidden (the FlagStateIndicator
 * carries the accessible announcement). Animates opacity only.
 *
 * The overlay element is keyed on `flag` so React remounts it each time the
 * flag value changes, retriggering the CSS animation without any state or
 * effect. Green renders with opacity 0 (inert).
 */
export function CautionFlash({ flag }: CautionFlashProps) {
  const active = flag !== 'green'
  return (
    <div
      data-caution-flash
      data-active={active ? 'true' : 'false'}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40"
      style={{
        boxShadow: active ? `inset 0 0 120px 12px ${FLASH_COLOR[flag]}` : 'none',
        opacity: active ? 1 : 0,
        animation: active ? `caution-edge-flash 1.6s ease-out` : undefined,
      }}
    >
      <style>{`@keyframes caution-edge-flash { 0% { opacity: 0 } 15% { opacity: 0.85 } 100% { opacity: 0.18 } }`}</style>
    </div>
  )
}
