'use client'

import {
  Radar, RadarChart as RechartsRadar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'

interface RadarChartProps {
  data: Record<string, number> // e.g. { downforce: 85, straightSpeed: 80, ... }
  labels?: Record<string, string> // optional label mapping
  color?: string
  maxValue?: number
  className?: string
}

const DEFAULT_LABELS: Record<string, string> = {
  downforce: 'Downforce',
  straightSpeed: 'Speed',
  reliability: 'Reliability',
  tireManagement: 'Tires',
  braking: 'Braking',
  cornering: 'Cornering',
  pace: 'Pace',
  racecraft: 'Racecraft',
  experience: 'Experience',
  mentality: 'Mentality',
  marketability: 'Market',
  developmentPotential: 'Potential',
}

export function RadarChart({
  data,
  labels,
  color = 'var(--accent-lime)',
  maxValue = 100,
  className = '',
}: RadarChartProps) {
  const labelMap = { ...DEFAULT_LABELS, ...labels }

  const chartData = Object.entries(data).map(([key, value]) => ({
    attribute: labelMap[key] ?? key,
    value,
    fullMark: maxValue,
  }))

  // Build accessible text description
  const ariaDesc = chartData.map(d => `${d.attribute}: ${d.value}`).join(', ')

  return (
    <div
      className={`w-full aspect-square ${className}`}
      role="img"
      aria-label={`Performance radar chart. ${ariaDesc}`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
        <RechartsRadar cx="50%" cy="50%" outerRadius="75%" data={chartData}>
          <PolarGrid
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="2 4"
          />
          <PolarAngleAxis
            dataKey="attribute"
            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-heading)' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, maxValue]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Performance"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  )
}
