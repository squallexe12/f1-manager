import type { TireCompound } from '@/types/race'

export type TireRole = 'hard' | 'medium' | 'soft'

export const ROLE_COLORS: Record<TireRole, string> = {
  hard: '#FFFFFF',
  medium: '#FFC800',
  soft: '#FF3B30',
}

export const ROLE_LABELS: Record<TireRole, string> = {
  hard: 'Hard',
  medium: 'Medium',
  soft: 'Soft',
}

export function roleForCompound(
  compound: TireCompound,
  compounds: readonly TireCompound[]
): TireRole {
  const idx = compounds.indexOf(compound)
  if (idx <= 0) return 'hard'
  if (idx >= 2) return 'soft'
  return 'medium'
}

export function colorForCompound(
  compound: TireCompound,
  compounds: readonly TireCompound[]
): string {
  return ROLE_COLORS[roleForCompound(compound, compounds)]
}

export function labelForCompound(
  compound: TireCompound,
  compounds: readonly TireCompound[]
): string {
  return ROLE_LABELS[roleForCompound(compound, compounds)]
}
