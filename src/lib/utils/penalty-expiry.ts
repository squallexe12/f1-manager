/**
 * Compute the round and season at which a penalty-point entry expires.
 * The rolling window is `rollingWindow` rounds (22 for the F1 super-licence).
 *
 * Formula:
 *   rawExpiry = issuedRound + rollingWindow - 1
 *   expRound  = (rawExpiry % 22) + 1   (wraps 0→22 into 1-based)
 *   expSeason = issuedSeason + floor(rawExpiry / 22)
 *
 * Examples:
 *   R5  + 22 → R5  next season (rawExpiry=26, 26%22=4 → +1=5, floor(26/22)=1)
 *   R21 + 22 → R21 next season (rawExpiry=42, 42%22=20 → +1=21, floor(42/22)=1)
 */
export function computeExpiryRound(
  issuedRound: number,
  issuedSeason: number,
  rollingWindow: number,
): { round: number; season: number } {
  const rawExpiry = issuedRound + rollingWindow - 1
  const expRound = (rawExpiry % 22) + 1
  const expSeason = issuedSeason + Math.floor(rawExpiry / 22)
  return { round: expRound, season: expSeason }
}
