'use client'

import type { LapResult } from '@/types/race'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DriverResultDisplay {
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  position: number
  gapToLeader: number
  lapTime: number | null
}

interface PostRaceResultsProps {
  results: DriverResultDisplay[]
  fastestLap: { driverId: string; time: number } | null
  raceName: string
  onContinue: () => void
  className?: string
}

const POINTS_TABLE: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
  6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
}

export function PostRaceResults({ results, fastestLap, raceName, onContinue, className = '' }: PostRaceResultsProps) {
  const podium = results.slice(0, 3)
  const rest = results.slice(3)

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Race Title */}
      <div className="text-center">
        <h2 className="text-lg font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
          Race Results
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">{raceName}</p>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-4">
        {/* P2 */}
        {podium[1] && <PodiumBlock result={podium[1]} height="h-28" />}
        {/* P1 */}
        {podium[0] && <PodiumBlock result={podium[0]} height="h-36" isWinner />}
        {/* P3 */}
        {podium[2] && <PodiumBlock result={podium[2]} height="h-20" />}
      </div>

      {/* Full Results Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 text-[9px] font-heading uppercase tracking-wider text-[var(--text-dim)] border-b border-[var(--border-default)]">
          <span className="w-8">POS</span>
          <span className="flex-1">DRIVER</span>
          <span className="w-20">TEAM</span>
          <span className="w-16 text-right">GAP</span>
          <span className="w-10 text-right">PTS</span>
        </div>
        {results.map((r) => {
          const points = POINTS_TABLE[r.position] ?? 0
          const hasFastestLap = fastestLap?.driverId === r.driverId
          const totalPoints = points + (hasFastestLap && r.position <= 10 ? 1 : 0)

          return (
            <div
              key={r.driverId}
              className={`
                flex items-center gap-3 px-4 py-2 text-xs
                ${r.isPlayer ? 'bg-[var(--accent-lime)]/[0.06] border-l-2 border-[var(--accent-lime)]' : 'hover:bg-white/[0.02]'}
                ${r.position <= 3 ? 'border-b border-[var(--border-default)]' : ''}
              `}
            >
              <span className="w-8 font-mono text-[var(--text-muted)]">{r.position}</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: r.teamColor }} />
                <span className={`font-heading font-semibold ${r.isPlayer ? 'text-[var(--accent-lime)]' : 'text-[var(--text-primary)]'}`}>
                  {r.driverName}
                </span>
                {hasFastestLap && <Badge variant="cyan">FL</Badge>}
              </div>
              <span className="w-20 text-[10px] font-mono text-[var(--text-dim)] truncate">{r.teamName}</span>
              <span className="w-16 text-right text-[10px] font-mono text-[var(--text-muted)]">
                {r.position === 1 ? 'WINNER' : `+${r.gapToLeader.toFixed(1)}s`}
              </span>
              <span className="w-10 text-right font-mono text-[var(--text-secondary)]">
                {totalPoints > 0 ? `+${totalPoints}` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Fastest Lap */}
      {fastestLap && (
        <div className="flex items-center justify-center gap-3 text-xs text-[var(--text-secondary)]">
          <Badge variant="cyan">Fastest Lap</Badge>
          <span className="font-heading font-semibold">
            {results.find(r => r.driverId === fastestLap.driverId)?.driverName ?? '—'}
          </span>
          <span className="font-mono text-[var(--accent-cyan)]">
            {formatTime(fastestLap.time)}
          </span>
        </div>
      )}

      {/* Continue */}
      <div className="flex justify-center">
        <Button size="lg" onClick={onContinue}>
          Return to Paddock
        </Button>
      </div>
    </div>
  )
}

function PodiumBlock({ result, height, isWinner = false }: { result: DriverResultDisplay; height: string; isWinner?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 w-28">
      <span className={`text-xs font-heading font-semibold ${isWinner ? 'text-[var(--accent-lime)]' : 'text-[var(--text-primary)]'}`}>
        {result.driverName}
      </span>
      <span className="text-[10px] font-mono text-[var(--text-dim)]">{result.teamName}</span>
      <div
        className={`w-full ${height} rounded-t-md flex items-end justify-center pb-2`}
        style={{ backgroundColor: `${result.teamColor}22`, borderTop: `2px solid ${result.teamColor}` }}
      >
        <span className={`text-2xl font-heading font-bold ${isWinner ? 'text-[var(--accent-lime)]' : 'text-[var(--text-secondary)]'}`}>
          P{result.position}
        </span>
      </div>
    </div>
  )
}
