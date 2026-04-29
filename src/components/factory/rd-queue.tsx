import type { RndUpgrade } from '@/types/team'

interface RdQueueProps {
  upgrades: RndUpgrade[]
  currentRound: number
  /**
   * Phase 3 (Box 3): ids of in-progress upgrades that would exceed the
   * team's CDT-window WT or CFD budget on the next management cycle. The
   * row renders a `BUDGET STALL` badge so the player can decide whether
   * to pause one upgrade or wait for the window reset.
   */
  stalledUpgradeIds?: ReadonlySet<string>
}

const BRANCH_LABEL: Record<RndUpgrade['branch'], string> = {
  chassis: 'CHASSIS',
  'power-unit': 'POWER UNIT',
  'active-aero': 'ACTIVE AERO',
}

export function RdQueue({ upgrades, currentRound, stalledUpgradeIds }: RdQueueProps) {
  const active = upgrades.filter((u) => u.status === 'in-progress' || u.status === 'queued')

  // In-progress first, then queued. Preserve relative order within each group.
  const ordered = [
    ...active.filter((u) => u.status === 'in-progress'),
    ...active.filter((u) => u.status === 'queued'),
  ]

  return (
    <div className="rd-queue">
      <div className="rd-queue-rows">
        <div className="rd-queue-col-labels">
          <div>#</div>
          <div>UPGRADE</div>
          <div>BRANCH</div>
          <div style={{ textAlign: 'right' }}>ETA</div>
          <div style={{ textAlign: 'right' }}>PROGRESS</div>
        </div>
        {ordered.length === 0 ? (
          <div className="rd-queue-empty">NO ACTIVE OR QUEUED UPGRADES</div>
        ) : (
          ordered.map((u, i) => {
            // ETA round estimate: current + remaining dev races (ceil).
            const remainingRaces = Math.max(0, Math.ceil(((100 - u.progress) / 100) * u.developmentRaces))
            const etaRound = currentRound + remainingRaces
            const stalled = stalledUpgradeIds?.has(u.id) ?? false
            return (
              <div key={u.id} className="rdq-row">
                <div className="rdq-idx">{String(i + 1).padStart(2, '0')}</div>
                <div className="rdq-name">
                  {u.name}
                  {stalled && <span className="rdq-stall-badge">BUDGET STALL</span>}
                </div>
                <div className="rdq-branch">{BRANCH_LABEL[u.branch]}</div>
                <div className="rdq-eta">{stalled ? '— STALLED —' : `R${String(etaRound).padStart(2, '0')}`}</div>
                <div>
                  <div className="rdq-bar-track">
                    <div className="fill" style={{ transform: `scaleX(${u.progress / 100})` }} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
