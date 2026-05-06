/**
 * Tone class for a mood cell based on key and value.
 * Matches the logic in new-designs/drivers/Drivers Page.html.
 */
export function moodTone(key: string, v: number): 'good' | 'warn' | 'bad' {
  if (key === 'frustration') {
    if (v <= 30) return 'good'
    if (v <= 60) return 'warn'
    return 'bad'
  }
  if (v >= 75) return 'good'
  if (v >= 45) return 'warn'
  return 'bad'
}

/**
 * Short label for a mood cell based on key and value.
 * Matches the logic in new-designs/drivers/Drivers Page.html.
 */
export function moodLabel(key: string, v: number): string {
  if (key === 'frustration') {
    if (v <= 25) return 'CALM'
    if (v <= 50) return 'BUILDING'
    if (v <= 70) return 'AGITATED'
    return 'CRITICAL'
  }
  if (v >= 80) return 'PEAK'
  if (v >= 60) return 'STRONG'
  if (v >= 40) return 'STEADY'
  return 'LOW'
}
