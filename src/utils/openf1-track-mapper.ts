const OPENF1_BASE = 'https://api.openf1.org/v1'

interface RawLocationPoint {
  x: number
  y: number
  date: string
}

export interface TrackPoint {
  x: number // 0-1 normalized
  y: number // 0-1 normalized
}

// ~90 seconds of data at 3.7Hz ≈ 333 points (one lap)
const ONE_LAP_POINTS = 333

/**
 * Normalize an array of raw coordinates into a 0-1 bounding box.
 * Preserves aspect ratio by fitting the longer axis to 0-1
 * and centering the shorter axis.
 */
function normalizeCoordinates(points: { x: number; y: number }[]): TrackPoint[] {
  if (points.length === 0) return []

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const rangeX = maxX - minX
  const rangeY = maxY - minY

  // Use the larger range as the scale factor to preserve aspect ratio
  const maxRange = Math.max(rangeX, rangeY)
  if (maxRange === 0) return points.map(() => ({ x: 0.5, y: 0.5 }))

  // Offsets to center the shorter axis
  const offsetX = (maxRange - rangeX) / 2
  const offsetY = (maxRange - rangeY) / 2

  return points.map(p => ({
    x: (p.x - minX + offsetX) / maxRange,
    y: (p.y - minY + offsetY) / maxRange,
  }))
}

/**
 * Fetch one lap of car location data from the OpenF1 API
 * and return normalized track spline points.
 *
 * @param sessionKey - OpenF1 session key (e.g. 9161 for 2023 Bahrain GP Race)
 * @param driverNumber - Car number (e.g. 1 for Verstappen)
 * @returns Normalized track points (x, y in 0-1 range)
 *
 * @example
 * const spline = await fetchTrackSpline(9161, 1)
 * // spline = [{ x: 0.12, y: 0.85 }, { x: 0.14, y: 0.82 }, ...]
 */
export async function fetchTrackSpline(
  sessionKey: number,
  driverNumber: number,
): Promise<TrackPoint[]> {
  const url = `${OPENF1_BASE}/location?session_key=${sessionKey}&driver_number=${driverNumber}`

  let response: Response
  try {
    response = await fetch(url)
  } catch (err) {
    throw new Error(
      `Failed to fetch OpenF1 location data: ${err instanceof Error ? err.message : 'network error'}`
    )
  }

  if (!response.ok) {
    throw new Error(
      `OpenF1 API returned ${response.status}: ${response.statusText}`
    )
  }

  let data: RawLocationPoint[]
  try {
    data = await response.json()
  } catch {
    throw new Error('Failed to parse OpenF1 location response as JSON')
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('OpenF1 returned empty or invalid location data')
  }

  // Limit to approximately one lap's worth of points
  const lapPoints = data.slice(0, ONE_LAP_POINTS)

  // Extract x/y, filtering out any points with missing coordinates
  const validPoints = lapPoints.filter(
    (p): p is RawLocationPoint => typeof p.x === 'number' && typeof p.y === 'number'
  )

  if (validPoints.length === 0) {
    throw new Error('No valid coordinate data found in OpenF1 response')
  }

  return normalizeCoordinates(validPoints)
}

/**
 * Convert normalized track points to an SVG path string.
 * Useful for rendering in the circuit map component.
 *
 * @param points - Normalized track points (0-1 range)
 * @param width - SVG viewbox width to scale to
 * @param height - SVG viewbox height to scale to
 * @param padding - Padding from edges (fraction, default 0.1)
 */
export function trackPointsToSVGPath(
  points: TrackPoint[],
  width: number = 200,
  height: number = 140,
  padding: number = 0.1,
): string {
  if (points.length < 2) return ''

  const pw = width * padding
  const ph = height * padding
  const w = width - 2 * pw
  const h = height - 2 * ph

  const scaled = points.map(p => ({
    x: pw + p.x * w,
    y: ph + p.y * h,
  }))

  // Build smooth path using cubic bezier approximation
  const first = scaled[0]
  const parts: string[] = [`M${first.x.toFixed(1)},${first.y.toFixed(1)}`]

  for (let i = 1; i < scaled.length; i++) {
    const curr = scaled[i]
    const prev = scaled[i - 1]
    const next = scaled[Math.min(i + 1, scaled.length - 1)]

    // Simple smoothing: use midpoints as control points
    const cpx = (prev.x + curr.x) / 2
    const cpy = (prev.y + curr.y) / 2

    parts.push(`Q${cpx.toFixed(1)},${cpy.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`)
  }

  // Close the path back to start
  parts.push('Z')

  return parts.join(' ')
}
