import type { RndUpgrade } from '@/types/team'

interface RdPipelineHeaderProps {
  upgrades: RndUpgrade[]
  /** Round of the next scheduled delivery — TODO(Phase B) */
  nextDeliveryRound?: number
  /** Circuit/label to describe the next delivery — TODO(Phase B) */
  nextDeliveryLabel?: string
}

const BRANCH_COUNT = 3

export function RdPipelineHeader({ upgrades, nextDeliveryRound, nextDeliveryLabel }: RdPipelineHeaderProps) {
  const total = upgrades.length
  const active = upgrades.filter((u) => u.status === 'in-progress').length
  const queued = upgrades.filter((u) => u.status === 'queued').length

  const deliveryStr = nextDeliveryRound
    ? `${(nextDeliveryLabel ?? 'NEXT UPGRADE').toUpperCase()} · R${String(nextDeliveryRound).padStart(2, '0')}`
    : null

  return (
    <div className="rd-head">
      <div>
        <div className="rd-t">R&amp;D Pipeline</div>
        <div className="rd-s">
          {total} UPGRADES · {BRANCH_COUNT} BRANCHES · {active} ACTIVE · {queued} QUEUED
        </div>
      </div>
      <div className="rd-right">
        <div>NEXT DELIVERY</div>
        {deliveryStr ? <div className="b">{deliveryStr}</div> : <div className="b">—</div>}
      </div>
    </div>
  )
}
